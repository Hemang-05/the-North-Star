import { describe, it, expect } from 'vitest';
import { computeCrossPillarFacts } from '../services/crossPillarIntelligence';
import type { TimeSummary, GoalKpiSnapshot, PeriodBounds } from '../types';
import type { KpisEvaluationContext } from '../services/kpiEvaluation';

describe('Cross-Pillar Intelligence Engine', () => {
  const period: PeriodBounds = {
    start: '2026-09-01T00:00:00.000Z',
    end: '2026-09-07T23:59:59.999Z',
    type: 'THIS_WEEK',
    label: 'This Week',
  };

  const createBaseTimeSummary = (): TimeSummary => ({
    totalMinutes: 600,
    totalHours: 10,
    byPillar: {
      job_hunt: 150,
      agency: 150,
      trading_os: 150,
      forex: 50,
      fitness: 50,
      voire: 50,
    },
    pillarDetails: [
      {
        pillarId: 'job_hunt',
        title: 'Job Hunt',
        color: '#6366f1',
        priorityRank: 1,
        minutes: 150,
        hours: 2.5,
        sharePercent: 25,
        sessionCount: 3,
        averageSessionMinutes: 50,
        longestSessionMinutes: 60,
        byCategory: {},
      },
      {
        pillarId: 'agency',
        title: 'Agency',
        color: '#8b5cf6',
        priorityRank: 2,
        minutes: 150,
        hours: 2.5,
        sharePercent: 25,
        sessionCount: 3,
        averageSessionMinutes: 50,
        longestSessionMinutes: 60,
        byCategory: {},
      },
      {
        pillarId: 'trading_os',
        title: 'Trading OS',
        color: '#06b6d4',
        priorityRank: 3,
        minutes: 150,
        hours: 2.5,
        sharePercent: 25,
        sessionCount: 3,
        averageSessionMinutes: 50,
        longestSessionMinutes: 60,
        byCategory: {},
      },
      {
        pillarId: 'forex',
        title: 'Forex Learning',
        color: '#f59e0b',
        priorityRank: 4,
        minutes: 50,
        hours: 0.8,
        sharePercent: 8.3,
        sessionCount: 1,
        averageSessionMinutes: 50,
        longestSessionMinutes: 50,
        byCategory: {},
      },
      {
        pillarId: 'fitness',
        title: 'Fitness & Health',
        color: '#ef4444',
        priorityRank: 5,
        minutes: 50,
        hours: 0.8,
        sharePercent: 8.3,
        sessionCount: 1,
        averageSessionMinutes: 50,
        longestSessionMinutes: 50,
        byCategory: {},
      },
      {
        pillarId: 'voire',
        title: 'VOIRE',
        color: '#ec4899',
        priorityRank: 6,
        minutes: 50,
        hours: 0.8,
        sharePercent: 8.3,
        sessionCount: 1,
        averageSessionMinutes: 50,
        longestSessionMinutes: 50,
        byCategory: {},
      },
    ],
    byCategory: {},
    sessionCount: 12,
    averageSessionMinutes: 50,
    longestSessionMinutes: 60,
    deepWorkMinutes: 450,
    deepWorkSessionCount: 9,
    deepWorkRatioPercent: 75,
    priorityAlignedMinutes: 450,
    priorityAlignedPercent: 75,
    period,
  });

  it('detects PRIORITY_TIME_MISMATCH when lower priority pillars dominate focus', () => {
    const timeSummary = createBaseTimeSummary();
    timeSummary.totalMinutes = 600;

    // Top 3 priority pillars receive only 15% (90 mins), lower priority receive 85% (510 mins)
    timeSummary.pillarDetails[0].minutes = 30; // Job Hunt
    timeSummary.pillarDetails[0].sharePercent = 5;
    timeSummary.pillarDetails[1].minutes = 30; // Agency
    timeSummary.pillarDetails[1].sharePercent = 5;
    timeSummary.pillarDetails[2].minutes = 30; // Trading OS
    timeSummary.pillarDetails[2].sharePercent = 5;

    timeSummary.pillarDetails[3].minutes = 200; // Forex
    timeSummary.pillarDetails[3].sharePercent = 33.3;
    timeSummary.pillarDetails[4].minutes = 200; // Fitness
    timeSummary.pillarDetails[4].sharePercent = 33.3;
    timeSummary.pillarDetails[5].minutes = 110; // VOIRE
    timeSummary.pillarDetails[5].sharePercent = 18.3;

    const facts = computeCrossPillarFacts({
      timeSummary,
      goalSnapshots: [],
      kpisContext: {},
      period,
    });

    const mismatchFact = facts.find((f) => f.type === 'PRIORITY_TIME_MISMATCH');
    expect(mismatchFact).toBeDefined();
    expect(mismatchFact?.severity).toBe('WARNING');
    expect(mismatchFact?.description).toContain('lower-priority pillars');
  });

  it('detects TIME_CONCENTRATION when a single pillar exceeds 70% focus', () => {
    const timeSummary = createBaseTimeSummary();
    timeSummary.totalMinutes = 600;

    // Job Hunt receives 80% of all focus
    timeSummary.pillarDetails[0].minutes = 480;
    timeSummary.pillarDetails[0].hours = 8;
    timeSummary.pillarDetails[0].sharePercent = 80;

    const facts = computeCrossPillarFacts({
      timeSummary,
      goalSnapshots: [],
      kpisContext: {},
      period,
    });

    const concentrationFact = facts.find((f) => f.type === 'TIME_CONCENTRATION');
    expect(concentrationFact).toBeDefined();
    expect(concentrationFact?.pillarIds).toContain('job_hunt');
    expect(concentrationFact?.description).toContain('80%');
  });

  it('detects TIME_NEGLECT for Priority 1-3 pillars while respecting VOIRE weekday neutrality', () => {
    const timeSummary = createBaseTimeSummary();
    timeSummary.totalMinutes = 400;

    // Job Hunt receives 0 minutes
    timeSummary.pillarDetails[0].minutes = 0;
    timeSummary.pillarDetails[0].sharePercent = 0;

    // VOIRE also has 0 minutes, but refDate is a Wednesday (2026-09-02)
    timeSummary.pillarDetails[5].minutes = 0;
    timeSummary.pillarDetails[5].sharePercent = 0;

    const wednesday = new Date('2026-09-02T12:00:00.000Z');

    const facts = computeCrossPillarFacts({
      timeSummary,
      goalSnapshots: [],
      kpisContext: {},
      period,
      now: wednesday,
    });

    const jobHuntNeglect = facts.find((f) => f.type === 'TIME_NEGLECT' && f.pillarIds.includes('job_hunt'));
    expect(jobHuntNeglect).toBeDefined();

    // VOIRE weekday inactivity must NOT be flagged as neglect on Wednesday!
    const voireNeglect = facts.find((f) => f.type === 'TIME_NEGLECT' && f.pillarIds.includes('voire'));
    expect(voireNeglect).toBeUndefined();
  });

  it('detects TRADEOFF shifts between comparable periods and escalates if affected pillar is behind', () => {
    const timeSummary = createBaseTimeSummary();
    // Agency increased by 40%, Job Hunt decreased by 35%
    timeSummary.pillarDetails[0].changePercent = -35; // Job Hunt decreased
    timeSummary.pillarDetails[1].changePercent = 40;  // Agency increased

    const goalSnapshots: GoalKpiSnapshot[] = [
      {
        goalId: 'goal_jh_1',
        title: 'Apply to 10 Jobs',
        metricKey: 'job_hunt.applicationsThisWeek',
        pillarId: 'job_hunt',
        period: { start: period.start, end: period.end, cadence: 'WEEKLY' },
        target: 10,
        current: 2,
        state: 'AVAILABLE',
        progress: 0.2,
        progressPercent: 20,
        gap: 8,
        status: 'BEHIND', // Active goal behind!
        direction: 'HIGHER_IS_BETTER',
      },
    ];

    const facts = computeCrossPillarFacts({
      timeSummary,
      goalSnapshots,
      kpisContext: {},
      period,
    });

    const tradeoffFact = facts.find((f) => f.type === 'TRADEOFF');
    expect(tradeoffFact).toBeDefined();
    expect(tradeoffFact?.severity).toBe('WARNING'); // Escalated to warning due to behind goal
    expect(tradeoffFact?.description).toContain('Job Hunt focus decreased');
    expect(tradeoffFact?.description).toContain('active goal currently behind target');
  });

  it('detects TIME_OUTCOME_DIVERGENCE for SaaS build active with 0 distribution', () => {
    const timeSummary = createBaseTimeSummary();
    const kpisContext: KpisEvaluationContext = {
      saas: {
        totalFeatures: 10,
        featuresByStatus: { IDEA: 1, PLANNED: 2, IN_PROGRESS: 2, TESTING: 1, DONE: 4, BLOCKED: 0 },
        featuresIdea: 1,
        featuresPlanned: 2,
        featuresInProgress: 2,
        featuresTesting: 1,
        featuresDone: 4,
        featuresBlocked: 0,
        featureCompletionRate: 40,
        totalTestRuns: 15,
        passTestRuns: 15,
        failTestRuns: 0,
        blockedTestRuns: 0,
        testPassRate: 100,
        totalReleases: 2,
        publishedReleases: 2,
        latestRelease: null,
        developmentFocusSeconds: 14400, // 4 hours of dev focus
        testingFocusSeconds: 1800,
        totalDistributionActivities: 0,
        distributionByChannel: {} as any,
        distributionByActivityType: {} as any,
        distributionThisWeek: 0, // 0 distribution!
        distributionThisMonth: 0,
        distributionFocusSeconds: 0,
        latestSnapshot: null,
        totalUsers: 25,
        activeUsers: 10,
        newUsers: 0,
        payingUsers: 2,
        churnedUsers: 0,
        revenue: 2000,
        recurringRevenue: 2000,
        payingConversionRate: 8,
        activationRate: 40,
        retentionRate: 100,
        totalFeedback: 0,
        openFeedback: 0,
        resolvedFeedback: 0,
        criticalOrHighFeedback: 0,
        feedbackByType: {} as any,
        buildEffortScore: 80,
        distributionEffortScore: 0,
        buildRatioPercent: 100,
        distributionRatioPercent: 0,
        distributionVelocity: 0,
        userGrowthRate: 0,
        mrrGrowthRate: 0,
        netRevenueRetention: 100,
        feedbackResolutionRate: 100,
        activeUsersRatio: 40,
      } as any,
    };

    const facts = computeCrossPillarFacts({
      timeSummary,
      goalSnapshots: [],
      kpisContext,
      period,
    });

    const saasDivergence = facts.find(
      (f) => f.type === 'TIME_OUTCOME_DIVERGENCE' && f.pillarIds.includes('trading_os')
    );
    expect(saasDivergence).toBeDefined();
    expect(saasDivergence?.severity).toBe('WARNING');
    expect(saasDivergence?.description).toContain('0 distribution activities');
  });

  it('detects GOAL_PRESSURE when a goal is BEHIND despite high focus time', () => {
    const timeSummary = createBaseTimeSummary();
    timeSummary.pillarDetails[0].hours = 6.5; // 6.5 hours on Job Hunt

    const goalSnapshots: GoalKpiSnapshot[] = [
      {
        goalId: 'goal_jh_pressured',
        title: 'Reach 3 Screenings',
        metricKey: 'job_hunt.screeningsReached',
        pillarId: 'job_hunt',
        period: { start: period.start, end: period.end, cadence: 'WEEKLY' },
        target: 3,
        current: 0,
        state: 'AVAILABLE',
        progress: 0,
        progressPercent: 0,
        gap: 3,
        status: 'BEHIND',
        direction: 'HIGHER_IS_BETTER',
      },
    ];

    const facts = computeCrossPillarFacts({
      timeSummary,
      goalSnapshots,
      kpisContext: {},
      period,
    });

    const pressureFact = facts.find((f) => f.type === 'GOAL_PRESSURE');
    expect(pressureFact).toBeDefined();
    expect(pressureFact?.title).toContain('Reach 3 Screenings');
    expect(pressureFact?.description).toContain('6.5h of focus spent');
  });

  it('enforces non-causal observational language across all generated facts', () => {
    const timeSummary = createBaseTimeSummary();
    timeSummary.pillarDetails[0].changePercent = -30;
    timeSummary.pillarDetails[1].changePercent = 35;

    const facts = computeCrossPillarFacts({
      timeSummary,
      goalSnapshots: [],
      kpisContext: {},
      period,
    });

    for (const fact of facts) {
      expect(fact.description.toLowerCase()).not.toContain('caused');
      expect(fact.description.toLowerCase()).not.toContain('led to');
      expect(fact.description.toLowerCase()).not.toContain('resulted in');
      expect(fact.description.toLowerCase()).not.toContain('forced');
    }
  });
});
