import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowDownToLine, ArrowRight, ArrowUpRight, Check, ChevronRight, CircleAlert, Clock3, Coins, ExternalLink, Fingerprint, Gauge, Layers3, LoaderCircle, LockKeyhole, Menu, RefreshCw, ShieldCheck, UserRoundCheck, WalletCards, X } from 'lucide-react'
import { isAddress, type Address } from 'viem'
import { monadMainnet, monadTestnet } from './lib/chain'
import { useCurb } from './hooks/useCurb'
import { useScope } from './hooks/useScope'
import { yieldDirectory } from './lib/scope'
import curbHero from './assets/curb-spectrum-hero.png'

type Action = 'deposit' | 'send' | 'recipient' | 'stake' | 'unstake' | 'complete' | null

export function App() {
  const getScreen = () => window.location.hash === '#about' ? 'about' : window.location.hash ? 'vault' : 'landing'
  const [screen, setScreen] = useState(getScreen)
  useEffect(() => {
    const sync = () => setScreen(getScreen())
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  const openVault = () => { window.location.hash = 'vault'; window.scrollTo({ top: 0 }) }
  const openAbout = () => { window.location.hash = 'about'; window.scrollTo({ top: 0 }) }
  const openLanding = () => { window.location.hash = ''; window.scrollTo({ top: 0 }) }
  if (screen === 'vault') return <VaultApp onHome={openLanding} onAbout={openAbout} />
  if (screen === 'about') return <AboutPage onHome={openLanding} onEnter={openVault} />
  return <LandingPage onEnter={openVault} onAbout={openAbout} />
}

function LandingPage({ onEnter, onAbout }: { onEnter: () => void; onAbout: () => void }) {
  return <div className="calm-site">
    <SiteHeader onHome={() => window.scrollTo({ top: 0, behavior: 'smooth' })} onAbout={onAbout} onEnter={onEnter} />
    <main className="simple-landing">
      <section className="simple-copy">
        <span className="quiet-label">CURB / MONAD</span>
        <h1>Your money,<br /><em>with boundaries.</em></h1>
        <button className="spectrum-button" onClick={onEnter}>Open Curb <ArrowRight size={17} /></button>
      </section>
      <figure className="hero-art"><img src={curbHero} alt="A dark vault form beside a controlled spectrum of light" /></figure>
    </main>
    <footer className="calm-footer"><CurbLogo /><span>Built on Monad</span><a href="https://github.com/nftkingiii/curb" target="_blank" rel="noreferrer">Open source ↗</a></footer>
  </div>
}

function AboutPage({ onHome, onEnter }: { onHome: () => void; onEnter: () => void }) {
  return <div className="calm-site">
    <SiteHeader onHome={onHome} onAbout={() => window.scrollTo({ top: 0, behavior: 'smooth' })} onEnter={onEnter} aboutActive />
    <main className="about-main">
      <section className="about-intro">
        <span className="quiet-label">ABOUT CURB</span>
        <h1>A safer place for money that still needs to move.</h1>
        <p>Curb is a self-custodial Monad vault that turns personal security preferences into rules enforced onchain.</p>
      </section>
      <section className="about-feature-grid">
        <article><span>01</span><h2>Bounded spending</h2><p>Set per-transfer caps, daily limits, recipient cooldowns, and a protected liquid reserve. A compromised interface cannot silently bypass them.</p></article>
        <figure><img src={curbHero} alt="" /></figure>
        <article><span>02</span><h2>Protected yield</h2><p>Keep idle MON productive through native staking while preserving enough liquidity for normal use. Yield never gets to overrule the vault policy.</p></article>
        <article><span>03</span><h2>One staking view</h2><p>Scope shows delegated balances, validator exposure, pending activity, and comparable protocol opportunities in a single control panel.</p></article>
      </section>
      <section className="about-principles">
        <div><span className="quiet-label">THE SECURITY MODEL</span><h2>The vault does not trust the tab.</h2></div>
        <ol>
          <li><span>01</span><p><strong>Rules live onchain.</strong> Protection survives a phishing page or compromised frontend.</p></li>
          <li><span>02</span><p><strong>Relaxation takes time.</strong> Sensitive policy changes use a delay instead of an instant override.</p></li>
          <li><span>03</span><p><strong>Ownership stays with you.</strong> Curb coordinates spending and staking without taking custody.</p></li>
        </ol>
      </section>
      <section className="about-cta"><div><span className="quiet-label">YOUR KEYS / YOUR RULES</span><h2>Put a curb on risk.</h2></div><button className="spectrum-button" onClick={onEnter}>Open Curb <ArrowRight size={17} /></button></section>
    </main>
    <footer className="calm-footer"><CurbLogo /><span>Built on Monad</span><a href="https://github.com/nftkingiii/curb" target="_blank" rel="noreferrer">Open source ↗</a></footer>
  </div>
}

function SiteHeader({ onHome, onAbout, onEnter, aboutActive = false }: { onHome: () => void; onAbout: () => void; onEnter: () => void; aboutActive?: boolean }) {
  return <header className="calm-nav">
    <button className="calm-logo" onClick={onHome} aria-label="Curb home"><CurbLogo /></button>
    <nav aria-label="Site navigation"><button className={aboutActive ? 'active' : ''} onClick={onAbout}>About</button><a href="https://github.com/nftkingiii/curb" target="_blank" rel="noreferrer">Source</a></nav>
    <button className="nav-enter" onClick={onEnter}>Enter vault</button>
  </header>
}

function CurbLogo() { return <span className="curb-logo"><i aria-hidden="true" />Curb</span> }

function VaultApp({ onHome, onAbout }: { onHome: () => void; onAbout: () => void }) {
  const curb = useCurb()
  const [action, setAction] = useState<Action>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeSection, setActiveSection] = useState(() => ['overview', 'scope', 'yield', 'rules'].includes(window.location.hash.slice(1)) ? window.location.hash.slice(1) : 'overview')
  const connected = Boolean(curb.account)
  const wrongChain = connected && curb.chainId !== curb.targetChainId
  const hasVault = Boolean(curb.vaultAddress)
  const explorer = curb.targetChain.blockExplorers.default.url
  const goToSection = (section: string) => {
    setActiveSection(section)
    setMobileOpen(false)
    window.history.replaceState(null, '', '#' + section)
    document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return <div className="app-shell">
    <header className="topbar">
      <button className="brand brand-button" onClick={onHome} aria-label="Return to Curb landing page"><CurbLogo /></button>
      <nav className={mobileOpen ? 'nav-links open' : 'nav-links'} aria-label="Primary navigation">{['overview', 'scope', 'yield', 'rules'].map((section) => <button className={activeSection === section ? 'active' : ''} key={section} onClick={() => goToSection(section)}>{section[0].toUpperCase()}{section.slice(1)}</button>)}<button onClick={onAbout}>About</button></nav>
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

      {!hasVault && <FeaturePreview id="yield" icon={<Coins />} kicker="Native MON staking" title="Yield, bounded by your reserve." copy="Once a Curb vault exists, MON above its protected liquid floor can be delegated directly through Monad's staking precompile." status={connected ? 'Create your vault to enable staking controls' : 'Connect a wallet to continue'} />}
      {!hasVault && <FeaturePreview id="rules" icon={<Gauge />} kicker="Onchain guardrails" title="Rules that survive a bad click." copy="Per-transfer caps, daily allowances, recipient cooldowns, reserve floors, and delayed policy changes are enforced by the vault, not the browser tab." status={connected ? 'Create your vault to configure rules' : 'Connect a wallet to continue'} />}

      <ScopePanel account={curb.account} vault={curb.vaultAddress} chain={curb.targetChain} />

      <section className="how-it-works" id="about"><p className="section-kicker">How Curb protects you</p><div className="steps"><div><span>01</span><h3>Park funds</h3><p>Move MON into your personal vault.</p></div><div><span>02</span><h3>Set boundaries</h3><p>Choose spending caps, reserve, and delays.</p></div><div><span>03</span><h3>Earn deliberately</h3><p>Delegate only the balance above your reserve.</p></div></div></section>
    </main>

    <footer><div className="brand"><span className="brand-mark"><span /></span><span>Curb</span></div><p>Self-custodial spending boundaries on Monad.</p>{curb.factoryAddress && <a href={`${explorer}/address/${curb.factoryAddress}`} target="_blank" rel="noreferrer">Factory contract <ExternalLink size={13} /></a>}</footer>
    {action && curb.vaultAddress && <ActionDialog action={action} close={() => setAction(null)} curb={curb} />}
    <TransactionToast tx={curb.tx} explorer={explorer} />
    {curb.loading && <div className="sync-indicator"><LoaderCircle className="spin" size={14} /> Syncing vault</div>}
  </div>
}

function FeaturePreview({ id, icon, kicker, title, copy, status }: { id: string; icon: ReactNode; kicker: string; title: string; copy: string; status: string }) {
  return <section className="feature-preview" id={id}><div><p className="section-kicker">{icon} {kicker}</p><h2>{title}</h2><p>{copy}</p></div><span><LockKeyhole size={16} /> {status}</span></section>
}

function ScopePanel({ account, vault, chain }: { account?: Address; vault?: Address; chain: ReturnType<typeof useCurb>['targetChain'] }) {
  const scope = useScope(account, vault, chain)
  const total = scope.totals.active + scope.totals.pending
  return <section className="scope-panel" id="scope">
    <div className="scope-heading"><div><p className="section-kicker"><Layers3 size={14} /> Scope / staking control panel</p><h2>Every delegation.<br />One control surface.</h2><p>Native positions are read directly from Monad. Protocol rates are dated observations, never promised returns.</p></div><button className="scope-refresh" onClick={() => void scope.refresh()} disabled={scope.loading || !account}><RefreshCw className={scope.loading ? 'spin' : ''} size={16} /> Refresh</button></div>
    <div className="scope-summary"><article><span>Total delegated</span><strong>{fmt(String(total))} MON</strong><small>active + activating</small></article><article><span>Active</span><strong>{fmt(String(scope.totals.active))} MON</strong><small>earning native rewards</small></article><article><span>Activating</span><strong>{fmt(String(scope.totals.pending))} MON</strong><small>waiting for epoch boundary</small></article><article><span>Claimable</span><strong>{fmt(String(scope.totals.rewards))} MON</strong><small>native rewards</small></article></div>

    <div className="scope-block"><div className="scope-block-head"><div><span className="mono">01 / NATIVE POSITIONS</span><h3>Validator map</h3></div><span className="read-trust">LIVE · ONCHAIN</span></div>
      {scope.error ? <div className="scope-state error"><CircleAlert size={17} /> {scope.error}</div> : scope.loading ? <div className="scope-state"><LoaderCircle className="spin" size={17} /> Reading Monad staking state…</div> : scope.positions.length === 0 ? <div className="scope-state"><Fingerprint size={17} /> No native validator delegations found for this wallet{vault ? ' or its Curb vault' : ''}.</div> : <div className="scope-table-wrap"><table className="scope-table"><thead><tr><th>Holder</th><th>Validator</th><th>Active</th><th>Activating</th><th>Rewards</th><th>Status</th></tr></thead><tbody>{scope.positions.map((position) => <tr key={`${position.delegator}-${position.validatorId}`}><td><span className={`holder-tag ${position.source === 'Curb vault' ? 'curb' : ''}`}>{position.source}</span></td><td><strong>Validator #{position.validatorId}</strong><small>{position.validatorAddress.slice(0, 8)}…{position.validatorAddress.slice(-6)}</small></td><td>{fmt(position.active)} MON</td><td>{fmt(position.pending)} MON</td><td>{fmt(position.rewards)} MON</td><td><span className="epoch-tag">{Number(position.pending) > 0 ? `Epoch ${position.activationEpoch}` : 'Active'}</span></td></tr>)}</tbody></table></div>}
    </div>

    <div className="scope-block protocol-directory"><div className="scope-block-head"><div><span className="mono">02 / THIRD-PARTY DIRECTORY</span><h3>Yield field</h3></div><span className="market-note">MAINNET MARKET · READ ONLY</span></div><div className="protocol-grid">{yieldDirectory.map((protocol) => <article key={protocol.name} className="protocol-card"><div className="protocol-top"><span className="protocol-mark">{protocol.name.slice(0, 2).toUpperCase()}</span><div><strong>{protocol.name}</strong><small>{protocol.asset}</small></div><span className={`risk-tag ${protocol.risk.toLowerCase()}`}>{protocol.risk}</span></div><div className="apy-row"><span>Observed APY</span><strong>{protocol.apy}</strong></div><dl><div><dt>Rate type</dt><dd>{protocol.apyKind}</dd></div><div><dt>Exit</dt><dd>{protocol.liquidity}</dd></div></dl><footer><span>{protocol.source}</span><a href={protocol.url} target="_blank" rel="noreferrer">Official site <ExternalLink size={12} /></a></footer></article>)}</div><div className="scope-disclaimer"><ShieldCheck size={16} /><p>Curb does not route funds to these protocols. Rates change, and liquid staking adds contract, liquidity, and depeg risk. Links are restricted to curated official domains.</p></div></div>
  </section>
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
