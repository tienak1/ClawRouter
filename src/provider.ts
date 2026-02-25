/**
 * BlockRun ProviderPlugin for OpenClaw
 *
 * Registers BlockRun as an LLM provider in OpenClaw.
 * Uses a local x402 proxy to handle micropayments transparently —
 * pi-ai sees a standard OpenAI-compatible API at localhost.
 */

import type { ProviderPlugin } from "./types.js";
import { buildProviderModels, buildGreenNodeProviderModels } from "./models.js";
import type { ProxyHandle } from "./proxy.js";

/**
 * State for the running proxy (set when the plugin activates).
 */
let activeProxy: ProxyHandle | null = null;

/**
 * Update the proxy handle (called from index.ts when the proxy starts).
 */
export function setActiveProxy(proxy: ProxyHandle): void {
  activeProxy = proxy;
}

export function getActiveProxy(): ProxyHandle | null {
  return activeProxy;
}

/**
 * BlockRun provider plugin definition.
 */
export const blockrunProvider: ProviderPlugin = {
  id: "blockrun",
  label: "BlockRun",
  docsPath: "https://blockrun.ai/docs",
  aliases: ["br"],
  envVars: ["BLOCKRUN_WALLET_KEY"],

  // Model definitions — dynamically set to proxy URL
  get models() {
    if (!activeProxy) {
      // Fallback: point to BlockRun API directly (won't handle x402, but
      // allows config loading before proxy starts)
      return buildProviderModels("https://blockrun.ai/api");
    }
    return buildProviderModels(activeProxy.baseUrl);
  },

  // No auth required — the x402 proxy handles wallet-based payments internally.
  // The proxy auto-generates a wallet on first run and stores it at
  // ~/.openclaw/blockrun/wallet.key. Users just fund that wallet with USDC.
  auth: [],
};

export const greennodeProvider: ProviderPlugin = {
  id: "greennode",
  label: "GreenNode",
  docsPath: "https://aiplatform.console.vngcloud.vn/models",
  aliases: ["gn"],
  envVars: ["GREENNODE_API_KEY", "GREENNODE_BASE_URL"],
  get models() {
    const base = process.env.GREENNODE_BASE_URL || "https://maas-llm-aiplatform-hcm.api.vngcloud.vn/v1";
    return buildGreenNodeProviderModels(base);
  },
  auth: [
    {
      id: "api_key",
      label: "API Key",
      kind: "api_key",
      run: async () => ({ profiles: [{ profileId: "default", credential: { apiKey: process.env.GREENNODE_API_KEY } }] }),
    },
  ],
};
