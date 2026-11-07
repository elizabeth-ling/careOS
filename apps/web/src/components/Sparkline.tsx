import type { RiskPoint, RiskTier } from "@careos/shared";
import { tierFor } from "@careos/shared";
import { Line, LineChart, YAxis } from "recharts";
import { TIER_STYLES } from "./tiers";

interface SparklineProps {
  points: RiskPoint[];
  /** Colours the line. Defaults to the tier of the latest point. */
  tier?: RiskTier;
  width?: number;
  height?: number;
  /** Describes the trend for screen readers, e.g. "14-day risk trend". */
  label?: string;
}

/** A tiny, axis-free risk trend line, as in the triage queue. */
export function Sparkline({ points, tier, width = 96, height = 28, label = "Risk trend" }: SparklineProps) {
  const last = points.at(-1);
  const colour = TIER_STYLES[tier ?? tierFor(last?.maxRisk ?? 0)].stroke;
  const summary =
    points.length > 0
      ? `${label}: from ${points[0]!.maxRisk} to ${last!.maxRisk} over ${points.length} days`
      : `${label}: no data`;

  return (
    <div role="img" aria-label={summary} style={{ width, height }}>
      {points.length > 1 && (
        <LineChart width={width} height={height} data={points} margin={{ top: 3, right: 2, bottom: 3, left: 2 }}>
          <YAxis hide domain={[0, 100]} />
          <Line
            type="monotone"
            dataKey="maxRisk"
            stroke={colour}
            strokeWidth={1.75}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      )}
    </div>
  );
}
