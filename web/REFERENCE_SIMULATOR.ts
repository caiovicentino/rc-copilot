import type { SimulatorInput, WhatIfScenario } from './types.js';

// ─── What-If Simulator ──────────────────────────────────────────────────────

export function simulateChurnReduction(
  input: SimulatorInput,
  targetChurnReduction: number
): WhatIfScenario {
  const currentChurn = input.currentChurnRate;
  const newChurn = Math.max(0, currentChurn - targetChurnReduction);
  const currentMonthlyLoss = input.currentMRR * (currentChurn / 100);
  const newMonthlyLoss = input.currentMRR * (newChurn / 100);
  const monthlySavings = currentMonthlyLoss - newMonthlyLoss;

  // Compound over 12 months
  let cumulativeMRR = 0;
  let mrr = input.currentMRR;
  for (let month = 1; month <= 12; month++) {
    const retained = mrr * (targetChurnReduction / 100);
    cumulativeMRR += retained;
    mrr += retained; // MRR grows as fewer customers churn
  }

  return {
    name: 'Reduce Churn',
    description: `Reduce monthly churn from ${currentChurn.toFixed(1)}% to ${newChurn.toFixed(1)}%`,
    currentValue: currentChurn,
    targetValue: newChurn,
    unit: '%',
    projectedImpact: `+$${Math.round(monthlySavings)}/mo saved, compounding to +$${Math.round(cumulativeMRR)} additional MRR over 12 months`,
    mrrImpact12Months: Math.round(cumulativeMRR),
    revenueImpact12Months: Math.round(cumulativeMRR * 12),
  };
}

export function simulateTrialImprovement(
  input: SimulatorInput,
  targetConversionRate: number
): WhatIfScenario {
  const currentConv = input.currentTrialConversion;
  const currentPayingPerMonth = input.monthlyNewCustomers * (currentConv / 100);
  const newPayingPerMonth = input.monthlyNewCustomers * (targetConversionRate / 100);
  const additionalPerMonth = newPayingPerMonth - currentPayingPerMonth;
  const additionalMRRPerMonth = additionalPerMonth * input.avgRevenuePerUser;

  // Compound over 12 months
  let cumulativeMRR = 0;
  for (let month = 1; month <= 12; month++) {
    cumulativeMRR += additionalMRRPerMonth * month;
  }
  const avgMonthlyImpact = cumulativeMRR / 12;

  return {
    name: 'Improve Trial Conversion',
    description: `Increase trial conversion from ${currentConv.toFixed(0)}% to ${targetConversionRate.toFixed(0)}%`,
    currentValue: currentConv,
    targetValue: targetConversionRate,
    unit: '%',
    projectedImpact: `+${Math.round(additionalPerMonth)} additional paying users/month, +$${Math.round(additionalMRRPerMonth)}/mo in MRR`,
    mrrImpact12Months: Math.round(avgMonthlyImpact),
    revenueImpact12Months: Math.round(cumulativeMRR),
  };
}

export function simulateCustomerGrowth(
  input: SimulatorInput,
  growthMultiplier: number
): WhatIfScenario {
  const currentNewCustomers = input.monthlyNewCustomers;
  const newCustomers = Math.round(currentNewCustomers * growthMultiplier);
  const additionalCustomers = newCustomers - currentNewCustomers;
  const payingConvRate = input.currentTrialConversion / 100;
  const additionalPaying = additionalCustomers * payingConvRate;
  const additionalMRR = additionalPaying * input.avgRevenuePerUser;

  let cumulativeMRR = 0;
  for (let month = 1; month <= 12; month++) {
    cumulativeMRR += additionalMRR * month;
  }

  return {
    name: 'Increase Customer Acquisition',
    description: `${growthMultiplier}x new customer acquisition (${currentNewCustomers} → ${newCustomers}/month)`,
    currentValue: currentNewCustomers,
    targetValue: newCustomers,
    unit: 'customers/mo',
    projectedImpact: `+${Math.round(additionalPaying)} paying users/month → +$${Math.round(additionalMRR)}/mo MRR`,
    mrrImpact12Months: Math.round(cumulativeMRR / 12),
    revenueImpact12Months: Math.round(cumulativeMRR),
  };
}

export function runAllScenarios(input: SimulatorInput): WhatIfScenario[] {
  return [
    simulateChurnReduction(input, 2),
    simulateTrialImprovement(input, 50),
    simulateCustomerGrowth(input, 2),
  ];
}
