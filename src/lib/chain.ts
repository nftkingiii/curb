import { defineChain, type Address } from 'viem'

export const monadMainnet = defineChain({
  id: 143,
  name: 'Monad Mainnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.monad.xyz'] } },
  blockExplorers: { default: { name: 'MonadVision', url: 'https://monadvision.com' } },
})

export const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: ['https://testnet-rpc.monad.xyz'] } },
  blockExplorers: { default: { name: 'MonadVision', url: 'https://testnet.monadvision.com' } },
  testnet: true,
})

export const supportedChains = [monadTestnet, monadMainnet] as const
export type SupportedChain = (typeof supportedChains)[number]

export function getChain(chainId: number): SupportedChain {
  return supportedChains.find((chain) => chain.id === chainId) ?? monadTestnet
}

const factories: Partial<Record<number, Address>> = {
  [monadTestnet.id]: (import.meta.env.VITE_TESTNET_FACTORY_ADDRESS || import.meta.env.VITE_FACTORY_ADDRESS) as Address | undefined,
  [monadMainnet.id]: import.meta.env.VITE_MAINNET_FACTORY_ADDRESS as Address | undefined,
}

export function getFactoryAddress(chainId: number) {
  const address = factories[chainId]
  return address && address !== '0x0000000000000000000000000000000000000000' ? address : undefined
}
