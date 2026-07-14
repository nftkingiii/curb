// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {CurbVault} from "./CurbVault.sol";

contract CurbFactory {
    error VaultAlreadyExists();

    mapping(address => address) public vaultOf;
    address public immutable staking;
    bool public immutable stakingEnabled;
    event VaultCreated(address indexed owner, address indexed vault);

    constructor(address staking_, bool stakingEnabled_) {
        staking = staking_;
        stakingEnabled = stakingEnabled_;
    }

    function createVault(CurbVault.Policy calldata policy) external returns (address vault) {
        if (vaultOf[msg.sender] != address(0)) revert VaultAlreadyExists();
        vault = address(new CurbVault(msg.sender, policy, staking, stakingEnabled));
        vaultOf[msg.sender] = vault;
        emit VaultCreated(msg.sender, vault);
    }
}
