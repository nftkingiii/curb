const policyComponents = [
  { name: 'perTransactionLimit', type: 'uint128' },
  { name: 'dailyLimit', type: 'uint128' },
  { name: 'minimumLiquidReserve', type: 'uint128' },
  { name: 'recipientCooldown', type: 'uint64' },
  { name: 'changeDelay', type: 'uint64' },
  { name: 'validatorId', type: 'uint64' },
] as const

export const factoryAbi = [
  { type: 'function', name: 'vaultOf', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ name: '', type: 'address' }] },
  { type: 'function', name: 'stakingEnabled', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'bool' }] },
  {
    type: 'function', name: 'createVault', stateMutability: 'nonpayable',
    inputs: [{ name: 'policy', type: 'tuple', components: policyComponents }],
    outputs: [{ name: 'vault', type: 'address' }],
  },
] as const

export const vaultAbi = [
  { type: 'function', name: 'policy', stateMutability: 'view', inputs: [], outputs: policyComponents },
  { type: 'function', name: 'availableToday', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'delegatedPrincipal', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'totalPendingUnstake', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'stakingEnabled', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'bool' }] },
  { type: 'function', name: 'deposit', stateMutability: 'payable', inputs: [], outputs: [] },
  { type: 'function', name: 'registerRecipient', stateMutability: 'nonpayable', inputs: [{ name: 'recipient', type: 'address' }], outputs: [] },
  { type: 'function', name: 'withdraw', stateMutability: 'nonpayable', inputs: [{ name: 'recipient', type: 'address' }, { name: 'amount', type: 'uint128' }], outputs: [] },
  { type: 'function', name: 'stake', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint128' }], outputs: [] },
  { type: 'function', name: 'requestUnstake', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint128' }, { name: 'withdrawId', type: 'uint8' }], outputs: [] },
  { type: 'function', name: 'completeUnstake', stateMutability: 'nonpayable', inputs: [{ name: 'withdrawId', type: 'uint8' }], outputs: [] },
  { type: 'function', name: 'claimRewards', stateMutability: 'nonpayable', inputs: [], outputs: [] },
] as const
