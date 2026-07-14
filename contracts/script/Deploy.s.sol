// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {CurbFactory} from "../src/CurbFactory.sol";

interface Vm {
    function startBroadcast() external;
    function stopBroadcast() external;
    function envOr(string calldata name, bool defaultValue) external returns (bool value);
}

contract Deploy {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (CurbFactory factory) {
        vm.startBroadcast();
        bool enableStaking = vm.envOr("ENABLE_STAKING", false);
        factory = new CurbFactory(address(0x1000), enableStaking);
        vm.stopBroadcast();
    }
}
