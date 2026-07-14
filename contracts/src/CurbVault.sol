// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IMonadStaking} from "./interfaces/IMonadStaking.sol";

/// @title CurbVault
/// @notice A self-custodial native-token vault with delayed security policy changes.
contract CurbVault {
    struct Policy {
        uint128 perTransactionLimit;
        uint128 dailyLimit;
        uint128 minimumLiquidReserve;
        uint64 recipientCooldown;
        uint64 changeDelay;
        uint64 validatorId;
    }

    struct PendingPolicy {
        Policy policy;
        uint64 executableAt;
    }

    struct EmergencyRequest {
        address payable recipient;
        uint128 amount;
        uint64 executableAt;
    }

    error OnlyOwner();
    error ZeroAddress();
    error InvalidPolicy();
    error AmountIsZero();
    error InsufficientBalance();
    error PerTransactionLimitExceeded();
    error DailyLimitExceeded();
    error RecipientNotReady(uint256 readyAt);
    error ChangeNotReady(uint256 executableAt);
    error NoPendingChange();
    error TransferFailed();
    error ReentrantCall();
    error StakingDisabled();
    error StakingCallFailed();
    error LiquidReserveBreached();
    error InvalidValidator();
    error WithdrawalSlotInUse();
    error ActiveStakeExists();

    event Deposited(address indexed from, uint256 amount);
    event RecipientRegistered(address indexed recipient, uint256 readyAt);
    event TrustedRecipientScheduled(address indexed recipient, uint256 executableAt);
    event TrustedRecipientUpdated(address indexed recipient, bool trusted);
    event Withdrawal(address indexed recipient, uint256 amount, uint256 spentToday);
    event PolicyProposed(uint256 executableAt);
    event PolicyApplied(
        uint128 perTransactionLimit,
        uint128 dailyLimit,
        uint128 minimumLiquidReserve,
        uint64 recipientCooldown,
        uint64 changeDelay,
        uint64 validatorId
    );
    event PolicyProposalCancelled();
    event EmergencyWithdrawalScheduled(address indexed recipient, uint256 amount, uint256 executableAt);
    event EmergencyWithdrawalCancelled();
    event EmergencyWithdrawalExecuted(address indexed recipient, uint256 amount);
    event StakeDelegated(uint64 indexed validatorId, uint256 amount, uint256 delegatedPrincipal);
    event UnstakeRequested(uint64 indexed validatorId, uint8 indexed withdrawId, uint256 amount);
    event UnstakeCompleted(uint64 indexed validatorId, uint8 indexed withdrawId, uint256 amountReceived);
    event RewardsClaimed(uint64 indexed validatorId, uint256 amount);

    address public immutable owner;
    IMonadStaking public immutable staking;
    bool public immutable stakingEnabled;
    Policy public policy;
    PendingPolicy public pendingPolicy;
    EmergencyRequest public emergencyRequest;

    mapping(address => uint64) public recipientRegisteredAt;
    mapping(address => uint64) public trustedRecipientExecutableAt;
    mapping(address => bool) public trustedRecipient;
    mapping(uint256 => uint256) public spentByDay;
    mapping(uint8 => uint256) public pendingUnstakeById;

    uint256 public delegatedPrincipal;
    uint256 public totalPendingUnstake;

    uint256 private locked = 1;

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier nonReentrant() {
        if (locked != 1) revert ReentrantCall();
        locked = 2;
        _;
        locked = 1;
    }

    constructor(address owner_, Policy memory initialPolicy, address staking_, bool stakingEnabled_) {
        if (owner_ == address(0)) revert ZeroAddress();
        if (staking_ == address(0)) revert ZeroAddress();
        _validatePolicy(initialPolicy);
        owner = owner_;
        staking = IMonadStaking(staking_);
        stakingEnabled = stakingEnabled_;
        policy = initialPolicy;
        emit PolicyApplied(
            initialPolicy.perTransactionLimit,
            initialPolicy.dailyLimit,
            initialPolicy.minimumLiquidReserve,
            initialPolicy.recipientCooldown,
            initialPolicy.changeDelay,
            initialPolicy.validatorId
        );
    }

    receive() external payable {
        emit Deposited(msg.sender, msg.value);
    }

    function deposit() external payable {
        if (msg.value == 0) revert AmountIsZero();
        emit Deposited(msg.sender, msg.value);
    }

    function registerRecipient(address recipient) external onlyOwner {
        if (recipient == address(0)) revert ZeroAddress();
        if (recipientRegisteredAt[recipient] == 0) {
            recipientRegisteredAt[recipient] = uint64(block.timestamp);
            emit RecipientRegistered(recipient, block.timestamp + policy.recipientCooldown);
        }
    }

    function scheduleTrustedRecipient(address recipient) external onlyOwner {
        if (recipient == address(0)) revert ZeroAddress();
        uint64 executableAt = uint64(block.timestamp + policy.changeDelay);
        trustedRecipientExecutableAt[recipient] = executableAt;
        emit TrustedRecipientScheduled(recipient, executableAt);
    }

    function activateTrustedRecipient(address recipient) external onlyOwner {
        uint64 executableAt = trustedRecipientExecutableAt[recipient];
        if (executableAt == 0) revert NoPendingChange();
        if (block.timestamp < executableAt) revert ChangeNotReady(executableAt);
        delete trustedRecipientExecutableAt[recipient];
        trustedRecipient[recipient] = true;
        emit TrustedRecipientUpdated(recipient, true);
    }

    function removeTrustedRecipient(address recipient) external onlyOwner {
        delete trustedRecipientExecutableAt[recipient];
        trustedRecipient[recipient] = false;
        emit TrustedRecipientUpdated(recipient, false);
    }

    function withdraw(address payable recipient, uint128 amount) external onlyOwner nonReentrant {
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert AmountIsZero();
        if (amount > address(this).balance) revert InsufficientBalance();
        if (address(this).balance - amount < policy.minimumLiquidReserve) revert LiquidReserveBreached();
        if (amount > policy.perTransactionLimit) revert PerTransactionLimitExceeded();

        if (!trustedRecipient[recipient]) {
            uint64 registeredAt = recipientRegisteredAt[recipient];
            uint256 readyAt = uint256(registeredAt) + policy.recipientCooldown;
            if (registeredAt == 0 || block.timestamp < readyAt) revert RecipientNotReady(readyAt);
        }

        uint256 day = block.timestamp / 1 days;
        uint256 newSpent = spentByDay[day] + amount;
        if (newSpent > policy.dailyLimit) revert DailyLimitExceeded();
        spentByDay[day] = newSpent;

        (bool success,) = recipient.call{value: amount}("");
        if (!success) revert TransferFailed();
        emit Withdrawal(recipient, amount, newSpent);
    }

    function proposePolicy(Policy calldata newPolicy) external onlyOwner {
        _validatePolicy(newPolicy);
        uint64 executableAt = uint64(block.timestamp + policy.changeDelay);
        pendingPolicy = PendingPolicy({policy: newPolicy, executableAt: executableAt});
        emit PolicyProposed(executableAt);
    }

    function applyPolicy() external onlyOwner {
        uint64 executableAt = pendingPolicy.executableAt;
        if (executableAt == 0) revert NoPendingChange();
        if (block.timestamp < executableAt) revert ChangeNotReady(executableAt);
        Policy memory next = pendingPolicy.policy;
        if (
            next.validatorId != policy.validatorId
                && (delegatedPrincipal != 0 || totalPendingUnstake != 0)
        ) revert ActiveStakeExists();
        delete pendingPolicy;
        policy = next;
        emit PolicyApplied(
            next.perTransactionLimit,
            next.dailyLimit,
            next.minimumLiquidReserve,
            next.recipientCooldown,
            next.changeDelay,
            next.validatorId
        );
    }

    function cancelPolicyProposal() external onlyOwner {
        if (pendingPolicy.executableAt == 0) revert NoPendingChange();
        delete pendingPolicy;
        emit PolicyProposalCancelled();
    }

    function scheduleEmergencyWithdrawal(address payable recipient, uint128 amount) external onlyOwner {
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert AmountIsZero();
        uint64 executableAt = uint64(block.timestamp + policy.changeDelay);
        emergencyRequest = EmergencyRequest({recipient: recipient, amount: amount, executableAt: executableAt});
        emit EmergencyWithdrawalScheduled(recipient, amount, executableAt);
    }

    function cancelEmergencyWithdrawal() external onlyOwner {
        if (emergencyRequest.executableAt == 0) revert NoPendingChange();
        delete emergencyRequest;
        emit EmergencyWithdrawalCancelled();
    }

    function executeEmergencyWithdrawal() external onlyOwner nonReentrant {
        EmergencyRequest memory request = emergencyRequest;
        if (request.executableAt == 0) revert NoPendingChange();
        if (block.timestamp < request.executableAt) revert ChangeNotReady(request.executableAt);
        if (request.amount > address(this).balance) revert InsufficientBalance();
        delete emergencyRequest;
        (bool success,) = request.recipient.call{value: request.amount}("");
        if (!success) revert TransferFailed();
        emit EmergencyWithdrawalExecuted(request.recipient, request.amount);
    }

    /// @notice Delegates idle MON while preserving the configured liquid reserve.
    function stake(uint128 amount) external onlyOwner nonReentrant {
        if (!stakingEnabled) revert StakingDisabled();
        if (amount == 0) revert AmountIsZero();
        if (policy.validatorId == 0) revert InvalidValidator();
        if (amount > address(this).balance) revert InsufficientBalance();
        if (address(this).balance - amount < policy.minimumLiquidReserve) revert LiquidReserveBreached();

        bool success = staking.delegate{value: amount}(policy.validatorId);
        if (!success) revert StakingCallFailed();
        delegatedPrincipal += amount;
        emit StakeDelegated(policy.validatorId, amount, delegatedPrincipal);
    }

    /// @notice Starts Monad's native undelegation delay in a caller-selected slot.
    function requestUnstake(uint128 amount, uint8 withdrawId) external onlyOwner nonReentrant {
        if (!stakingEnabled) revert StakingDisabled();
        if (amount == 0) revert AmountIsZero();
        if (amount > delegatedPrincipal) revert InsufficientBalance();
        if (pendingUnstakeById[withdrawId] != 0) revert WithdrawalSlotInUse();

        bool success = staking.undelegate(policy.validatorId, amount, withdrawId);
        if (!success) revert StakingCallFailed();
        delegatedPrincipal -= amount;
        pendingUnstakeById[withdrawId] = amount;
        totalPendingUnstake += amount;
        emit UnstakeRequested(policy.validatorId, withdrawId, amount);
    }

    /// @notice Returns a matured undelegation to this vault's liquid balance.
    function completeUnstake(uint8 withdrawId) external onlyOwner nonReentrant {
        if (!stakingEnabled) revert StakingDisabled();
        uint256 expected = pendingUnstakeById[withdrawId];
        if (expected == 0) revert NoPendingChange();

        uint256 balanceBefore = address(this).balance;
        bool success = staking.withdraw(policy.validatorId, withdrawId);
        if (!success) revert StakingCallFailed();
        uint256 received = address(this).balance - balanceBefore;

        delete pendingUnstakeById[withdrawId];
        totalPendingUnstake -= expected;
        emit UnstakeCompleted(policy.validatorId, withdrawId, received);
    }

    /// @notice Claims validator rewards into the protected liquid balance.
    function claimRewards() external onlyOwner nonReentrant {
        if (!stakingEnabled) revert StakingDisabled();
        uint256 balanceBefore = address(this).balance;
        bool success = staking.claimRewards(policy.validatorId);
        if (!success) revert StakingCallFailed();
        emit RewardsClaimed(policy.validatorId, address(this).balance - balanceBefore);
    }

    function availableToday() external view returns (uint256) {
        uint256 spent = spentByDay[block.timestamp / 1 days];
        uint256 allowance = spent >= policy.dailyLimit ? 0 : policy.dailyLimit - spent;
        uint256 liquidExcess = address(this).balance > policy.minimumLiquidReserve
            ? address(this).balance - policy.minimumLiquidReserve
            : 0;
        return allowance < liquidExcess ? allowance : liquidExcess;
    }

    function recipientReadyAt(address recipient) external view returns (uint256) {
        if (trustedRecipient[recipient]) return block.timestamp;
        uint64 registeredAt = recipientRegisteredAt[recipient];
        return registeredAt == 0 ? 0 : uint256(registeredAt) + policy.recipientCooldown;
    }

    function _validatePolicy(Policy memory candidate) private pure {
        if (
            candidate.perTransactionLimit == 0 || candidate.dailyLimit < candidate.perTransactionLimit
                || candidate.minimumLiquidReserve == 0 || candidate.validatorId == 0
                || candidate.recipientCooldown < 1 minutes || candidate.changeDelay < 1 hours
        ) revert InvalidPolicy();
    }
}
