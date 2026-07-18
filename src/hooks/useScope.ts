import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPublicClient, decodeFunctionResult, encodeFunctionData, formatEther, http, type Address, type Chain } from 'viem'
import { stakingPrecompile, stakingReaderAbi } from '../lib/scope'

export type NativePosition = {
  source: 'Wallet' | 'Curb vault'
  delegator: Address
  validatorId: number
  validatorAddress: Address
  active: string
  pending: string
  rewards: string
  activationEpoch: number
}

export function useScope(account: Address | undefined, vault: Address | undefined, chain: Chain) {
  const [positions, setPositions] = useState<NativePosition[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  const client = useMemo(() => createPublicClient({ chain, transport: http() }), [chain])

  const callStaking = useCallback(async <TName extends 'getDelegations' | 'getDelegator' | 'getValidator'>(functionName: TName, args: readonly unknown[]) => {
    const data = encodeFunctionData({ abi: stakingReaderAbi, functionName, args } as never)
    const result = await client.call({ to: stakingPrecompile, data })
    if (!result.data) throw new Error('Monad staking precompile returned no data.')
    return decodeFunctionResult({ abi: stakingReaderAbi, functionName, data: result.data } as never) as unknown
  }, [client])

  const readDelegator = useCallback(async (delegator: Address, source: NativePosition['source']) => {
    const validatorIds: bigint[] = []
    let cursor = 0n
    for (let page = 0; page < 5; page += 1) {
      const [done, next, ids] = await callStaking('getDelegations', [delegator, cursor]) as [boolean, bigint, bigint[]]
      validatorIds.push(...ids)
      if (done) break
      cursor = next
    }
    return Promise.all(validatorIds.map(async (id) => {
      const [delegatorState, validatorState] = await Promise.all([
        callStaking('getDelegator', [id, delegator]) as Promise<[bigint, bigint, bigint, bigint, bigint, bigint, bigint]>,
        callStaking('getValidator', [id]) as Promise<[Address, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, `0x${string}`, `0x${string}`]>,
      ])
      const [stake,, rewards, deltaStake, nextDeltaStake, deltaEpoch, nextDeltaEpoch] = delegatorState
      return {
        source, delegator, validatorId: Number(id), validatorAddress: validatorState[0],
        active: formatEther(stake), pending: formatEther(deltaStake + nextDeltaStake),
        rewards: formatEther(rewards), activationEpoch: Number(nextDeltaEpoch || deltaEpoch),
      } satisfies NativePosition
    }))
  }, [callStaking])

  const refresh = useCallback(async () => {
    if (!account) { setPositions([]); return }
    setLoading(true); setError(undefined)
    try {
      const sources: Promise<NativePosition[]>[] = [readDelegator(account, 'Wallet')]
      if (vault) sources.push(readDelegator(vault, 'Curb vault'))
      setPositions((await Promise.all(sources)).flat())
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not read native staking positions.')
    } finally { setLoading(false) }
  }, [account, vault, readDelegator])

  useEffect(() => { void refresh() }, [refresh])
  const totals = positions.reduce((sum, item) => ({ active: sum.active + Number(item.active), pending: sum.pending + Number(item.pending), rewards: sum.rewards + Number(item.rewards) }), { active: 0, pending: 0, rewards: 0 })
  return { positions, totals, loading, error, refresh }
}
