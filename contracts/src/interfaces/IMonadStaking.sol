// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Minimal interface for Monad's canonical staking precompile at 0x1000.
/// @dev Getters are intentionally non-view because the precompile rejects STATICCALL.
interface IMonadStaking {
    function delegate(uint64 validatorId) external payable returns (bool success);
    function undelegate(uint64 validatorId, uint256 amount, uint8 withdrawId) external returns (bool success);
    function withdraw(uint64 validatorId, uint8 withdrawId) external returns (bool success);
    function claimRewards(uint64 validatorId) external returns (bool success);
}
