import { getClaude } from "./claudeExtractor";
import { getTranscriber } from "./transcribe";
import { withTimeout } from "./timeout";

const HEALTH_CHECK_TIMEOUT_MS = 2500;
const CACHE_MS = 30_000;

interface ProviderHealth {
  sttOk: boolean;
  llmOk: boolean;
}

let cached: { checkedAt: number; health: ProviderHealth } | undefined;
let pending: Promise<ProviderHealth> | undefined;

async function probe(label: string, operation: (signal: AbortSignal) => Promise<unknown>): Promise<boolean> {
  try {
    await withTimeout(label, HEALTH_CHECK_TIMEOUT_MS, operation);
    return true;
  } catch (error) {
    console.warn(`${label} is unavailable:`, error instanceof Error ? error.message : error);
    return false;
  }
}

/** Cached provider reachability checks; never sends transcript or patient data. */
export function getProviderHealth(): Promise<ProviderHealth> {
  if (cached && Date.now() - cached.checkedAt < CACHE_MS) return Promise.resolve(cached.health);
  if (pending) return pending;

  const transcriber = getTranscriber();
  const claude = getClaude();
  pending = Promise.all([
    transcriber ? probe("Speech-to-text health check", (signal) => transcriber.ping(signal)) : false,
    claude
      ? probe("Claude health check", async (signal) => {
          await claude.models.list({ limit: 1 }, { signal });
        })
      : false,
  ])
    .then(([sttOk, llmOk]) => {
      const health = { sttOk, llmOk };
      cached = { checkedAt: Date.now(), health };
      return health;
    })
    .finally(() => {
      pending = undefined;
    });

  return pending;
}
