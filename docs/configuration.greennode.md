# ClawRouter: GreenNode Provider (OpenAI‑compatible)

Status: WIP (feature/provider-greennode+nadir-free)

## Overview
Enable ClawRouter to talk directly to GreenNode’s OpenAI‑compatible endpoint using API key auth (Bearer), bypassing BlockRun x402.

- Provider toggle: `CLAWROUTER_PROVIDER=greennode|blockrun` (default: blockrun)
- GreenNode env:
  - `GREENNODE_BASE_URL=https://maas-llm-aiplatform-hcm.api.vngcloud.vn/v1`
  - `GREENNODE_API_KEY=...`
  - `GREENNODE_API=openai-completions`
- Streaming: pass‑through SSE where supported

## Models (initial mapping)
- `greennode/anthropic/claude-sonnet-4-0`
- `greennode/qwen/qwen3-coder-plus`
- `greennode/openai/gpt-5`
- `greennode/openai/gpt-5-mini`
- `greennode/openai/gpt-oss-120b` (free fallback)

## Routing presets
- SIMPLE_MODEL → greennode/openai/gpt-5-mini
- COMPLEX_MODEL → greennode/openai/gpt-5
- CODING_MODEL → greennode/qwen/qwen3-coder-plus; fallbacks: [greennode/openai/gpt-5, greennode/openai/gpt-5-mini]
- FREE → greennode/openai/gpt-oss-120b
- CHEAPEST → pick the lowest unit cost among the above

## Rollout
1) Create `.env.local` (gitignored) with GreenNode vars
2) Set `CLAWROUTER_PROVIDER=greennode`
3) Restart OpenClaw gateway: `openclaw gateway restart`
4) Verify:
   - `openclaw models list --plain`
   - `curl $GREENNODE_BASE_URL/models -H "Authorization: Bearer $GREENNODE_API_KEY"`

## Notes
- BlockRun flow (x402) stays intact when `CLAWROUTER_PROVIDER=blockrun`
- `/v1/models`, `/v1/chat/completions`, `/stats` remain stable
- Doctor will validate env + make a 1‑token ping
