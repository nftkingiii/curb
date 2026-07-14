// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {CurbVault} from "../src/CurbVault.sol";
import {CurbFactory} from "../src/CurbFactory.sol";
import {MockMonadStaking} from "./mocks/MockMonadStaking.sol";

interface Vm {
    function deal(address who, uint256 newBalance) external;
    function prank(address sender) external;
    function warp(uint256 timestamp) external;
    function expectPartialRevert(bytes4 selector) external;
}

contract CurbVaultTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant OWNER = address(0xA11CE);
    address payable private constant RECIPIENT = payable(address(0xB0B));

    CurbVault private vault;
    MockMonadStaking private staking;

    function setUp() public {
        staking = new MockMonadStaking();
        CurbVault.Policy memory policy = defaultPolicy();
        vault = new CurbVault(OWNER, policy, address(staking), true);
        vm.deal(address(vault), 10 ether);
    }

    function defaultPolicy() private pure returns (CurbVault.Policy memory) {
        return CurbVault.Policy({
            perTransactionLimit: 1 ether,
            dailyLimit: 2 ether,
            minimumLiquidReserve: 1 ether,
            recipientCooldown: 1 days,
            changeDelay: 2 days,
            validatorId: 1
        });
    }

    function testRecipientCooldownAndWithdrawal() public {
        vm.prank(OWNER);
        vault.registerRecipient(RECIPIENT);

        vm.prank(OWNER);
        vm.expectPartialRevert(CurbVault.RecipientNotReady.selector);
        vault.withdraw(RECIPIENT, 1 ether);

        vm.warp(block.timestamp + 1 days);
        vm.prank(OWNER);
        vault.withdraw(RECIPIENT, 1 ether);

        require(RECIPIENT.balance == 1 ether, "recipient not paid");
        require(vault.availableToday() == 1 ether, "daily allowance wrong");
    }

    function testPerTransactionAndDailyLimits() public {
        vm.prank(OWNER);
        vault.registerRecipient(RECIPIENT);
        vm.warp(block.timestamp + 1 days);

        vm.prank(OWNER);
        vm.expectPartialRevert(CurbVault.PerTransactionLimitExceeded.selector);
        vault.withdraw(RECIPIENT, 2 ether);

        vm.prank(OWNER);
        vault.withdraw(RECIPIENT, 1 ether);
        vm.prank(OWNER);
        vault.withdraw(RECIPIENT, 1 ether);

        vm.prank(OWNER);
        vm.expectPartialRevert(CurbVault.DailyLimitExceeded.selector);
        vault.withdraw(RECIPIENT, 1 wei);
    }

    function testPolicyLooseningIsDelayed() public {
        CurbVault.Policy memory looser = CurbVault.Policy({
            perTransactionLimit: 5 ether,
            dailyLimit: 10 ether,
            minimumLiquidReserve: 1 ether,
            recipientCooldown: 1 minutes,
            changeDelay: 1 hours,
            validatorId: 1
        });
        vm.prank(OWNER);
        vault.proposePolicy(looser);

        vm.prank(OWNER);
        vm.expectPartialRevert(CurbVault.ChangeNotReady.selector);
        vault.applyPolicy();

        vm.warp(block.timestamp + 2 days);
        vm.prank(OWNER);
        vault.applyPolicy();

        (uint128 perTransactionLimit,,,,,) = vault.policy();
        require(perTransactionLimit == 5 ether, "policy not applied");
    }

    function testTrustedRecipientActivationIsDelayed() public {
        vm.prank(OWNER);
        vault.scheduleTrustedRecipient(RECIPIENT);

        vm.prank(OWNER);
        vm.expectPartialRevert(CurbVault.ChangeNotReady.selector);
        vault.activateTrustedRecipient(RECIPIENT);

        vm.warp(block.timestamp + 2 days);
        vm.prank(OWNER);
        vault.activateTrustedRecipient(RECIPIENT);
        require(vault.trustedRecipient(RECIPIENT), "recipient not trusted");
    }

    function testFactoryAllowsOneVaultPerOwner() public {
        CurbFactory factory = new CurbFactory(address(staking), true);
        CurbVault.Policy memory policy = defaultPolicy();
        vm.prank(OWNER);
        address created = factory.createVault(policy);
        require(factory.vaultOf(OWNER) == created, "factory mapping wrong");

        vm.prank(OWNER);
        vm.expectPartialRevert(CurbFactory.VaultAlreadyExists.selector);
        factory.createVault(policy);
    }

    function testStakePreservesLiquidReserve() public {
        vm.prank(OWNER);
        vault.stake(4 ether);
        require(vault.delegatedPrincipal() == 4 ether, "principal not tracked");
        require(staking.delegated(address(vault)) == 4 ether, "stake not delegated");
        require(address(vault).balance == 6 ether, "liquid balance wrong");

        vm.prank(OWNER);
        vm.expectPartialRevert(CurbVault.LiquidReserveBreached.selector);
        vault.stake(6 ether);
    }

    function testUnstakeRoundTrip() public {
        vm.prank(OWNER);
        vault.stake(4 ether);
        vm.prank(OWNER);
        vault.requestUnstake(2 ether, 7);
        require(vault.delegatedPrincipal() == 2 ether, "delegated not reduced");
        require(vault.totalPendingUnstake() == 2 ether, "pending not tracked");

        vm.prank(OWNER);
        vault.completeUnstake(7);
        require(address(vault).balance == 8 ether, "liquidity not returned");
        require(vault.totalPendingUnstake() == 0, "pending not cleared");
    }

    function testRewardsReturnToLiquidBalance() public {
        vm.deal(address(this), 1 ether);
        staking.fundRewards{value: 0.5 ether}(address(vault));
        vm.prank(OWNER);
        vault.claimRewards();
        require(address(vault).balance == 10.5 ether, "rewards not claimed");
    }

    function testValidatorCannotChangeWithActiveStake() public {
        vm.prank(OWNER);
        vault.stake(2 ether);
        CurbVault.Policy memory next = defaultPolicy();
        next.validatorId = 2;
        vm.prank(OWNER);
        vault.proposePolicy(next);
        vm.warp(block.timestamp + 2 days);
        vm.prank(OWNER);
        vm.expectPartialRevert(CurbVault.ActiveStakeExists.selector);
        vault.applyPolicy();
    }
}
