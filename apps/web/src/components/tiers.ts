import type { RiskTier } from "@careos/shared";

/** Tailwind classes for each risk tier. Colours come from the theme tokens only. */
export const TIER_STYLES: Record<RiskTier, { text: string; bg: string; stroke: string; label: string }> = {
  urgent: { text: "text-urgent", bg: "bg-urgent-bg", stroke: "var(--color-urgent)", label: "Urgent" },
  watch: { text: "text-watch", bg: "bg-watch-bg", stroke: "var(--color-watch)", label: "Watch" },
  stable: { text: "text-stable", bg: "bg-stable-bg", stroke: "var(--color-stable)", label: "Stable" },
};
