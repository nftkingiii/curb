import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPublicClient, createWalletClient, custom, formatEther, http, parseEther, type Abi, type Address, zeroAddress } from 'viem'
import { getChain, getFactoryAddress, monadTestnet } from '../lib/chain'
import { factoryAbi, vaultAbi } from '../lib/contracts'

type EthereumProvider = Parameters<typeof custom>[0] & {
  on?: (event: string, listener: (value: unknown) => void) => void
  removeListener?: (event: string, listener: (value: unknown) => void) => void
}
declare global { interface Window { ethereum?: EthereumProvider } }

export type TransactionState =
  | { kind: 'idle'; message: string }
  | { kind: 'pending'; message: string }
  | { kind: 'success'; message: string; hash: `0x${string}` }
  | { kind: 'error'; message: string }

type ContractWriteRequest = { address: Address; abi: Abi | readonly unknown[]; functionName: string; args?: readonly unknown[]; value?: bigint }

export function useCurb() {
  const [account, setAccount] = useState<Address>()
  const [chainId, setChainId] = useState<number>()
  const [targetChainId, setTargetChainId] = useState<number>(monadTestnet.id)
  const [vaultAddress, setVaultAddress] = useState<Address>()
  const [balance, setBalance] = useState('0')
  const [available, setAvailable] = useState('0')
  const [delegated, setDelegated] = useState('0')
  const [pendingUnstake, setPendingUnstake] = useState('0')
  const [stakingEnabled, setStakingEnabled] = useState(false)
  const [policy, setPolicy] = useState({ perTx: '0', daily: '0', reserve: '0', cooldownHours: 0, changeDelayHours: 0, validatorId: 0 })
  const [tx, setTx] = useState<TransactionState>({ kind: 'idle', message: 'No transaction in progress.' })
  const [loading, setLoading] = useState(false)

  const targetChain = useMemo(() => getChain(targetChainId), [targetChainId])
  const factoryAddress = getFactoryAddress(targetChainId)
  const publicClient = useMemo(() => createPublicClient({ chain: targetChain, transport: http() }), [targetChain])
  const walletClient = useMemo(() => window.ethereum ? createWalletClient({ chain: targetChain, transport: custom(window.ethereum) }) : undefined, [targetChain])

  const syncWallet = useCallback(async () => {
    if (!window.ethereum) return
    const [accounts, currentChain] = await Promise.all([
      window.ethereum.request({ method: 'eth_accounts' }) as Promise<Address[]>,
      window.ethereum.request({ method: 'eth_chainId' }) as Promise<string>,
    ])
    setAccount(accounts[0]); setChainId(Number.parseInt(currentChain, 16))
  }, [])

  const refreshVault = useCallback(async () => {
    if (!account || !factoryAddress) { setVaultAddress(undefined); return }
    setLoading(true)
    try {
      const found = await publicClient.readContract({ address: factoryAddress, abi: factoryAbi, functionName: 'vaultOf', args: [account] })
      if (found === zeroAddress) { setVaultAddress(undefined); setStakingEnabled(await publicClient.readContract({ address: factoryAddress, abi: factoryAbi, functionName: 'stakingEnabled' })); return }
      setVaultAddress(found)
      const [rawBalance, rawAvailable, rawPolicy, rawDelegated, rawPending, enabled] = await Promise.all([
        publicClient.getBalance({ address: found }),
        publicClient.readContract({ address: found, abi: vaultAbi, functionName: 'availableToday' }),
        publicClient.readContract({ address: found, abi: vaultAbi, functionName: 'policy' }),
        publicClient.readContract({ address: found, abi: vaultAbi, functionName: 'delegatedPrincipal' }),
        publicClient.readContract({ address: found, abi: vaultAbi, functionName: 'totalPendingUnstake' }),
        publicClient.readContract({ address: found, abi: vaultAbi, functionName: 'stakingEnabled' }),
      ])
      setBalance(formatEther(rawBalance)); setAvailable(formatEther(rawAvailable)); setDelegated(formatEther(rawDelegated)); setPendingUnstake(formatEther(rawPending)); setStakingEnabled(enabled)
      setPolicy({ perTx: formatEther(rawPolicy[0]), daily: formatEther(rawPolicy[1]), reserve: formatEther(rawPolicy[2]), cooldownHours: Number(rawPolicy[3]) / 3600, changeDelayHours: Number(rawPolicy[4]) / 3600, validatorId: Number(rawPolicy[5]) })
    } catch { setVaultAddress(undefined) } finally { setLoading(false) }
  }, [account, factoryAddress, publicClient])

  useEffect(() => { void syncWallet() }, [syncWallet])
  useEffect(() => { void refreshVault() }, [refreshVault])
  useEffect(() => {
    if (!window.ethereum) return
    const changed = (hex: unknown) => setChainId(Number.parseInt(String(hex), 16))
    window.ethereum.on?.('chainChanged', changed)
    return () => window.ethereum?.removeListener?.('chainChanged', changed)
  }, [])

  const switchNetwork = async (nextId = targetChainId) => {
    if (!window.ethereum) return
    const chain = getChain(nextId)
    try {
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: `0x${chain.id.toString(16)}` }] })
    } catch {
      await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [{ chainId: `0x${chain.id.toString(16)}`, chainName: chain.name, nativeCurrency: chain.nativeCurrency, rpcUrls: chain.rpcUrls.default.http, blockExplorerUrls: [chain.blockExplorers.default.url] }] })
    }
    setChainId(chain.id)
  }

  const selectNetwork = async (nextId: number) => { setTargetChainId(nextId); setVaultAddress(undefined); if (account) await switchNetwork(nextId) }
  const connect = async () => {
    if (!walletClient) return setTx({ kind: 'error', message: 'No injected wallet found. Install MetaMask or another EVM wallet.' })
    try { const [connected] = await walletClient.requestAddresses(); setAccount(connected); await switchNetwork() }
    catch (error) { setTx({ kind: 'error', message: getErrorMessage(error, 'Wallet connection was rejected.') }) }
  }

  const write = async (label: string, request: ContractWriteRequest) => {
    if (!walletClient || !account) return
    if (chainId !== targetChain.id) await switchNetwork()
    setTx({ kind: 'pending', message: `${label} — confirm in your wallet.` })
    try {
      const hash = await walletClient.writeContract({ ...request, account, chain: targetChain } as Parameters<typeof walletClient.writeContract>[0])
      setTx({ kind: 'pending', message: `${label} — waiting for confirmation.` })
      await publicClient.waitForTransactionReceipt({ hash }); setTx({ kind: 'success', message: `${label} confirmed.`, hash }); await refreshVault()
    } catch (error) { setTx({ kind: 'error', message: getErrorMessage(error, `${label} failed or was rejected.`) }) }
  }

  const createVault = (perTx: string, daily: string, reserve: string, cooldownHours: number, changeDelayHours: number, validatorId: number) => {
    if (!factoryAddress) { setTx({ kind: 'error', message: `Factory is not configured on ${targetChain.name}.` }); return }
    return write('Create vault', { address: factoryAddress, abi: factoryAbi, functionName: 'createVault', args: [{ perTransactionLimit: parseEther(perTx), dailyLimit: parseEther(daily), minimumLiquidReserve: parseEther(reserve), recipientCooldown: BigInt(cooldownHours * 3600), changeDelay: BigInt(changeDelayHours * 3600), validatorId: BigInt(validatorId) }] })
  }
  const deposit = (amount: string) => vaultAddress && write('Deposit', { address: vaultAddress, abi: vaultAbi, functionName: 'deposit', value: parseEther(amount) })
  const registerRecipient = (recipient: Address) => vaultAddress && write('Register recipient', { address: vaultAddress, abi: vaultAbi, functionName: 'registerRecipient', args: [recipient] })
  const withdraw = (recipient: Address, amount: string) => vaultAddress && write('Protected withdrawal', { address: vaultAddress, abi: vaultAbi, functionName: 'withdraw', args: [recipient, parseEther(amount)] })
  const stake = (amount: string) => vaultAddress && write('Delegate MON', { address: vaultAddress, abi: vaultAbi, functionName: 'stake', args: [parseEther(amount)] })
  const requestUnstake = (amount: string, withdrawId: number) => vaultAddress && write('Begin unstake', { address: vaultAddress, abi: vaultAbi, functionName: 'requestUnstake', args: [parseEther(amount), withdrawId] })
  const completeUnstake = (withdrawId: number) => vaultAddress && write('Complete unstake', { address: vaultAddress, abi: vaultAbi, functionName: 'completeUnstake', args: [withdrawId] })
  const claimRewards = () => vaultAddress && write('Claim rewards', { address: vaultAddress, abi: vaultAbi, functionName: 'claimRewards' })

  return { account, chainId, targetChain, targetChainId, factoryAddress, vaultAddress, balance, available, delegated, pendingUnstake, stakingEnabled, policy, tx, loading, configured: Boolean(factoryAddress), connect, switchNetwork, selectNetwork, createVault, deposit, registerRecipient, withdraw, stake, requestUnstake, completeUnstake, claimRewards }
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) { const firstLine = error.message.split('\n')[0]; return firstLine.length > 150 ? fallback : firstLine }
  return fallback
}
