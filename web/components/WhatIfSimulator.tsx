"use client";

import { useState } from "react";

interface SimulatorProps {
  currentMRR: number;
  currentChurnRate: number;
  currentTrialConversion: number;
  monthlyNewCustomers: number;
  avgRevenuePerUser: number;
  activeSubscriptions: number;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

export default function WhatIfSimulator({
  currentMRR,
  currentChurnRate,
  currentTrialConversion,
  monthlyNewCustomers,
  avgRevenuePerUser,
}: SimulatorProps) {
  const [churnReduction, setChurnReduction] = useState(0);
  const [trialImprovement, setTrialImprovement] = useState(0);
  const [customerGrowth, setCustomerGrowth] = useState(0);

  // Churn reduction impact
  const churnSavedMRR = currentMRR * (churnReduction / 100);
  let churnCumulativeMRR = 0;
  let mrrAccum = currentMRR;
  for (let m = 1; m <= 12; m++) {
    const retained = mrrAccum * (churnReduction / 100);
    churnCumulativeMRR += retained;
    mrrAccum += retained;
  }

  // Trial improvement impact
  const additionalPayingPerMonth = monthlyNewCustomers * (trialImprovement / 100);
  const trialMRRPerMonth = additionalPayingPerMonth * avgRevenuePerUser;
  let trialCumulativeMRR = 0;
  for (let m = 1; m <= 12; m++) {
    trialCumulativeMRR += trialMRRPerMonth * m;
  }

  // Customer growth impact
  const additionalCustomers = monthlyNewCustomers * (customerGrowth / 100);
  const growthPayingPerMonth = additionalCustomers * (currentTrialConversion / 100);
  const growthMRRPerMonth = growthPayingPerMonth * avgRevenuePerUser;
  let growthCumulativeMRR = 0;
  for (let m = 1; m <= 12; m++) {
    growthCumulativeMRR += growthMRRPerMonth * m;
  }

  const totalMRRImpact = churnCumulativeMRR + trialCumulativeMRR / 12 + growthCumulativeMRR / 12;
  const projectedMRR = currentMRR + churnSavedMRR + trialMRRPerMonth + growthMRRPerMonth;
  const totalRevenueImpact = churnCumulativeMRR * 12 + trialCumulativeMRR + growthCumulativeMRR;
  const totalAdditionalSubs = Math.round((additionalPayingPerMonth + growthPayingPerMonth) * 12);

  const hasChanges = churnReduction > 0 || trialImprovement > 0 || customerGrowth > 0;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-slate-100 mb-1">What-If Simulator</h3>
      <p className="text-sm text-slate-400 mb-6">Adjust the sliders to see how changes would impact your business</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Sliders */}
        <div className="space-y-6">
          {/* Churn Reduction */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-slate-300">Reduce Churn By</label>
              <span className="text-sm font-bold text-emerald-400">{churnReduction.toFixed(1)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={5}
              step={0.5}
              value={churnReduction}
              onChange={(e) => setChurnReduction(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>0%</span>
              <span>5%</span>
            </div>
          </div>

          {/* Trial Conversion */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-slate-300">Improve Trial Conversion By</label>
              <span className="text-sm font-bold text-emerald-400">{trialImprovement}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={20}
              step={1}
              value={trialImprovement}
              onChange={(e) => setTrialImprovement(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>0%</span>
              <span>20%</span>
            </div>
          </div>

          {/* Customer Growth */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-slate-300">Grow New Customers By</label>
              <span className="text-sm font-bold text-emerald-400">{customerGrowth}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={50}
              step={5}
              value={customerGrowth}
              onChange={(e) => setCustomerGrowth(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>0%</span>
              <span>50%</span>
            </div>
          </div>
        </div>

        {/* Impact Summary */}
        <div className={`space-y-4 transition-opacity duration-300 ${hasChanges ? "opacity-100" : "opacity-40"}`}>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900 rounded-lg p-4">
              <p className="text-xs text-slate-400 mb-1">Current MRR</p>
              <p className="text-xl font-bold text-slate-200">{formatCurrency(currentMRR)}</p>
            </div>
            <div className="bg-slate-900 rounded-lg p-4 border border-emerald-500/30">
              <p className="text-xs text-emerald-400 mb-1">Projected MRR</p>
              <p className="text-xl font-bold text-emerald-400">{formatCurrency(projectedMRR)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900 rounded-lg p-4">
              <p className="text-xs text-slate-400 mb-1">Additional Subs (12mo)</p>
              <p className="text-lg font-bold text-slate-200">+{totalAdditionalSubs.toLocaleString()}</p>
            </div>
            <div className="bg-slate-900 rounded-lg p-4">
              <p className="text-xs text-slate-400 mb-1">Revenue Impact (12mo)</p>
              <p className="text-lg font-bold text-emerald-400">+{formatCurrency(totalRevenueImpact)}</p>
            </div>
          </div>

          {hasChanges && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
              <p className="text-sm text-emerald-300">
                These changes could increase your MRR by{" "}
                <span className="font-bold">{formatCurrency(projectedMRR - currentMRR)}/mo</span> and generate an
                additional <span className="font-bold">{formatCurrency(totalRevenueImpact)}</span> in revenue over 12
                months.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
