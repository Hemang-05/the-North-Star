// ============================================================================
// PERSONAL OS — SaaS Status Engine & AI Facts Tests
// Deterministic status evaluation, transparent heuristics, and strategic AI audit.
// ============================================================================

import { describe, it, expect } from 'vitest';
import { evaluateSaasStatus } from '../services/statusEngine';
import { generateOfflineSaasAudit, type SaasAiFacts } from '../services/aiContext';
import { computeSaasKpis } from '../services/saasKpi';
import type { Goal } from '../types';

describe('SaaS Status Engine & AI Audit', () => {
  const emptyKpis = computeSaasKpis([], [], [], [], [], [], [], []);

  it('evaluates completely uninitialized SaaS pillar as NEGLECTED', () => {
    const evaluation = evaluateSaasStatus(emptyKpis, []);
    expect(evaluation.verdict).toBe('NEGLECTED');
    expect(evaluation.score).toBeLessThanOrEqual(20);
    expect(evaluation.badges).toContain('Uninitialized');
  });

  it('evaluates zero weekly activity as NEGLECTED even with past data', () => {
    const dormantKpis = {
      ...emptyKpis,
      totalFeatures: 4,
      featuresDone: 2,
      totalDistributionActivities: 5,
      totalUsers: 10,
      focusTimeTotalSeconds: 36000,
      daysActiveThisWeek: 0,
      focusTimeThisWeekSeconds: 0,
      distributionThisWeek: 0,
    };

    const evaluation = evaluateSaasStatus(dormantKpis, []);
    expect(evaluation.verdict).toBe('NEGLECTED');
    expect(evaluation.headline).toContain('Zero Activity in 7 Days');
  });

  it('evaluates exceeding goal pace as EXCEEDING with appropriate badges', () => {
    const activeKpis = {
      ...emptyKpis,
      totalFeatures: 6,
      featuresDone: 5,
      totalUsers: 120,
      payingUsers: 18,
      daysActiveThisWeek: 5,
      focusTimeThisWeekSeconds: 20000,
      distributionThisWeek: 6,
    };

    const goal: Goal = {
      id: 'g-users',
      pillarId: 'trading_os',
      title: 'Active Users Target',
      targetType: 'COUNT',
      targetValue: 100,
      currentComputedValue: 120, // 120%
      cadence: 'MONTHLY',
      weight: 100,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    const evaluation = evaluateSaasStatus(activeKpis, [goal]);
    expect(evaluation.verdict).toBe('EXCEEDING');
    expect(evaluation.score).toBeGreaterThanOrEqual(90);
  });

  it('flags unresolved critical feedback as AT_RISK even when goal pace is adequate', () => {
    const atRiskKpis = {
      ...emptyKpis,
      totalFeatures: 4,
      featuresDone: 3,
      totalUsers: 80,
      criticalOrHighFeedback: 2, // 2 critical/high bugs open
      daysActiveThisWeek: 4,
      focusTimeThisWeekSeconds: 15000,
      distributionThisWeek: 4,
    };

    const goal: Goal = {
      id: 'g-users',
      pillarId: 'trading_os',
      title: 'Users Target',
      targetType: 'COUNT',
      targetValue: 100,
      currentComputedValue: 80, // 80%
      cadence: 'MONTHLY',
      weight: 100,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    const evaluation = evaluateSaasStatus(atRiskKpis, [goal]);
    expect(evaluation.verdict).toBe('AT_RISK');
    expect(evaluation.headline).toContain('High-Severity Feedback Open');
    expect(evaluation.badges).toContain('Feedback Risk');
  });

  it('flags distribution starvation warning in heuristic mode when building without distribution', () => {
    const starvationKpis = {
      ...emptyKpis,
      totalFeatures: 5,
      featuresInProgress: 3,
      totalDistributionActivities: 0, // 0 distribution!
      distributionThisWeek: 0,
      daysActiveThisWeek: 4,
      focusTimeThisWeekSeconds: 12000,
    };

    const evaluation = evaluateSaasStatus(starvationKpis, []);
    expect(evaluation.verdict).toBe('AT_RISK');
    expect(evaluation.headline).toContain('Distribution Starvation [Heuristic]');
    expect(evaluation.badges).toContain('Distribution Starvation');
  });

  it('generates offline strategic SaaS audit using deterministic facts without hallucinations', () => {
    const facts: SaasAiFacts = {
      timestamp: new Date().toISOString(),
      pillar: 'trading_os',
      status: {
        verdict: 'ON_TRACK',
        score: 80,
        headline: 'Healthy SaaS Momentum [Heuristic]',
        reason: 'Solid build and distribution balance.',
      },
      product: {
        totalFeatures: 4,
        inProgress: 1,
        completed: 2,
        blocked: 0,
        completionRate: '50.0%',
        testPassRate: '100.0%',
        totalReleases: 1,
        latestReleaseVersion: 'v0.1.0',
        developmentFocusFormatted: '6h 00m',
        testingFocusFormatted: '1h 30m',
      },
      distribution: {
        totalActivities: 3,
        activitiesThisWeek: 3,
        channelBreakdown: { LINKEDIN: 2, DISCORD: 1 },
        distributionFocusFormatted: '2h 00m',
      },
      business: {
        totalUsers: 10,
        activeUsers: 7,
        payingUsers: 1,
        payingConversionRate: '10.0%',
        recurringRevenueFormatted: '₹100',
        revenueFormatted: '₹100',
      },
      balance: {
        buildRatio: '70%',
        distributionRatio: '30%',
        observedMeasurement: '70% Build / 30% Distribution',
      },
      feedback: {
        totalFeedback: 1,
        openCount: 1,
        criticalOrHighCount: 1,
        topIssues: [
          {
            content: 'Users want faster dashboard loading',
            severity: 'HIGH',
            status: 'OPEN',
            relatedFeature: 'Dashboard Redesign',
          },
        ],
      },
      focusTime: {
        todayFormatted: '1h 00m',
        thisWeekFormatted: '9h 30m',
        totalFormatted: '25h 00m',
        categoryBreakdown: { 'Product Development': '6h 00m', Distribution: '2h 00m', Testing: '1h 30m' },
      },
      activeGoals: [
        {
          title: '100+ Active Users',
          cadence: 'MONTHLY',
          targetValue: 100,
          currentValue: 10,
          unit: 'users',
          progressPercent: '10%',
        },
      ],
    };

    const audit = generateOfflineSaasAudit(facts);

    expect(audit).toContain('Trading OS → SaaS — Strategic Product & Business Audit');
    expect(audit).toContain('2 completed, 1 in dev');
    expect(audit).toContain('10 total users (7 active, 1 paying)');
    expect(audit).toContain('High-Severity Feedback Alert');
    expect(audit).toContain('70% Build / 30% Distribution');
    expect(audit).toContain('100+ Active Users');
  });
});
