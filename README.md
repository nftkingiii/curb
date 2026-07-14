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

The frontend cannot override these controls. Funds outside a Curb vault are not protected.

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

## Security scope

Curb is an experimental hackathon project and has not been professionally audited. Delegated MON is also subject to Monad staking mechanics, validator risk, and an unstaking delay. Curb does not protect assets remaining in the owner's EOA, ERC-20 allowances, NFTs, or unrelated smart accounts.
