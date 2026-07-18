# Curb

**Your money. With boundaries.**

Curb is a self-custodial native-token vault for Monad. It limits the damage a phishing signature or impulsive transaction can cause by enforcing spending rules inside a smart contract.

## What is enforced

- Per-transaction withdrawal cap
- Daily aggregate allowance
- Cooldown for new recipient addresses
- Delayed activation for trusted recipients
- Delayed policy changes and emergency withdrawals
- Mandatory liquid reserve for withdrawals and staking
- Native MON delegation, unstaking, and reward claims
- Scope staking control panel for wallet and vault validator positions
- Read-only third-party liquid-staking directory with dated APY observations

The frontend cannot override these controls. Funds outside a Curb vault are not protected.

## Scope

Scope reads native Monad delegations for both the connected wallet and its Curb vault. It discovers validator IDs through the staking precompile, then shows active stake, pending epoch activation, and claimable rewards per validator.

Its third-party yield directory is informational only. Rates are dated observations, not guaranteed returns, and Curb never grants these protocols approval or routes vault funds to them.

## Local development

Requirements: Node.js 20+ and Foundry.

```bash
pnpm install
pnpm dev
```

Run every check:

```bash
pnpm check
```

## Railway deployment

Create a Railway service from this repository and enable public networking. The committed `railway.json` selects Railpack, runs `pnpm run build`, starts the production server with `pnpm start`, and verifies each deployment at `/health`.

Set these service variables before deploying:

```text
VITE_TESTNET_FACTORY_ADDRESS=0x2887fa12671A35eb573d8855550fb68FDCC80A2c
```

Add `VITE_MAINNET_FACTORY_ADDRESS` only after a reviewed mainnet factory exists. `VITE_*` values are compiled into the browser bundle, so changing an address requires a new deployment. Railway supplies `PORT` automatically; do not set it manually. The production server binds to `0.0.0.0`, serves fingerprinted assets with long-lived caching, and falls back to `index.html` for frontend routes.

## Contract deployment

Copy `.env.example` to `.env.local` after deploying `CurbFactory`, then set the factory address for the target network.

```bash
forge script contracts/script/Deploy.s.sol:Deploy \
  --rpc-url "$MONAD_RPC_URL" \
  --private-key "$DEPLOYER_PRIVATE_KEY" \
  --broadcast
```

Never commit a private key. Verify the deployment and publish the exact contract address used by the frontend.

The deploy script binds vaults to Monad's staking precompile at `0x1000`. Yield is immutable at factory deployment and defaults off. Test the complete lifecycle before enabling it:

```bash
ENABLE_STAKING=true forge script contracts/script/Deploy.s.sol:Deploy \
  --rpc-url "$MONAD_RPC_URL" \
  --private-key "$DEPLOYER_PRIVATE_KEY" \
  --broadcast
```

For mainnet, first deploy with `ENABLE_STAKING=false`, verify the factory and frontend configuration, and fund only a small canary vault. Deploy a separate staking-enabled factory after testnet validation and independent review.

## Network

- Monad testnet: chain ID `10143`
- Monad mainnet: chain ID `143`
- Native asset: `MON`

## Live testnet deployment

- Factory: [`0x2887fa12671A35eb573d8855550fb68FDCC80A2c`](https://testnet.monadvision.com/address/0x2887fa12671A35eb573d8855550fb68FDCC80A2c)
- Canary vault: [`0x822FCdEC163F78294F179348f73D9FfD5fF11F23`](https://testnet.monadvision.com/address/0x822FCdEC163F78294F179348f73D9FfD5fF11F23)
- Validator ID: `1`
- Staking: enabled through the native `0x1000` precompile

The canary was funded with `2 MON` and delegated `0.5 MON` while preserving its configured `1 MON` liquid reserve. Machine-readable deployment details are in `deployments/monad-testnet.json`.

## Security scope

Curb is an experimental hackathon project and has not been professionally audited. Delegated MON is also subject to Monad staking mechanics, validator risk, and an unstaking delay. Curb does not protect assets remaining in the owner's EOA, ERC-20 allowances, NFTs, or unrelated smart accounts.
