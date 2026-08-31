// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AgentRegistry} from "./AgentRegistry.sol";
import {BudgetVault} from "./BudgetVault.sol";

/// @title CircuitBreaker
/// @notice The core of Sent: a trustless kill-switch for AI agents.
/// @dev An agent calls `checkLimits` before every step. The moment a budget is
///      breached the call trips the breaker: the agent is deactivated, an
///      immutable HaltRecord is written, and the escrowed budget is refunded.
///      `checkLimits` returns false rather than reverting so the caller can
///      read the halt reason from the same transaction.
contract CircuitBreaker {
    enum HaltReason {
        NONE,
        MAX_STEPS,
        MAX_TOKENS,
        MAX_GAS,
        DEADLINE,
        MANUAL
    }

    struct HaltRecord {
        bytes32 agentId;
        HaltReason reason;
        uint256 timestamp;
        uint256 stepCount;
        uint256 tokenCount;
        uint256 refunded;
        string message;
    }

    AgentRegistry public immutable registry;
    BudgetVault public immutable vault;

    mapping(bytes32 => bool) public halted;
    mapping(bytes32 => HaltRecord) public haltRecords;
    bytes32[] public haltHistory;

    event AgentHalted(bytes32 indexed agentId, HaltReason reason, uint256 timestamp);
    event StepApproved(bytes32 indexed agentId, uint256 step, uint256 tokensUsed, uint256 gasUsed);
    event AgentCompleted(bytes32 indexed agentId, uint256 refunded);

    error AlreadyHalted();
    error NotActive();
    error NotOwner();

    constructor(address _registry, address _vault) {
        registry = AgentRegistry(_registry);
        vault = BudgetVault(payable(_vault));
    }

    // ------------------------------------------------------------ the breaker

    /// @notice Check an agent's budget and record one step of usage.
    /// @return allowed True if the step may proceed, false if the breaker tripped.
    function checkLimits(bytes32 agentId, uint256 tokensUsed) external returns (bool allowed) {
        uint256 gasAtStart = gasleft();
        if (halted[agentId]) revert AlreadyHalted();

        AgentRegistry.BudgetProfile memory profile = registry.getProfile(agentId);
        if (!profile.active) revert NotActive();

        // 1. Wall-clock deadline.
        if (block.timestamp > profile.deadline) {
            _halt(agentId, HaltReason.DEADLINE, "Execution deadline exceeded");
            return false;
        }

        // 2. Step ceiling.
        if (registry.stepCounts(agentId) >= profile.maxSteps) {
            _halt(agentId, HaltReason.MAX_STEPS, "Max steps exceeded");
            return false;
        }

        // 3. Token ceiling (projected, including this step).
        if (registry.tokenCounts(agentId) + tokensUsed > profile.maxTokens) {
            _halt(agentId, HaltReason.MAX_TOKENS, "Max tokens exceeded");
            return false;
        }

        // 4. Cumulative on-chain gas ceiling. maxGas == 0 disables this check.
        uint256 gasSoFar = registry.gasCounts(agentId);
        if (profile.maxGas != 0 && gasSoFar >= profile.maxGas) {
            _halt(agentId, HaltReason.MAX_GAS, "Max gas exceeded");
            return false;
        }

        uint256 gasUsed = gasAtStart - gasleft();
        registry.incrementUsage(agentId, tokensUsed, gasUsed);
        emit StepApproved(agentId, registry.stepCounts(agentId), tokensUsed, gasUsed);
        return true;
    }

    /// @notice Owner-triggered kill switch. The ⌘K panic button.
    function manualHalt(bytes32 agentId, string calldata reason) external {
        if (registry.owners(agentId) != msg.sender) revert NotOwner();
        if (halted[agentId]) revert AlreadyHalted();
        _halt(agentId, HaltReason.MANUAL, reason);
    }

    /// @notice Owner marks a run finished; releases the escrow without a halt.
    function completeAgent(bytes32 agentId) external {
        if (registry.owners(agentId) != msg.sender) revert NotOwner();
        if (halted[agentId]) revert AlreadyHalted();
        registry.deactivate(agentId);
        uint256 refunded = vault.release(agentId);
        emit AgentCompleted(agentId, refunded);
    }

    function _halt(bytes32 agentId, HaltReason reason, string memory message) internal {
        halted[agentId] = true;
        registry.deactivate(agentId);

        // The refund must never be able to block the halt itself.
        uint256 refunded;
        try vault.release(agentId) returns (uint256 amount) {
            refunded = amount;
        } catch {
            refunded = 0;
        }

        haltRecords[agentId] = HaltRecord({
            agentId: agentId,
            reason: reason,
            timestamp: block.timestamp,
            stepCount: registry.stepCounts(agentId),
            tokenCount: registry.tokenCounts(agentId),
            refunded: refunded,
            message: message
        });
        haltHistory.push(agentId);
        emit AgentHalted(agentId, reason, block.timestamp);
    }

    // ------------------------------------------------------------------ views

    function getHaltHistory() external view returns (bytes32[] memory) {
        return haltHistory;
    }

    function haltCount() external view returns (uint256) {
        return haltHistory.length;
    }

    /// @notice All halt proofs in one RPC call, newest last.
    function getHaltRecords() external view returns (HaltRecord[] memory records) {
        records = new HaltRecord[](haltHistory.length);
        for (uint256 i = 0; i < haltHistory.length; i++) {
            records[i] = haltRecords[haltHistory[i]];
        }
    }

    /// @notice Read-only budget check, no state change, for UI warnings.
    function wouldHalt(bytes32 agentId, uint256 tokensUsed) external view returns (bool, HaltReason) {
        if (halted[agentId]) return (true, haltRecords[agentId].reason);
        AgentRegistry.BudgetProfile memory profile = registry.getProfile(agentId);
        if (!profile.active) return (true, HaltReason.MANUAL);
        if (block.timestamp > profile.deadline) return (true, HaltReason.DEADLINE);
        if (registry.stepCounts(agentId) >= profile.maxSteps) return (true, HaltReason.MAX_STEPS);
        if (registry.tokenCounts(agentId) + tokensUsed > profile.maxTokens) return (true, HaltReason.MAX_TOKENS);
        if (profile.maxGas != 0 && registry.gasCounts(agentId) >= profile.maxGas) return (true, HaltReason.MAX_GAS);
        return (false, HaltReason.NONE);
    }
}
