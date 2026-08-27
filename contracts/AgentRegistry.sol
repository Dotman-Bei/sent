// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {BudgetVault} from "./BudgetVault.sol";

/// @title AgentRegistry
/// @notice Registry of AI agents and their on-chain execution budgets.
/// @dev Usage counters are only writable by authorized callers (the
///      CircuitBreaker), so an agent cannot inflate its own accounting to
///      escape a limit, and a third party cannot burn someone else's budget.
contract AgentRegistry is Ownable {
    /// @notice The budget an agent is allowed to consume before being halted.
    struct BudgetProfile {
        uint256 maxSteps; // max reasoning/tool steps
        uint256 maxTokens; // max LLM tokens across the run
        uint256 maxGas; // max cumulative on-chain gas for checkLimits calls
        uint256 deadline; // unix timestamp after which the run is halted
        bool active; // false once halted or completed
    }

    mapping(bytes32 => BudgetProfile) public profiles;
    mapping(bytes32 => address) public owners;
    mapping(bytes32 => uint256) public stepCounts;
    mapping(bytes32 => uint256) public tokenCounts;
    mapping(bytes32 => uint256) public gasCounts;
    mapping(bytes32 => uint256) public createdAt;

    mapping(address => bool) public authorized;
    mapping(address => bytes32[]) private _agentsByOwner;
    bytes32[] private _agentIds;

    BudgetVault public immutable vault;

    event AgentRegistered(bytes32 indexed agentId, address owner);
    event BudgetUpdated(bytes32 indexed agentId);
    event UsageRecorded(bytes32 indexed agentId, uint256 step, uint256 tokensUsed, uint256 gasUsed);
    event AgentDeactivated(bytes32 indexed agentId);
    event AuthorizedSet(address indexed account, bool authorized);

    error Unauthorized();
    error AgentExists();
    error UnknownAgent();
    error AgentInactive();
    error InvalidBudget();

    modifier onlyAuthorized() {
        if (!authorized[msg.sender]) revert Unauthorized();
        _;
    }

    constructor(address _vault) Ownable(msg.sender) {
        vault = BudgetVault(payable(_vault));
    }

    // -------------------------------------------------------------- lifecycle

    /// @notice Register an agent with an immutable execution budget.
    /// @dev Any BOT sent with the call is escrowed against this agent and is
    ///      refunded to the owner's vault balance when the agent halts.
    function registerAgent(
        bytes32 agentId,
        uint256 maxSteps,
        uint256 maxTokens,
        uint256 maxGas,
        uint256 durationSeconds
    ) external payable {
        if (owners[agentId] != address(0)) revert AgentExists();
        if (maxSteps == 0 || maxTokens == 0 || durationSeconds == 0) revert InvalidBudget();

        owners[agentId] = msg.sender;
        profiles[agentId] = BudgetProfile({
            maxSteps: maxSteps,
            maxTokens: maxTokens,
            maxGas: maxGas,
            deadline: block.timestamp + durationSeconds,
            active: true
        });
        createdAt[agentId] = block.timestamp;
        _agentIds.push(agentId);
        _agentsByOwner[msg.sender].push(agentId);

        if (msg.value > 0) {
            vault.depositFor{value: msg.value}(msg.sender);
            vault.lock(agentId, msg.sender, msg.value);
        }

        emit AgentRegistered(agentId, msg.sender);
    }

    /// @notice Record one step of usage. Only the CircuitBreaker may call this.
    function incrementUsage(bytes32 agentId, uint256 tokensUsed, uint256 gasUsed) external onlyAuthorized {
        if (!profiles[agentId].active) revert AgentInactive();
        stepCounts[agentId] += 1;
        tokenCounts[agentId] += tokensUsed;
        gasCounts[agentId] += gasUsed;
        emit UsageRecorded(agentId, stepCounts[agentId], tokensUsed, gasUsed);
    }

    /// @notice Mark an agent inactive. Called by the CircuitBreaker on halt.
    function deactivate(bytes32 agentId) external onlyAuthorized {
        if (owners[agentId] == address(0)) revert UnknownAgent();
        profiles[agentId].active = false;
        emit AgentDeactivated(agentId);
    }

    // ------------------------------------------------------------------ admin

    function setAuthorized(address account, bool value) external onlyOwner {
        authorized[account] = value;
        emit AuthorizedSet(account, value);
    }

    // ------------------------------------------------------------------ views

    function getProfile(bytes32 agentId) external view returns (BudgetProfile memory) {
        return profiles[agentId];
    }

    function getAgentIds() external view returns (bytes32[] memory) {
        return _agentIds;
    }

    function getAgentsByOwner(address owner) external view returns (bytes32[] memory) {
        return _agentsByOwner[owner];
    }

    function agentCount() external view returns (uint256) {
        return _agentIds.length;
    }

    /// @notice Everything the dashboard needs about one agent, in a single call.
    function getAgentView(bytes32 agentId)
        external
        view
        returns (
            address owner,
            BudgetProfile memory profile,
            uint256 steps,
            uint256 tokens,
            uint256 gas,
            uint256 created
        )
    {
        return (
            owners[agentId],
            profiles[agentId],
            stepCounts[agentId],
            tokenCounts[agentId],
            gasCounts[agentId],
            createdAt[agentId]
        );
    }
}
