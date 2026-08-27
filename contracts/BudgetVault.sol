// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title BudgetVault
/// @notice Escrow for agent execution budgets, denominated in native BOT.
/// @dev Users deposit BOT into a free balance. When an agent is registered the
///      AgentRegistry locks part of that balance against the agent id. When the
///      CircuitBreaker halts (or the owner completes) the agent, the locked
///      amount is released back to the user's free balance, from where it can be
///      withdrawn. This is what makes "auto-refund on halt" verifiable on-chain.
contract BudgetVault is Ownable, ReentrancyGuard {
    struct Escrow {
        address owner;
        uint256 amount;
        bool released;
    }

    /// @notice Unlocked balance per user, withdrawable at any time.
    mapping(address => uint256) public balances;

    /// @notice Locked escrow per agent id.
    mapping(bytes32 => Escrow) public escrows;

    /// @notice Contracts allowed to lock/release escrow and issue refunds.
    mapping(address => bool) public authorizedBreakers;

    /// @notice Sum of all currently locked escrow, for dashboard display.
    uint256 public totalLocked;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event Locked(bytes32 indexed agentId, address indexed user, uint256 amount);
    event Refunded(address indexed user, uint256 amount);
    event BreakerAuthorized(address indexed breaker, bool authorized);

    error Unauthorized();
    error InsufficientBalance();
    error ZeroAmount();
    error ZeroAddress();
    error EscrowExists();
    error TransferFailed();

    modifier onlyBreaker() {
        if (!authorizedBreakers[msg.sender]) revert Unauthorized();
        _;
    }

    constructor() Ownable(msg.sender) {}

    // ---------------------------------------------------------------- deposits

    /// @notice Deposit BOT into your own free balance.
    function deposit() public payable {
        if (msg.value == 0) revert ZeroAmount();
        balances[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    /// @notice Deposit BOT credited to `user`. Used by AgentRegistry so that a
    ///         user can fund and register an agent in a single transaction.
    function depositFor(address user) external payable {
        if (msg.value == 0) revert ZeroAmount();
        if (user == address(0)) revert ZeroAddress();
        balances[user] += msg.value;
        emit Deposited(user, msg.value);
    }

    /// @notice Withdraw unlocked balance.
    function withdraw(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (balances[msg.sender] < amount) revert InsufficientBalance();
        balances[msg.sender] -= amount;
        emit Withdrawn(msg.sender, amount);
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    // ------------------------------------------------------------------ escrow

    /// @notice Lock `amount` of `user`'s free balance against `agentId`.
    function lock(bytes32 agentId, address user, uint256 amount) external onlyBreaker {
        if (amount == 0) revert ZeroAmount();
        if (escrows[agentId].amount != 0) revert EscrowExists();
        if (balances[user] < amount) revert InsufficientBalance();

        balances[user] -= amount;
        escrows[agentId] = Escrow({owner: user, amount: amount, released: false});
        totalLocked += amount;
        emit Locked(agentId, user, amount);
    }

    /// @notice Release an agent's escrow back to its owner's free balance.
    /// @dev Called by the CircuitBreaker on halt (the refund) or on completion.
    ///      Returns the released amount; releasing an empty/settled escrow is a
    ///      no-op so a halt can never be blocked by escrow state.
    function release(bytes32 agentId) external onlyBreaker returns (uint256) {
        Escrow storage e = escrows[agentId];
        if (e.released || e.amount == 0) return 0;

        uint256 amount = e.amount;
        e.released = true;
        totalLocked -= amount;
        balances[e.owner] += amount;
        emit Refunded(e.owner, amount);
        return amount;
    }

    /// @notice Direct refund path kept for compatibility with the spec's API.
    function refund(address user, uint256 amount) external onlyBreaker nonReentrant {
        if (balances[user] < amount) revert InsufficientBalance();
        balances[user] -= amount;
        emit Refunded(user, amount);
        (bool ok, ) = payable(user).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    // ------------------------------------------------------------------- admin

    function setBreaker(address breaker, bool authorized) public onlyOwner {
        if (breaker == address(0)) revert ZeroAddress();
        authorizedBreakers[breaker] = authorized;
        emit BreakerAuthorized(breaker, authorized);
    }

    /// @notice Convenience wrapper matching the original spec signature.
    function authorizeBreaker(address breaker) external {
        setBreaker(breaker, true);
    }

    // ------------------------------------------------------------------- views

    function getEscrow(bytes32 agentId) external view returns (Escrow memory) {
        return escrows[agentId];
    }

    receive() external payable {
        deposit();
    }
}
