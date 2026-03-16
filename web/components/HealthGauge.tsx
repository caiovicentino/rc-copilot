"use client";

interface HealthGaugeProps {
  score: number;
}

export default function HealthGauge({ score }: HealthGaugeProps) {
  const clampedScore = Math.max(0, Math.min(100, score));
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const progress = (clampedScore / 100) * circumference;
  const offset = circumference - progress;

  let color = "text-emerald-500";
  let bgRing = "stroke-emerald-500/20";
  let label = "Healthy";
  if (clampedScore < 50) {
    color = "text-red-500";
    bgRing = "stroke-red-500/20";
    label = "Needs Attention";
  } else if (clampedScore < 80) {
    color = "text-amber-500";
    bgRing = "stroke-amber-500/20";
    label = "Fair";
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 flex flex-col items-center gap-3">
      <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Health Score</h3>
      <div className="relative w-32 h-32">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            strokeWidth="8"
            className={bgRing}
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            className={`${color.replace("text-", "stroke-")}`}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{
              transition: "stroke-dashoffset 1s ease-in-out",
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-bold ${color}`}>{clampedScore}</span>
          <span className="text-xs text-slate-400">/ 100</span>
        </div>
      </div>
      <span className={`text-sm font-semibold ${color}`}>{label}</span>
    </div>
  );
}
