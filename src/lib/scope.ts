import type { Address } from 'viem'

export const stakingPrecompile = '0x0000000000000000000000000000000000001000' as Address

export const stakingReaderAbi = [
  {
    type: 'function', name: 'getDelegations', stateMutability: 'nonpayable',
    inputs: [{ name: 'delegator', type: 'address' }, { name: 'startValId', type: 'uint64' }],
    outputs: [{ name: 'isDone', type: 'bool' }, { name: 'nextValId', type: 'uint64' }, { name: 'valIds', type: 'uint64[]' }],
  },
  {
    type: 'function', name: 'getDelegator', stateMutability: 'nonpayable',
    inputs: [{ name: 'validatorId', type: 'uint64' }, { name: 'delegator', type: 'address' }],
    outputs: [
      { name: 'stake', type: 'uint256' }, { name: 'accRewardPerToken', type: 'uint256' },
      { name: 'unclaimedRewards', type: 'uint256' }, { name: 'deltaStake', type: 'uint256' },
      { name: 'nextDeltaStake', type: 'uint256' }, { name: 'deltaEpoch', type: 'uint64' },
      { name: 'nextDeltaEpoch', type: 'uint64' },
    ],
  },
  {
    type: 'function', name: 'getValidator', stateMutability: 'nonpayable',
    inputs: [{ name: 'validatorId', type: 'uint64' }],
    outputs: [
      { name: 'authAddress', type: 'address' }, { name: 'flags', type: 'uint64' },
      { name: 'stake', type: 'uint256' }, { name: 'accRewardPerToken', type: 'uint256' },
      { name: 'commission', type: 'uint256' }, { name: 'unclaimedRewards', type: 'uint256' },
      { name: 'consensusStake', type: 'uint256' }, { name: 'consensusCommission', type: 'uint256' },
      { name: 'snapshotStake', type: 'uint256' }, { name: 'snapshotCommission', type: 'uint256' },
      { name: 'secpPubkey', type: 'bytes' }, { name: 'blsPubkey', type: 'bytes' },
    ],
  },
] as const

export type YieldProtocol = {
  name: string
  asset: string
  apy: string
  apyKind: 'Observed' | 'Variable' | 'Unavailable'
  liquidity: string
  risk: 'Moderate' | 'Elevated'
  source: string
  url: string
}

// Read-only, dated market observations. These are never used for execution or promises of return.
export const yieldDirectory: YieldProtocol[] = [
  { name: 'Magma', asset: 'gMON', apy: '11.4%', apyKind: 'Observed', liquidity: 'Liquid LST', risk: 'Moderate', source: 'DeFiLlama · 15 Jul 2026', url: 'https://www.magmastaking.pro/' },
  { name: 'shMonad', asset: 'shMON', apy: 'Variable', apyKind: 'Variable', liquidity: 'Instant fee / ~24h', risk: 'Moderate', source: 'Protocol docs · variable', url: 'https://docs.shmonad.xyz/' },
  { name: 'Kintsu', asset: 'sMON', apy: 'Not published', apyKind: 'Unavailable', liquidity: 'Liquid LST', risk: 'Moderate', source: 'Official site · 15 Jul 2026', url: 'https://kintsu.xyz/' },
  { name: 'aPriori', asset: 'aprMON', apy: 'Not published', apyKind: 'Unavailable', liquidity: 'Protocol redemption', risk: 'Elevated', source: 'Protocol docs · no current rate', url: 'https://www.apr.io/' },
]
