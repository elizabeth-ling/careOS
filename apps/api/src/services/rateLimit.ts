import { getConnInfo } from "@hono/node-server/conninfo";
import type { Context, MiddlewareHandler } from "hono";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;

interface Window {
  count: number;
  resetsAt: number;
}

function hasNodeSocket(value: unknown): boolean {
  if (!value || typeof value !== "object" || !("incoming" in value)) return false;
  const incoming = value.incoming;
  if (!incoming || typeof incoming !== "object" || !("socket" in incoming)) return false;
  return Boolean(incoming.socket && typeof incoming.socket === "object");
}

function clientAddress(c: Context, trustProxy: boolean): string {
  if (trustProxy) {
    const forwarded = c.req
      .header("x-forwarded-for")
      ?.split(",")
      .map((address) => address.trim())
      .filter(Boolean);
    const proxyAddress = forwarded?.at(-1);
    if (proxyAddress) return proxyAddress;
  }

  const bindings = c.env && typeof c.env === "object" && "server" in c.env && c.env.server ? c.env.server : c.env;
  return hasNodeSocket(bindings) ? (getConnInfo(c).remote.address ?? "unknown") : "unknown";
}

/** Process-local limiter for the interactive demo API. */
export function checkInRateLimit(trustProxy: boolean): MiddlewareHandler {
  const windows = new Map<string, Window>();

  return async (c, next) => {
    const now = Date.now();
    const address = clientAddress(c, trustProxy);
    let window = windows.get(address);

    if (!window || window.resetsAt <= now) {
      window = { count: 0, resetsAt: now + WINDOW_MS };
      windows.set(address, window);
    }

    if (window.count >= MAX_REQUESTS) {
      const retryAfter = Math.max(1, Math.ceil((window.resetsAt - now) / 1000));
      return c.json({ error: "Too many check-ins. Try again in a minute." }, 429, {
        "Retry-After": String(retryAfter),
      });
    }

    window.count += 1;
    if (windows.size > 5000) {
      for (const [key, value] of windows) {
        if (value.resetsAt <= now) windows.delete(key);
      }
    }

    await next();
  };
}
