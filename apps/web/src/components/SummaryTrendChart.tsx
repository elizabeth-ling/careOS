import type { DomainPoint } from "@careos/shared";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatShortDate } from "@/lib/format";

export function SummaryTrendChart({ label, series }: { label: string; series: DomainPoint[] }) {
  if (!series.length) {
    return <p className="my-2 flex h-[88px] items-center text-xs text-muted-foreground">No trend data.</p>;
  }

  const latest = series.at(-1)!;
  const description = `${label} severity, zero to three. Latest ${latest.severity} of 3 on ${latest.date}.`;

  return (
    <div role="img" aria-label={description} className="my-2 h-[88px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series} margin={{ top: 8, right: 6, bottom: 0, left: -20 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="date" tickFormatter={formatShortDate} hide />
          <YAxis domain={[0, 3]} ticks={[0, 1, 2, 3]} tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} />
          <Tooltip
            contentStyle={{
              borderRadius: 4,
              border: "1px solid var(--color-border)",
              background: "var(--color-surface)",
              fontSize: 12,
              boxShadow: "none",
            }}
            labelFormatter={(value) => formatShortDate(String(value))}
            formatter={(value) => [`${value}/3`, label]}
          />
          <Line
            dataKey="severity"
            name={label}
            type="linear"
            stroke="var(--color-brand)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
