# AgentDex + Claude Code

Claude Code uses the Bash tool natively, so AgentDex works out of the box — just install it and run `agentdex onboarding`. No extra wiring required.

## 1. Install

```bash
npm install -g agentdex-trade@latest
```

Verify:

```bash
agentdex --version   # should print 0.3.3+
```

## 2. Run Onboarding

**Interactive** (recommended for first-time setup):

```bash
agentdex onboarding
```

AgentDex will prompt for your Jupiter API key, RPC URL, and wallet path.

**Non-interactive** (for scripted setup):

```bash
agentdex onboarding \
  --jupiter-api-key "$JUPITER_API_KEY" \
  --rpc "$SOLANA_RPC_URL" \
  --wallet ~/.config/solana/id.json \
  --max-slippage-bps 300 \
  --max-trade-sol 1 \
  --json
```

Or generate a fresh wallet:

```bash
agentdex onboarding \
  --jupiter-api-key "$JUPITER_API_KEY" \
  --rpc "$SOLANA_RPC_URL" \
  --generate-wallet \
  --wallet-output ~/.agentdex/wallet.json \
  --json
```

## 3. No Extra Config Needed

The `CLAUDE.md` in this repo already serves as the agent system prompt when you open AgentDex in Claude Code. It includes the CLI reference, conventions, and exit code table — Claude reads it automatically.

## 4. Optional: Add the Trading Skill

Copy [`skill/SKILL.md`](../skill/SKILL.md) into your Claude project as a skill for targeted trading commands. The skill provides a focused prompt with the trading workflow and safety rules.

## 5. Try It

Once configured, ask Claude Code:

- "Check my SOL balance"
- "What's the current SOL → USDC price for 0.1 SOL?"
- "Simulate swapping 0.01 SOL to USDC"
- "Swap 0.01 SOL to USDC"

Claude will use the Bash tool to call `agentdex` with `--json` and `--yes` flags automatically.

## Reference

- **[AGENT.md](../AGENT.md)** — Full integration guide with error handling and safety guardrails
- **[EXAMPLES.md](../EXAMPLES.md)** — CLI reference with expected JSON outputs
