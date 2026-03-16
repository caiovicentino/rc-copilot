import { describe, it, expect } from 'vitest';
import {
  runAllScenarios,
  simulateChurnReduction,
  simulateCustomerGrowth,
  simulateTrialImprovement,
} from '../src/simulator.js';
import type { SimulatorInput } from '../src/types.js';

// ─── Base Input ───────────────────────────────────────────────────────────

const darkNoiseInput: SimulatorInput = {
  currentMRR: 4557,
  currentChurnRate: 7,
  currentTrialConversion: 41,
  activeSubscriptions: 2529,
  monthlyNewCustomers: 500,
  avgRevenuePerUser: 1.8,
};

// ─── simulateChurnReduction ───────────────────────────────────────────────

describe('simulateChurnReduction', () => {
  it('returns WhatIfScenario with correct name', () => {
    const result = simulateChurnReduction(darkNoiseInput, 2);
    expect(result.name).toBe('Reduce Churn');
  });

  it('calculates new churn = currentChurn - reduction', () => {
    const result = simulateChurnReduction(darkNoiseInput, 2);
    expect(result.targetValue).toBe(5); // 7 - 2 = 5
    expect(result.currentValue).toBe(7);
  });

  it('clamps new churn to 0 (cannot be negative)', () => {
    const result = simulateChurnReduction(darkNoiseInput, 15);
    expect(result.targetValue).toBe(0);
  });

  it('handles churn reduction to exactly 0%', () => {
    const result = simulateChurnReduction(darkNoiseInput, 7);
    expect(result.targetValue).toBe(0);
    expect(result.mrrImpact12Months).toBeGreaterThan(0);
  });

  it('mrrImpact12Months is positive when churn is reduced', () => {
    const result = simulateChurnReduction(darkNoiseInput, 2);
    expect(result.mrrImpact12Months).toBeGreaterThan(0);
  });

  it('revenueImpact12Months is close to mrrImpact * 12 (rounding may differ)', () => {
    const result = simulateChurnReduction(darkNoiseInput, 2);
    // revenueImpact = round(cumulativeMRR * 12), mrrImpact = round(cumulativeMRR)
    // so they differ by at most 12 due to rounding
    const diff = Math.abs(result.revenueImpact12Months - result.mrrImpact12Months * 12);
    expect(diff).toBeLessThanOrEqual(12);
  });

  it('projectedImpact string contains /mo and 12 months', () => {
    const result = simulateChurnReduction(darkNoiseInput, 2);
    expect(result.projectedImpact).toContain('/mo');
    expect(result.projectedImpact).toContain('12 months');
  });

  it('unit is %', () => {
    const result = simulateChurnReduction(darkNoiseInput, 2);
    expect(result.unit).toBe('%');
  });

  it('larger reduction = larger impact', () => {
    const small = simulateChurnReduction(darkNoiseInput, 1);
    const large = simulateChurnReduction(darkNoiseInput, 3);
    expect(large.mrrImpact12Months).toBeGreaterThan(small.mrrImpact12Months);
  });

  it('zero reduction = zero impact', () => {
    const result = simulateChurnReduction(darkNoiseInput, 0);
    expect(result.mrrImpact12Months).toBe(0);
    expect(result.revenueImpact12Months).toBe(0);
  });

  it('description mentions current and new churn rates', () => {
    const result = simulateChurnReduction(darkNoiseInput, 2);
    expect(result.description).toContain('7.0%');
    expect(result.description).toContain('5.0%');
  });
});

// ─── simulateTrialImprovement ─────────────────────────────────────────────

describe('simulateTrialImprovement', () => {
  it('returns WhatIfScenario with correct name', () => {
    const result = simulateTrialImprovement(darkNoiseInput, 50);
    expect(result.name).toBe('Improve Trial Conversion');
  });

  it('currentValue is current trial conversion', () => {
    const result = simulateTrialImprovement(darkNoiseInput, 50);
    expect(result.currentValue).toBe(41);
  });

  it('targetValue is provided conversion rate', () => {
    const result = simulateTrialImprovement(darkNoiseInput, 50);
    expect(result.targetValue).toBe(50);
  });

  it('mrrImpact12Months > 0 when improving conversion', () => {
    const result = simulateTrialImprovement(darkNoiseInput, 50);
    expect(result.mrrImpact12Months).toBeGreaterThan(0);
  });

  it('revenueImpact12Months is cumulative (sum of monthly * months)', () => {
    const result = simulateTrialImprovement(darkNoiseInput, 50);
    expect(result.revenueImpact12Months).toBeGreaterThan(result.mrrImpact12Months);
  });

  it('projectedImpact mentions additional paying users', () => {
    const result = simulateTrialImprovement(darkNoiseInput, 50);
    expect(result.projectedImpact).toContain('additional paying users');
  });

  it('unit is %', () => {
    const result = simulateTrialImprovement(darkNoiseInput, 50);
    expect(result.unit).toBe('%');
  });

  it('100% conversion maximizes impact', () => {
    const result = simulateTrialImprovement(darkNoiseInput, 100);
    expect(result.mrrImpact12Months).toBeGreaterThan(0);
    expect(result.targetValue).toBe(100);
  });

  it('same conversion rate = zero additional impact', () => {
    const result = simulateTrialImprovement(darkNoiseInput, 41);
    expect(result.mrrImpact12Months).toBe(0);
    expect(result.revenueImpact12Months).toBe(0);
  });

  it('higher target = larger impact', () => {
    const low = simulateTrialImprovement(darkNoiseInput, 50);
    const high = simulateTrialImprovement(darkNoiseInput, 70);
    expect(high.mrrImpact12Months).toBeGreaterThan(low.mrrImpact12Months);
  });

  it('description mentions current and target conversion rates', () => {
    const result = simulateTrialImprovement(darkNoiseInput, 50);
    expect(result.description).toContain('41%');
    expect(result.description).toContain('50%');
  });
});

// ─── simulateCustomerGrowth ───────────────────────────────────────────────

describe('simulateCustomerGrowth', () => {
  it('returns WhatIfScenario with correct name', () => {
    const result = simulateCustomerGrowth(darkNoiseInput, 2);
    expect(result.name).toBe('Increase Customer Acquisition');
  });

  it('targetValue = currentNewCustomers * multiplier', () => {
    const result = simulateCustomerGrowth(darkNoiseInput, 2);
    expect(result.targetValue).toBe(1000); // 500 * 2
    expect(result.currentValue).toBe(500);
  });

  it('mrrImpact12Months > 0 for multiplier > 1', () => {
    const result = simulateCustomerGrowth(darkNoiseInput, 2);
    expect(result.mrrImpact12Months).toBeGreaterThan(0);
  });

  it('revenueImpact12Months = cumulative MRR sum', () => {
    const result = simulateCustomerGrowth(darkNoiseInput, 2);
    expect(result.revenueImpact12Months).toBeGreaterThan(result.mrrImpact12Months);
  });

  it('description includes current and new customer count', () => {
    const result = simulateCustomerGrowth(darkNoiseInput, 2);
    expect(result.description).toContain('500');
    expect(result.description).toContain('1000');
  });

  it('projectedImpact includes paying users and MRR', () => {
    const result = simulateCustomerGrowth(darkNoiseInput, 2);
    expect(result.projectedImpact).toContain('paying users');
    expect(result.projectedImpact).toContain('MRR');
  });

  it('unit is customers/mo', () => {
    const result = simulateCustomerGrowth(darkNoiseInput, 2);
    expect(result.unit).toBe('customers/mo');
  });

  it('multiplier = 1 gives zero additional impact', () => {
    const result = simulateCustomerGrowth(darkNoiseInput, 1);
    expect(result.mrrImpact12Months).toBe(0);
  });

  it('larger multiplier = larger impact', () => {
    const x2 = simulateCustomerGrowth(darkNoiseInput, 2);
    const x3 = simulateCustomerGrowth(darkNoiseInput, 3);
    expect(x3.mrrImpact12Months).toBeGreaterThan(x2.mrrImpact12Months);
  });
});

// ─── runAllScenarios ──────────────────────────────────────────────────────

describe('runAllScenarios', () => {
  it('returns array of 3 scenarios', () => {
    const results = runAllScenarios(darkNoiseInput);
    expect(results).toHaveLength(3);
  });

  it('includes Reduce Churn scenario', () => {
    const results = runAllScenarios(darkNoiseInput);
    expect(results.find((s) => s.name === 'Reduce Churn')).toBeDefined();
  });

  it('includes Improve Trial Conversion scenario', () => {
    const results = runAllScenarios(darkNoiseInput);
    expect(results.find((s) => s.name === 'Improve Trial Conversion')).toBeDefined();
  });

  it('includes Increase Customer Acquisition scenario', () => {
    const results = runAllScenarios(darkNoiseInput);
    expect(results.find((s) => s.name === 'Increase Customer Acquisition')).toBeDefined();
  });

  it('all scenarios have positive revenue impact for normal input', () => {
    const results = runAllScenarios(darkNoiseInput);
    for (const s of results) {
      expect(s.revenueImpact12Months).toBeGreaterThanOrEqual(0);
    }
  });

  it('works with zero MRR', () => {
    const zeroInput: SimulatorInput = { ...darkNoiseInput, currentMRR: 0 };
    const results = runAllScenarios(zeroInput);
    expect(results).toHaveLength(3);
  });

  it('works with zero monthly new customers', () => {
    const noCustomers: SimulatorInput = { ...darkNoiseInput, monthlyNewCustomers: 0 };
    const results = runAllScenarios(noCustomers);
    expect(results).toHaveLength(3);
    const trialScenario = results.find((s) => s.name === 'Improve Trial Conversion');
    expect(trialScenario!.mrrImpact12Months).toBe(0);
  });
});
