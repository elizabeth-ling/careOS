import { DOMAIN_NAMES, type DomainKey, type DomainPoint, type TrendsResponse } from "@careos/shared";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Line colours for the two domains the triage queue compares, from the theme tokens. */
const DOMAIN_LINE: Partial<Record<DomainKey, string>> = {
  appetite: "var(--color-watch)",
  cognition: "var(--color-info)",
};

/** Severity at or below this is treated as the normal band on the baseline chart. */
const BASELINE_BAND = 0.5;

const TICK = { fontSize: 12, fill: "var(--color-muted-foreground)" };

const TOOLTIP_STYLE = {
  contentStyle: {
    borderRadius: 4,
    border: "1px solid var(--color-border)",
    background: "var(--color-surface)",
    fontSize: 13,
    boxShadow: "none",
  },
  labelStyle: { color: "var(--color-ink)", fontWeight: 600 },
} as const;

function describe(domains: readonly DomainKey[], trends: TrendsResponse): string {
  const parts = domains.map((key) => {
    const latest = trends.domains[key].at(-1);
    return `${DOMAIN_NAMES[key]} ${latest ? `latest ${latest.severity} of 3` : "no data"}`;
  });
  return `Severity 0 to 3 over the last ${trends.days} days. ${parts.join(", ")}.`;
}

/** "Changes from baseline": two domains over time, y 0–3, with the shaded 0–0.5 band. */
export function BaselineChart({
  trends,
  domains,
  height = 220,
}: {
  trends: TrendsResponse;
  domains: readonly DomainKey[];
  height?: number;
}) {
  const byDate = new Map<string, Record<string, number | string>>();
  for (const key of domains) {
    for (const point of trends.domains[key]) {
      const row = byDate.get(point.date) ?? { date: point.date };
      row[key] = point.severity;
      byDate.set(point.date, row);
    }
  }
  const data = [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));

  return (
    <div role="img" aria-label={describe(domains, trends)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--color-border)" />
          <ReferenceArea y1={0} y2={BASELINE_BAND} fill="var(--color-sage-50)" fillOpacity={1} />
          <XAxis
            dataKey="date"
            tickFormatter={formatShortDate}
            tick={TICK}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={40}
          />
          <YAxis domain={[0, 3]} ticks={[0, 1, 2, 3]} tick={TICK} tickLine={false} axisLine={false} />
          <Tooltip {...TOOLTIP_STYLE} labelFormatter={(label) => formatShortDate(String(label))} />
          {domains.map((key) => (
            <Line
              key={key}
              type="linear"
              dataKey={key}
              name={DOMAIN_NAMES[key]}
              stroke={DOMAIN_LINE[key] ?? "var(--color-brand)"}
              strokeWidth={2}
              connectNulls
              isAnimationActive={false}
              dot={(props: { cx?: number; cy?: number; index?: number }) =>
                props.index === data.length - 1 && props.cx !== undefined && props.cy !== undefined ? (
                  <circle
                    key={`${key}-last`}
                    cx={props.cx}
                    cy={props.cy}
                    r={4}
                    fill={DOMAIN_LINE[key] ?? "var(--color-brand)"}
                  />
                ) : (
                  <g key={`${key}-${props.index}`} />
                )
              }
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** The legend above the baseline chart. */
export function BaselineLegend({ domains }: { domains: readonly DomainKey[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-body-2">
      {domains.map((key) => (
        <li key={key} className="flex items-center gap-1.5">
          <span
            className="h-0.5 w-4 rounded-full"
            style={{ background: DOMAIN_LINE[key] ?? "var(--color-brand)" }}
            aria-hidden
          />
          {DOMAIN_NAMES[key]}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span className="size-3 rounded-[2px] bg-sage-50" aria-hidden />
        Baseline
      </li>
    </ul>
  );
}

/**
 * One domain's severity (0–3) as a small chart, with the patient's own baseline
 * as a shaded band. Flagged domains get a tinted title and outline.
 */
export function DomainMiniChart({
  domain,
  label = DOMAIN_NAMES[domain],
  points,
  baseline,
  flagged = false,
  height = 56,
  className,
}: {
  domain: DomainKey;
  label?: string;
  points: DomainPoint[];
  baseline: number;
  flagged?: boolean;
  height?: number;
  className?: string;
}) {
  const latest = points.at(-1);
  const band = Math.max(BASELINE_BAND, baseline);
  const summary = `${label}: ${points.length > 0 ? `latest severity ${latest!.severity} of 3` : "no data"}, baseline ${baseline.toFixed(1)}`;

  return (
    <div
      className={cn(
        "rounded-panel border bg-surface px-3 pt-2.5 pb-2",
        flagged ? "border-watch" : "border-border",
        className,
      )}
    >
      <h4 className={cn("truncate text-[13px] font-semibold", flagged ? "text-watch" : "text-ink")}>
        {label}
        {flagged && <span className="sr-only"> (flagged)</span>}
      </h4>
      <p className="text-xs text-muted-foreground tabular-nums">
        {latest ? `${latest.severity}/3` : "–"} · base {baseline.toFixed(1)}
      </p>
      <div role="img" aria-label={summary} style={{ height }} className="mt-1">
        {points.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 4, right: 2, bottom: 2, left: 2 }}>
              <XAxis dataKey="date" hide />
              <YAxis domain={[0, 3]} hide />
              <ReferenceArea y1={0} y2={band} fill="var(--color-sage-50)" fillOpacity={1} />
              <Line
                type="linear"
                dataKey="severity"
                stroke={flagged ? "var(--color-watch)" : "var(--color-brand)"}
                strokeWidth={1.75}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
