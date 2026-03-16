import type { Anomaly } from "@/lib/types";

interface AnomalyCardProps {
  anomaly: Anomaly;
}

function formatVal(value: number, label: string): string {
  if (label.toLowerCase().includes("rate") || label.toLowerCase().includes("conversion")) {
    return `${value.toFixed(1)}%`;
  }
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export default function AnomalyCard({ anomaly }: AnomalyCardProps) {
  const isCritical = anomaly.severity === "critical";
  const borderColor = isCritical ? "border-red-500/50" : "border-amber-500/50";
  const iconBg = isCritical ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400";
  const icon = isCritical ? "!!" : "!";
  const direction = anomaly.value > anomaly.expected ? "above" : "below";
  const pctDiff = Math.abs(((anomaly.value - anomaly.expected) / anomaly.expected) * 100);

  return (
    <div className={`bg-slate-800 border ${borderColor} rounded-xl p-4 flex gap-4 items-start`}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 font-bold text-sm ${iconBg}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="font-semibold text-slate-100 text-sm">{anomaly.label}</h4>
          <span className={`text-xs px-2 py-0.5 rounded-full ${isCritical ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"}`}>
            {anomaly.severity}
          </span>
        </div>
        <p className="text-sm text-slate-400">
          {new Date(anomaly.date).toLocaleDateString("en-US", { month: "short", year: "numeric" })}:{" "}
          <span className="text-slate-200">{formatVal(anomaly.value, anomaly.label)}</span>
          {" — "}
          {pctDiff.toFixed(0)}% {direction} average ({anomaly.deviation > 0 ? "+" : ""}{anomaly.deviation}σ)
        </p>
      </div>
    </div>
  );
}
