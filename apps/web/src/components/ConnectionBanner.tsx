import { useQueryClient } from "@tanstack/react-query";
import { WifiOff } from "lucide-react";
import { useEffect, useRef } from "react";
import { api } from "@/api/api";
import { useApiReachable } from "@/api/connection";

const PING_MS = 3000;

/**
 * Top-of-page banner shown while the API is unreachable. It pings /api/health
 * until the server answers, then refetches everything, so it clears without a reload.
 */
export function ConnectionBanner() {
  const reachable = useApiReachable();
  const client = useQueryClient();
  const wasReachable = useRef(reachable);

  useEffect(() => {
    if (reachable) return;
    const timer = window.setInterval(() => {
      // api.health reports its outcome to the connection store itself.
      api.health().catch(() => undefined);
    }, PING_MS);
    return () => window.clearInterval(timer);
  }, [reachable]);

  useEffect(() => {
    if (reachable && !wasReachable.current) void client.invalidateQueries();
    wasReachable.current = reachable;
  }, [reachable, client]);

  if (reachable) return null;

  return (
    <div
      role="alert"
      className="flex items-center justify-center gap-2 border-b border-urgent/30 bg-urgent-bg px-4 py-2 text-sm font-medium text-urgent"
    >
      <WifiOff className="size-4 shrink-0" aria-hidden />
      <span>Can't reach the CareOS server. Retrying automatically…</span>
    </div>
  );
}
