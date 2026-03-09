# Image Generation

Generate images via BlockRun's image API with x402 micropayments — no API keys, pay per image.

## Table of Contents

- [Quick Start](#quick-start)
- [Models & Pricing](#models--pricing)
- [API Reference](#api-reference)
- [Code Examples](#code-examples)
- [In-Chat Command](#in-chat-command)
- [Notes](#notes)

---

## Quick Start

ClawRouter runs a local proxy on port `8402` that handles x402 payments automatically. Point any OpenAI-compatible client at it:

```bash
curl -X POST http://localhost:8402/v1/images/generations \
  -H "Content-Type: application/json" \
  -d '{
    "model": "google/nano-banana",
    "prompt": "a golden retriever surfing on a wave",
    "size": "1024x1024",
    "n": 1
  }'
```

Response:

```json
{
  "created": 1741460000,
  "data": [
    {
      "url": "https://files.catbox.moe/abc123.png"
    }
  ]
}
```

The returned URL is a publicly hosted image, ready to use in Telegram, Discord, or any client.

---

## Models & Pricing

| Model ID                   | Shorthand       | Price       | Max Size   | Provider          |
| -------------------------- | --------------- | ----------- | ---------- | ----------------- |
| `google/nano-banana`       | `nano-banana`   | $0.05/image | 1024×1024  | Google Gemini Flash |
| `google/nano-banana-pro`   | `banana-pro`    | $0.10/image | 4096×4096  | Google Gemini Pro |
| `openai/dall-e-3`          | `dall-e-3`      | $0.04/image | 1792×1024  | OpenAI DALL-E 3   |
| `openai/gpt-image-1`       | `gpt-image`     | $0.02/image | 1536×1024  | OpenAI GPT Image  |
| `black-forest/flux-1.1-pro`| `flux`          | $0.04/image | 1024×1024  | Black Forest Labs |

Default model: `google/nano-banana`.

---

## API Reference

### `POST /v1/images/generations`

OpenAI-compatible endpoint. Route via ClawRouter proxy (`http://localhost:8402`) for automatic x402 payment handling.

**Request body:**

| Field    | Type     | Required | Description                                      |
| -------- | -------- | -------- | ------------------------------------------------ |
| `model`  | `string` | Yes      | Model ID (see table above)                       |
| `prompt` | `string` | Yes      | Text description of the image to generate        |
| `size`   | `string` | No       | Image dimensions, e.g. `"1024x1024"` (default)  |
| `n`      | `number` | No       | Number of images (default: `1`)                  |

**Response:**

```typescript
{
  created: number;          // Unix timestamp
  data: Array<{
    url: string;            // Publicly hosted image URL
    revised_prompt?: string; // Model's rewritten prompt (dall-e-3 only)
  }>;
}
```

---

## Code Examples

### curl

```bash
# Default model (nano-banana, $0.05)
curl -X POST http://localhost:8402/v1/images/generations \
  -H "Content-Type: application/json" \
  -d '{
    "model": "google/nano-banana",
    "prompt": "a futuristic city at sunset, cyberpunk style",
    "size": "1024x1024",
    "n": 1
  }'

# DALL-E 3 with landscape size ($0.04)
curl -X POST http://localhost:8402/v1/images/generations \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/dall-e-3",
    "prompt": "a serene Japanese garden in autumn",
    "size": "1792x1024",
    "n": 1
  }'
```

### TypeScript / Node.js

```typescript
const response = await fetch("http://localhost:8402/v1/images/generations", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "google/nano-banana",
    prompt: "a golden retriever surfing on a wave",
    size: "1024x1024",
    n: 1,
  }),
});

const result = await response.json() as {
  created: number;
  data: Array<{ url: string; revised_prompt?: string }>;
};

const imageUrl = result.data[0].url;
console.log(imageUrl); // https://files.catbox.moe/xxx.png
```

### Python

```python
import requests

response = requests.post(
    "http://localhost:8402/v1/images/generations",
    json={
        "model": "google/nano-banana",
        "prompt": "a golden retriever surfing on a wave",
        "size": "1024x1024",
        "n": 1,
    }
)

result = response.json()
image_url = result["data"][0]["url"]
print(image_url)
```

### OpenAI SDK (drop-in)

```typescript
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "blockrun",               // any non-empty string
  baseURL: "http://localhost:8402/v1",
});

const response = await client.images.generate({
  model: "google/nano-banana",
  prompt: "a golden retriever surfing on a wave",
  size: "1024x1024",
  n: 1,
});

console.log(response.data[0].url);
```

### startProxy (programmatic)

If you're using ClawRouter as a library:

```typescript
import { startProxy } from "@blockrun/clawrouter";

const proxy = await startProxy({ walletKey: process.env.BLOCKRUN_WALLET_KEY! });

const response = await fetch(`${proxy.baseUrl}/v1/images/generations`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "openai/dall-e-3",
    prompt: "a serene Japanese garden in autumn",
    size: "1792x1024",
    n: 1,
  }),
});

const { data } = await response.json();
console.log(data[0].url);

await proxy.close();
```

---

## In-Chat Command

When using ClawRouter with OpenClaw, generate images directly from any conversation:

```
/imagegen a dog dancing on the beach
/imagegen --model dall-e-3 a futuristic city at sunset
/imagegen --model banana-pro --size 2048x2048 mountain landscape
```

**Flags:**

| Flag      | Default          | Description              |
| --------- | ---------------- | ------------------------ |
| `--model` | `nano-banana`    | Model shorthand or ID    |
| `--size`  | `1024x1024`      | Image dimensions         |

**Model shorthands** (for `--model`):

| Shorthand    | Full ID                      |
| ------------ | ---------------------------- |
| `nano-banana`| `google/nano-banana`         |
| `banana-pro` | `google/nano-banana-pro`     |
| `dall-e-3`   | `openai/dall-e-3`            |
| `gpt-image`  | `openai/gpt-image-1`         |
| `flux`       | `black-forest/flux-1.1-pro`  |

---

## Notes

- **Hosted URLs** — All images are returned as publicly accessible URLs (catbox.moe). Google models return base64 data URIs which ClawRouter automatically uploads before responding.
- **Payment** — Each image costs the listed price in USDC, deducted from your wallet via x402. Make sure your wallet is funded before generating.
- **No DALL-E content policy bypass** — DALL-E 3 still applies OpenAI's content policy. Use `flux` or `nano-banana` for more flexibility.
- **Size limits** — Requesting a size larger than the model's max will return an error. Check the table above before setting `--size`.
