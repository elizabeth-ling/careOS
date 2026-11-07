import { useSyncExternalStore } from "react";

/**
 * Whether the browser can currently reach the CareOS API. Every request in
 * api.ts reports its outcome here, so the banner appears on the first failed
 * request and clears on the first successful one.
 */
let reachable = true;
const listeners = new Set<() => void>();

function set(next: boolean) {
  if (next === reachable) return;
  reachable = next;
  for (const listener of listeners) listener();
}

export const connection = {
  markReachable: () => set(true),
  markUnreachable: () => set(false),
  isReachable: () => reachable,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useApiReachable(): boolean {
  return useSyncExternalStore(connection.subscribe, connection.isReachable, connection.isReachable);
}
