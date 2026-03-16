import type { TrendDirection } from "@/lib/types";

interface MetricCardProps {
  name: string;
  value: number;
  unit: string;
  period?: string;
  trend?: TrendDirection;
  changePercent?: number;
}

function formatValue(value: number, unit: string): string {
  if (unit === "$" || unit === "USD") {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  }
  if (unit === "%") return `${value.toFixed(1)}%`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

const trendIcon: Record<TrendDirection, string> = {
  up: "↑",
  down: "↓",
  flat: "→",
};

const trendColor: Record<TrendDirection, string> = {
  up: "text-emerald-400",
  down: "text-red-400",
  flat: "text-slate-400",
};

export default function MetricCard({ name, value, unit, period, trend, changePercent }: MetricCardProps) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex flex-col gap-1">
      <p className="text-sm text-slate-400 font-medium truncate">{name}</p>
      <p className="text-2xl font-bold tracking-tight">{formatValue(value, unit)}</p>
      <div className="flex items-center gap-2 mt-1">
        {trend && (
          <span className={`text-sm font-semibold ${trendColor[trend]}`}>
            {trendIcon[trend]} {changePercent !== undefined ? `${Math.abs(changePercent).toFixed(1)}%` : ""}
          </span>
        )}
        {period && <span className="text-xs text-slate-500">{period}</span>}
      </div>
    </div>
  );
}
