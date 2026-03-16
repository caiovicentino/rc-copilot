import type { Insight } from "@/lib/types";

interface InsightCardProps {
  insight: Insight;
}

const severityConfig = {
  info: {
    border: "border-blue-500/30",
    icon: "bg-blue-500/20 text-blue-400",
    badge: "bg-blue-500/20 text-blue-400",
    iconText: "i",
  },
  warning: {
    border: "border-amber-500/30",
    icon: "bg-amber-500/20 text-amber-400",
    badge: "bg-amber-500/20 text-amber-400",
    iconText: "!",
  },
  critical: {
    border: "border-red-500/30",
    icon: "bg-red-500/20 text-red-400",
    badge: "bg-red-500/20 text-red-400",
    iconText: "!!",
  },
};

export default function InsightCard({ insight }: InsightCardProps) {
  const config = severityConfig[insight.severity];

  return (
    <div className={`bg-slate-800 border ${config.border} rounded-xl p-5 flex flex-col gap-3`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs ${config.icon}`}>
          {config.iconText}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-slate-100 text-sm">{insight.title}</h4>
          {insight.metric && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${config.badge} inline-block mt-1`}>
              {insight.metric}
            </span>
          )}
        </div>
      </div>
      <p className="text-sm text-slate-400 leading-relaxed">{insight.description}</p>
      {insight.recommendation && (
        <div className="bg-slate-900/50 rounded-lg p-3 mt-1">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Recommendation</p>
          <p className="text-sm text-slate-300">{insight.recommendation}</p>
        </div>
      )}
    </div>
  );
}
