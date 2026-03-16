"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import type { TrendDirection } from "@/lib/types";

interface TrendChartProps {
  title: string;
  dates: string[];
  values: number[];
  unit: string;
  trend?: TrendDirection;
  changePercent?: number;
  color?: string;
}

function formatValue(value: number, unit: string): string {
  if (unit === "$" || unit === "USD") {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  }
  if (unit === "%") return `${value.toFixed(1)}%`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
}

const trendColors: Record<TrendDirection, string> = {
  up: "text-emerald-400",
  down: "text-red-400",
  flat: "text-slate-400",
};

const trendArrows: Record<TrendDirection, string> = {
  up: "↑",
  down: "↓",
  flat: "→",
};

export default function TrendChart({
  title,
  dates,
  values,
  unit,
  trend,
  changePercent,
  color = "#10b981",
}: TrendChartProps) {
  const data = dates.map((d, i) => ({
    date: new Date(d).toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
    value: values[i],
  }));

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-slate-300">{title}</h3>
        {trend && (
          <span className={`text-sm font-semibold ${trendColors[trend]}`}>
            {trendArrows[trend]} {changePercent !== undefined ? `${Math.abs(changePercent).toFixed(1)}%` : ""}
          </span>
        )}
      </div>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id={`gradient-${title.replace(/\s/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={{ stroke: "#334155" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => formatValue(v, unit)}
              width={55}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1e293b",
                border: "1px solid #334155",
                borderRadius: "8px",
                color: "#f1f5f9",
                fontSize: "13px",
              }}
              formatter={(v: number) => [formatValue(v, unit), title]}
              labelStyle={{ color: "#94a3b8" }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#gradient-${title.replace(/\s/g, "")})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
