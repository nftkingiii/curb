// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract MockMonadStaking {
    mapping(address => uint256) public delegated;
    mapping(address => mapping(uint8 => uint256)) public pending;
    mapping(address => uint256) public rewards;

    function delegate(uint64) external payable returns (bool) {
        delegated[msg.sender] += msg.value;
        return true;
    }

    function undelegate(uint64, uint256 amount, uint8 withdrawId) external returns (bool) {
        require(delegated[msg.sender] >= amount, "insufficient delegation");
        require(pending[msg.sender][withdrawId] == 0, "slot in use");
        delegated[msg.sender] -= amount;
        pending[msg.sender][withdrawId] = amount;
        return true;
    }

    function withdraw(uint64, uint8 withdrawId) external returns (bool) {
        uint256 amount = pending[msg.sender][withdrawId];
        require(amount != 0, "nothing pending");
        delete pending[msg.sender][withdrawId];
        (bool success,) = payable(msg.sender).call{value: amount}("");
        require(success, "transfer failed");
        return true;
    }

    function claimRewards(uint64) external returns (bool) {
        uint256 amount = rewards[msg.sender];
        delete rewards[msg.sender];
        (bool success,) = payable(msg.sender).call{value: amount}("");
        require(success, "transfer failed");
        return true;
    }

    function fundRewards(address beneficiary) external payable {
        rewards[beneficiary] += msg.value;
    }
}
