# The Most AI-Agent-Native Router for OpenClaw

> *OpenClaw is one of the best AI agent frameworks available. Its LLM abstraction layer is not.*

---

## The $248/Day Problem

From [openclaw/openclaw#3181](https://github.com/openclaw/openclaw/issues/3181):

> *"We ended up at $248/day before we caught it. Heartbeat on Opus 4.6 with a large context. The dedup fix reduced trigger rate, but there's nothing bounding the run itself."*

> *"11.3M input tokens in 1 hour on claude-opus-4-6 (128K context), ~$20/hour."*

Both users ended up disabling heartbeat entirely. The workaround: `heartbeat.every: "0"` — turning off the feature to avoid burning money.

The root cause isn't configuration error. It's that OpenClaw's LLM layer has no concept of what things cost, and no way to stop a run that's spending too much.

---

## What OpenClaw Gets Wrong at the Inference Layer

OpenClaw is an excellent orchestration framework — session management, tool dispatch, agent routing, memory. But every request it makes hits a single configured model with no awareness of:

**Cost tier** — A heartbeat status check doesn't need Opus. A file read result doesn't need 128K context. OpenClaw sends both to the same model at the same price.

**Error semantics** — OpenClaw's failover logic has known gaps. We found and fixed two while building ClawRouter:

- **MiniMax HTTP 520** ([PR #49550](https://github.com/openclaw/openclaw/pull/49550)) — MiniMax returns `{"type":"api_error","message":"unknown error, 520 (1000)"}` for transient server errors. OpenClaw's classifier required both `"type":"api_error"` AND the string `"internal server error"`. MiniMax fails the second check. Result: no failover, silent failure, retry storm.

- **Z.ai codes 1311 and 1113** ([PR #49552](https://github.com/openclaw/openclaw/pull/49552)) — Z.ai error 1311 means "model not on your plan" (billing — stop retrying). Error 1113 means "wrong endpoint" (auth — rotate key). Both fell through to `null`, got treated as `rate_limit`, triggered exponential backoff, and charged for every retry.

**Context size** — Agents accumulate context. A 10-message conversation with tool results can easily hit 40K+ tokens. OpenClaw sends the full context every request, on every retry.

---

## ClawRouter: Built for Agentic Workloads

ClawRouter is a local OpenAI-compatible proxy, purpose-built for how AI agents actually behave — not how simple chat clients do. It sits between OpenClaw and the upstream model APIs.

```
OpenClaw → ClawRouter → blockrun.ai → GPT-4o / Opus / Gemini / ...
                ↑
         All the smart stuff happens here
```

### 1. Token Compression — 7 Layers, Agent-Aware

Agents are the worst offenders for context bloat. Tool call results are verbose. File reads return thousands of lines. Conversation history compounds with every turn.

ClawRouter compresses every request through 7 layers before it hits the wire:

| Layer | What it does | Saves |
|-------|-------------|-------|
| Deduplication | Removes repeated messages (retries, echoes) | Variable |
| Whitespace | Strips excessive whitespace from all content | 2–8% |
| Dictionary | Replaces common phrases with short codes | 5–15% |
| Path shortening | Codebook for repeated file paths in tool results | 3–10% |
| JSON compaction | Removes whitespace from embedded JSON | 5–12% |
| **Observation compression** | **Summarizes tool results to key information** | **Up to 97%** |
| Dynamic codebook | Learns repetitions in the actual conversation | 3–15% |

Layer 6 is the big one. Tool results — file reads, API responses, shell output — can be 10KB+ each. The actual useful signal is often 200–300 chars. ClawRouter extracts errors, status lines, key JSON fields, and compresses the rest. Same model intelligence, 97% fewer tokens on the bulk.

**Overall reduction: 15–40% on typical agentic workloads.** On the $248/day scenario, that's $150–$200/day in savings from compression alone, before any routing changes.

### 2. Automatic Tier Routing — Right Model for Each Request

ClawRouter classifies every request before forwarding:

```
heartbeat status check     →  SIMPLE   →  gemini-2.5-flash      (~0.04¢ / request)
code review, refactor      →  COMPLEX  →  claude-sonnet-4-6      (~5¢ / request)
formal proof, reasoning    →  REASONING →  o3 / claude-opus      (~30¢ / request)
```

**Tool detection is automatic.** When OpenClaw sends a request with tools attached, ClawRouter forces agentic routing tiers — guaranteeing tool-capable models and preventing the silent fallback to models that refuse tool calls.

**Session pinning.** Once a session selects a model for a task, ClawRouter pins that model for the session lifetime. No mid-task model switching, no consistency issues across a long agent run.

The heartbeat that was burning $248/day on Opus routes to Flash at ~1/500th the cost. Same heartbeat feature, working as designed.

### 3. Correct Error Classification — No Retry Storms

ClawRouter classifies errors at the HTTP/body layer before OpenClaw sees them:

```
401 / 403              → auth_failure    → stop retrying, rotate key
402 / billing body     → quota_exceeded  → stop retrying, surface alert
429                    → rate_limited    → backoff, try next model
529 / overloaded body  → overloaded      → short cooldown, fallback model
5xx / 520              → server_error    → retry with different model
Z.ai 1311              → billing         → stop retrying
Z.ai 1113              → auth            → rotate key
MiniMax 520 (api_error)→ server_error    → retry with fallback
```

Per-provider error state is tracked independently. If MiniMax is having a bad hour, Anthropic and OpenAI routes continue working. No cross-contamination, no single provider poisoning the session.

### 4. Session Memory — Agents That Remember

OpenClaw sessions can be long-lived. ClawRouter maintains a session journal — extracting decisions, results, and context from each turn — and injects relevant history when the agent asks questions that reference earlier work.

Less context repeated = fewer tokens = lower cost. Agents that need to recall earlier decisions don't need to carry the entire history in every prompt.

### 5. x402 Micropayments — Budget by Construction

ClawRouter pays for inference via [x402](https://x402.org/) USDC micropayments (Base or Solana). You load a wallet. Each inference call costs exactly what it costs. When the wallet runs low, requests stop cleanly.

There is no monthly invoice. There is no 3am email. There is a wallet balance, and it either has funds or it doesn't. The cost overrun scenario that burned $248/day is structurally impossible — the wallet would drain and stop, not accumulate.

```
41+ models. One wallet. Pay per call.
```

---

## OpenClaw + ClawRouter: The Full Picture

| Problem | OpenClaw alone | OpenClaw + ClawRouter |
|---------|---------------|----------------------|
| Heartbeat cost overrun | No per-run cap | Tier routing → 50–500× cheaper model |
| Large context | Full context every call | 7-layer compression, 15–40% reduction |
| Tool result bloat | Raw output forwarded | Observation compression, up to 97% |
| MiniMax 520 failure | Silent drop / retry storm | Classified as server_error, retried correctly |
| Z.ai 1311 (billing) | Treated as rate_limit, retried | Classified as billing, stopped immediately |
| Mid-task model switch | Model can change mid-session | Session pinning, consistent model per task |
| Monthly billing surprise | Possible | Wallet-based, stops when empty |
| Cost visibility | None | `/stats` with per-provider error counts |

---

## Getting Started

```bash
npm install -g @blockrun/clawrouter
clawrouter init
```

Point OpenClaw at `http://localhost:3729`. Your existing config, tools, sessions, and extensions are unchanged.

```yaml
# ~/.openclaw/config.yaml
apiBaseUrl: http://localhost:3729/v1
```

Load a wallet, choose a model profile (`eco` / `auto` / `premium` / `agentic`), and run.

---

## On Our OpenClaw Contributions

We contribute upstream when we find bugs. The two PRs linked above fix real error classification gaps. Everyone using OpenClaw directly benefits.

ClawRouter exists because proxy-layer cost control, context compression, and agent-aware routing are fundamentally gateway concerns — not framework concerns. OpenClaw can't know that your heartbeat doesn't need Opus. It can't compress tool results it hasn't seen. It can't enforce a wallet ceiling.

That's what ClawRouter is for.

---

*[github.com/BlockRunAI/ClawRouter](https://github.com/BlockRunAI/ClawRouter) · [blockrun.ai](https://blockrun.ai) · `npm install -g @blockrun/clawrouter`*
