import { useState, type FormEvent } from 'react'
import { ArrowDownToLine, ArrowUpRight, Check, ChevronRight, CircleAlert, Clock3, Coins, ExternalLink, Fingerprint, Gauge, LoaderCircle, LockKeyhole, Menu, ShieldCheck, UserRoundCheck, WalletCards, X } from 'lucide-react'
import { isAddress, type Address } from 'viem'
import { monadMainnet, monadTestnet } from './lib/chain'
import { useCurb } from './hooks/useCurb'

type Action = 'deposit' | 'send' | 'recipient' | 'stake' | 'unstake' | 'complete' | null

export function App() {
  const curb = useCurb()
  const [action, setAction] = useState<Action>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const connected = Boolean(curb.account)
  const wrongChain = connected && curb.chainId !== curb.targetChainId
  const hasVault = Boolean(curb.vaultAddress)
  const explorer = curb.targetChain.blockExplorers.default.url

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#top" aria-label="Curb home"><span className="brand-mark"><span /></span><span>Curb</span></a>
      <nav className={mobileOpen ? 'nav-links open' : 'nav-links'} aria-label="Primary navigation"><a className="active" href="#overview">Overview</a><a href="#yield">Yield</a><a href="#rules">Rules</a><a href="#about">How it works</a></nav>
      <div className="header-actions">
        <select className="network-select" aria-label="Network" value={curb.targetChainId} onChange={(e) => void curb.selectNetwork(Number(e.target.value))}><option value={monadTestnet.id}>Monad testnet</option><option value={monadMainnet.id}>Monad mainnet</option></select>
        <WalletButton connected={connected} account={curb.account} onClick={curb.connect} />
        <button className="menu-button" onClick={() => setMobileOpen((v) => !v)} aria-label="Toggle menu">{mobileOpen ? <X size={21} /> : <Menu size={21} />}</button>
      </div>
    </header>

    <main id="top">
      {!curb.configured && <SetupNotice network={curb.targetChain.name} />}
      {curb.targetChainId === monadMainnet.id && <div className="alert warning"><CircleAlert size={18} /><span>Mainnet uses real MON. Start with a small canary vault; staking should remain disabled until the deployment is reviewed.</span></div>}
      {wrongChain && <div className="alert warning"><CircleAlert size={18} /><span>Your wallet is not on {curb.targetChain.name}.</span><button onClick={() => void curb.switchNetwork()}>Switch network</button></div>}

      <section className="hero" id="overview"><div><p className="eyebrow"><ShieldCheck size={15} /> Spending firewall active</p><h1>Your money.<br /><em>With boundaries.</em></h1><p className="hero-copy">Curb separates spendable MON from MON earning native staking rewards. Both remain inside rules enforced onchain.</p></div><div className="hero-meta"><p>Vault status</p><strong>{hasVault ? 'Protected' : connected ? 'Not created' : 'Connect wallet'}</strong><span className={hasVault ? 'status-dot live' : 'status-dot'}>{hasVault ? `Policy enforced on ${curb.targetChain.name}` : 'No active vault detected'}</span></div></section>

      {!connected ? <ConnectPanel onConnect={curb.connect} network={curb.targetChain.name} chainId={curb.targetChain.id} /> : !hasVault ? <CreateVaultPanel disabled={!curb.configured} onCreate={curb.createVault} /> : <>
        <section className="balance-grid" aria-label="Vault overview">
          <article className="balance-card primary-card"><div className="card-label"><WalletCards size={17} /> Liquid balance</div><p className="balance-value">{fmt(curb.balance)} <span>MON</span></p><div className="balance-actions"><button className="button primary" onClick={() => setAction('deposit')}><ArrowDownToLine size={17} /> Deposit</button><button className="button secondary" onClick={() => setAction('send')}><ArrowUpRight size={17} /> Send safely</button></div></article>
          <article className="balance-card allowance-card"><div className="card-label"><Gauge size={17} /> Available today</div><p className="allowance-value">{fmt(curb.available)} <span>MON</span></p><div className="meter"><span style={{ width: `${percent(curb.available, curb.policy.daily)}%` }} /></div><p className="supporting">Reserve floor: {fmt(curb.policy.reserve)} MON</p></article>
        </section>

        <section className="yield-panel" id="yield">
          <div className="yield-copy"><p className="section-kicker">Native MON staking</p><h2>Put idle funds to work—without making them spendable.</h2><p>Delegation goes directly through Monad’s staking precompile. Curb keeps your configured liquid reserve untouched.</p><div className="yield-stats"><span><small>Earning</small><strong>{fmt(curb.delegated)} MON</strong></span><span><small>Unstaking</small><strong>{fmt(curb.pendingUnstake)} MON</strong></span><span><small>Validator</small><strong>#{curb.policy.validatorId}</strong></span></div></div>
          <div className="yield-actions">{curb.stakingEnabled ? <><button className="button primary" onClick={() => setAction('stake')}><Coins size={17} /> Stake idle MON</button><button className="button secondary" onClick={() => setAction('unstake')}>Begin unstake</button><button className="text-button" onClick={() => setAction('complete')}>Complete matured unstake</button><button className="text-button" onClick={() => void curb.claimRewards()}>Claim rewards</button></> : <div className="staking-off"><LockKeyhole size={21} /><strong>Staking is deployment-gated</strong><p>This factory was launched with yield disabled. Spending protection remains fully active.</p></div>}</div>
        </section>

        <section className="section-block" id="rules"><div className="section-heading"><div><p className="section-kicker">Your guardrails</p><h2>Rules stand between you and a drain.</h2></div></div><div className="rules-grid"><Rule icon={<Gauge />} name="Per transaction" value={`${fmt(curb.policy.perTx)} MON`} note="Hard ceiling for every transfer" tone="ink" /><Rule icon={<Clock3 />} name="Daily allowance" value={`${fmt(curb.policy.daily)} MON`} note="Resets every 24 hours" tone="violet" /><Rule icon={<UserRoundCheck />} name="New recipients" value={`${curb.policy.cooldownHours}h delay`} note="Time to catch a poisoned address" tone="amber" /><Rule icon={<LockKeyhole />} name="Rule changes" value={`${curb.policy.changeDelayHours}h delay`} note="No instant security downgrade" tone="green" /></div></section>

        <section className="two-column"><article className="panel"><div className="panel-heading"><div><p className="section-kicker">Recent activity</p><h2>Vault events</h2></div><span className="live-label"><span /> Live</span></div><div className="empty-state"><span className="empty-icon"><Fingerprint size={24} /></span><h3>Onchain by design</h3><p>Deposits, withdrawals, and staking actions are emitted by your vault contract.</p></div></article><article className="panel safety-panel"><p className="section-kicker">Safety posture</p><h2>Yield cannot bypass liquidity rules.</h2><ul><li><Check size={16} /> Mandatory liquid reserve</li><li><Check size={16} /> No arbitrary adapters or approvals</li><li><Check size={16} /> Validator locked while stake is active</li><li><Check size={16} /> Unstaking uses explicit withdrawal slots</li></ul><a href={`${explorer}/address/${curb.vaultAddress}`} target="_blank" rel="noreferrer">Inspect vault contract <ExternalLink size={14} /></a></article></section>
      </>}

      <section className="how-it-works" id="about"><p className="section-kicker">How Curb protects you</p><div className="steps"><div><span>01</span><h3>Park funds</h3><p>Move MON into your personal vault.</p></div><div><span>02</span><h3>Set boundaries</h3><p>Choose spending caps, reserve, and delays.</p></div><div><span>03</span><h3>Earn deliberately</h3><p>Delegate only the balance above your reserve.</p></div></div></section>
    </main>

    <footer><div className="brand"><span className="brand-mark"><span /></span><span>Curb</span></div><p>Self-custodial spending boundaries on Monad.</p>{curb.factoryAddress && <a href={`${explorer}/address/${curb.factoryAddress}`} target="_blank" rel="noreferrer">Factory contract <ExternalLink size={13} /></a>}</footer>
    {action && curb.vaultAddress && <ActionDialog action={action} close={() => setAction(null)} curb={curb} />}
    <TransactionToast tx={curb.tx} explorer={explorer} />
    {curb.loading && <div className="sync-indicator"><LoaderCircle className="spin" size={14} /> Syncing vault</div>}
  </div>
}

function WalletButton({ connected, account, onClick }: { connected: boolean; account?: Address; onClick: () => void }) { return <button className="wallet-button" onClick={onClick}><WalletCards size={17} /> {connected && account ? `${account.slice(0, 6)}…${account.slice(-4)}` : 'Connect wallet'}</button> }
function SetupNotice({ network }: { network: string }) { return <div className="alert setup"><CircleAlert size={18} /><span>{network} factory is not configured in this build.</span></div> }
function ConnectPanel({ onConnect, network, chainId }: { onConnect: () => void; network: string; chainId: number }) { return <section className="onboarding-card"><div className="onboarding-icon"><LockKeyhole size={30} /></div><p className="section-kicker">Start with ownership</p><h2>Connect the wallet you want to protect.</h2><p>Curb never asks for your seed phrase or blanket token approvals.</p><button className="button primary large" onClick={onConnect}><WalletCards size={18} /> Connect wallet</button><span>{network} · Chain ID {chainId}</span></section> }

function CreateVaultPanel({ disabled, onCreate }: { disabled: boolean; onCreate: (a: string, b: string, c: string, d: number, e: number, f: number) => void }) {
  const [values, setValues] = useState({ perTx: '1', daily: '3', reserve: '1', cooldown: '24', delay: '48', validator: '1' })
  const field = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => setValues({ ...values, [key]: e.target.value })
  return <section className="create-panel"><div><p className="section-kicker">Create your boundary</p><h2>Set the rules before funds arrive.</h2><p>The reserve always stays liquid. Validator changes require exiting every active staking position first.</p></div><form onSubmit={(e) => { e.preventDefault(); onCreate(values.perTx, values.daily, values.reserve, Number(values.cooldown), Number(values.delay), Number(values.validator)) }}><label>Per-transaction cap<Input value={values.perTx} onChange={field('perTx')} unit="MON" /></label><label>Daily allowance<Input value={values.daily} onChange={field('daily')} unit="MON" /></label><label>Minimum liquid reserve<Input value={values.reserve} onChange={field('reserve')} unit="MON" /></label><label>Validator ID<Input value={values.validator} onChange={field('validator')} unit="#" integer /></label><label>New-recipient delay<Input value={values.cooldown} onChange={field('cooldown')} unit="hours" integer /></label><label>Rule-change delay<Input value={values.delay} onChange={field('delay')} unit="hours" integer /></label><button className="button primary large" disabled={disabled}>Create protected vault <ChevronRight size={18} /></button></form></section>
}

function Input({ value, onChange, unit, integer }: { value: string; onChange: React.ChangeEventHandler<HTMLInputElement>; unit: string; integer?: boolean }) { return <div className="input-unit"><input type="number" min={integer ? '1' : '0.000001'} step={integer ? '1' : 'any'} value={value} onChange={onChange} required /><span>{unit}</span></div> }
function Rule({ icon, name, value, note, tone }: { icon: React.ReactNode; name: string; value: string; note: string; tone: string }) { return <article className="rule-card"><span className={`rule-icon ${tone}`}>{icon}</span><p>{name}</p><strong>{value}</strong><small>{note}</small></article> }

function ActionDialog({ action, close, curb }: { action: Exclude<Action, null>; close: () => void; curb: ReturnType<typeof useCurb> }) {
  const [amount, setAmount] = useState(''); const [recipient, setRecipient] = useState(''); const [slot, setSlot] = useState('0'); const [error, setError] = useState('')
  const titles = { deposit: 'Deposit into Curb', send: 'Protected withdrawal', recipient: 'Register recipient', stake: 'Stake idle MON', unstake: 'Begin unstake', complete: 'Complete unstake' }
  const submit = (e: FormEvent) => { e.preventDefault(); if ((action === 'send' || action === 'recipient') && !isAddress(recipient)) return setError('Enter a valid EVM address.'); if (action === 'deposit') void curb.deposit(amount); if (action === 'send') void curb.withdraw(recipient as Address, amount); if (action === 'recipient') void curb.registerRecipient(recipient as Address); if (action === 'stake') void curb.stake(amount); if (action === 'unstake') void curb.requestUnstake(amount, Number(slot)); if (action === 'complete') void curb.completeUnstake(Number(slot)); close() }
  return <div className="dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close() }}><section className="dialog" role="dialog" aria-modal="true"><button className="dialog-close" onClick={close}><X size={20} /></button><p className="section-kicker">Onchain action</p><h2>{titles[action]}</h2><p>{action === 'stake' ? `Curb will preserve your ${fmt(curb.policy.reserve)} MON liquid reserve.` : action === 'unstake' || action === 'complete' ? 'Withdrawal slots let multiple unstaking requests mature independently.' : 'Your vault contract will enforce every active rule.'}</p><form onSubmit={submit}>{(action === 'send' || action === 'recipient') && <label>Recipient address<input value={recipient} onChange={(e) => { setRecipient(e.target.value); setError('') }} placeholder="0x…" /></label>}{!['recipient', 'complete'].includes(action) && <label>Amount<Input value={amount} onChange={(e) => setAmount(e.target.value)} unit="MON" /></label>}{(action === 'unstake' || action === 'complete') && <label>Withdrawal slot<Input value={slot} onChange={(e) => setSlot(e.target.value)} unit="0–255" integer /></label>}{error && <p className="form-error">{error}</p>}<button className="button primary large">Confirm action <ChevronRight size={18} /></button></form></section></div>
}

function TransactionToast({ tx, explorer }: { tx: ReturnType<typeof useCurb>['tx']; explorer: string }) { if (tx.kind === 'idle') return null; return <div className={`tx-toast ${tx.kind}`} role="status">{tx.kind === 'pending' ? <LoaderCircle className="spin" size={18} /> : tx.kind === 'success' ? <Check size={18} /> : <CircleAlert size={18} />}<div><strong>{tx.kind === 'pending' ? 'Transaction pending' : tx.kind === 'success' ? 'Confirmed' : 'Action stopped'}</strong><p>{tx.message}</p>{tx.kind === 'success' && <a href={`${explorer}/tx/${tx.hash}`} target="_blank" rel="noreferrer">View transaction <ExternalLink size={12} /></a>}</div></div> }
function fmt(value: string) { const n = Number(value); return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 }) : '0.00' }
function percent(value: string, max: string) { return Number(max) > 0 ? Math.min(100, Number(value) / Number(max) * 100) : 0 }
