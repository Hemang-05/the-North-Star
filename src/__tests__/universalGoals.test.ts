import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validateGoal } from '../services/goalValidation';
import { evaluateGoalSnapshot } from '../services/kpiEvaluation';
import type { Goal } from '../types';

describe('Universal Goals System & Contracts', () => {
  it('validates legitimate user goals', () => {
    const validGoal: Partial<Goal> = {
      title: 'Weekly Outreach',
      metricKey: 'job_hunt.outreachThisWeek',
      targetValue: 15,
      cadence: 'WEEKLY',
      pillarId: 'job_hunt',
    };

    const res = validateGoal(validGoal);
    expect(res.valid).toBe(true);
    expect(res.errors.length).toBe(0);
  });

  it('rejects goals referencing unregistered metric keys', () => {
    const invalidGoal: Partial<Goal> = {
      title: 'Hypothetical Metric',
      metricKey: 'fake.unregisteredKey',
      targetValue: 10,
      cadence: 'MONTHLY',
    };

    const res = validateGoal(invalidGoal);
    expect(res.valid).toBe(false);
    expect(res.errors[0]).toContain('Unknown metric key');
  });

  it('rejects non-positive target values', () => {
    const invalidGoal: Partial<Goal> = {
      title: 'Zero Target',
      metricKey: 'agency.activeClients',
      targetValue: 0,
      cadence: 'MONTHLY',
    };

    const res = validateGoal(invalidGoal);
    expect(res.valid).toBe(false);
    expect(res.errors[0]).toContain('greater than zero');
  });

  it('supports user-editable North Star target with no hardcoded ₹1Cr formula dependency', async () => {
    const customNorthStarGoal: Goal = {
      id: 'ns-user',
      pillarId: null,
      title: 'North Star',
      metricKey: 'north_star.financialProceeds',
      targetType: 'CURRENCY',
      targetValue: 5000000, // User edited to ₹50L instead of ₹1Cr
      cadence: 'NORTH_STAR',
      currentComputedValue: 0,
      unit: '₹',
      weight: 100,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    const mockContext: any = {
      agency: { realizedCash: 1000000 },
      voire: { cashReceived: 500000 },
    };

    const snapshot = await evaluateGoalSnapshot(customNorthStarGoal, mockContext);
    expect(snapshot.target).toBe(5000000);
    expect(snapshot.current).toBe(1500000);
    expect(snapshot.progressPercent).toBe(30); // 15L / 50L = 30%
    expect(snapshot.gap).toBe(3500000); // 50L - 15L = 35L gap
  });

  it('preserves historical goal periods and values upon target edit', async () => {
    const originalGoal: Goal = {
      id: 'g-agency-cash',
      pillarId: 'agency',
      title: 'Monthly Cash Target',
      metricKey: 'agency.realizedCash',
      targetType: 'CURRENCY',
      targetValue: 300000,
      cadence: 'MONTHLY',
      currentComputedValue: 240000,
      unit: '₹',
      weight: 80,
      isActive: true,
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      createdAt: '2026-08-01T00:00:00Z',
    };

    const mockContext: any = {
      agency: { realizedCash: 240000 },
    };

    // Historical snapshot for August
    const augSnap = await evaluateGoalSnapshot(originalGoal, mockContext);
    expect(augSnap.target).toBe(300000);
    expect(augSnap.progressPercent).toBe(80);

    // Now edit target for September
    const updatedGoal: Goal = {
      ...originalGoal,
      targetValue: 500000,
      startDate: '2026-09-01',
      updatedAt: '2026-09-01T00:00:00Z',
    };

    const septSnap = await evaluateGoalSnapshot(updatedGoal, mockContext);
    expect(septSnap.target).toBe(500000);
    expect(septSnap.progressPercent).toBe(48); // 240000 / 500000 = 48%

    // August evaluation remains intact with its original 300000 target
    expect(augSnap.target).toBe(300000);
  });
});
