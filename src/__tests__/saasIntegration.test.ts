// ============================================================================
// PERSONAL OS — SaaS End-to-End Acceptance Integration Test
// Validates the exact acceptance scenario required for Pillar 3: Trading OS → SaaS.
// ============================================================================

import { describe, it, expect } from 'vitest';
import { computeSaasKpis } from '../services/saasKpi';
import { evaluateSaasStatus } from '../services/statusEngine';
import { generateOfflineSaasAudit, type SaasAiFacts } from '../services/aiContext';
import type {
  SaasFeature,
  SaasTestRun,
  SaasRelease,
  SaasDistributionActivity,
  SaasUserMetricSnapshot,
  SaasFeedback,
  ActivityEvent,
  Goal,
} from '../types';
import { formatINR, formatSafePercent } from '../utils/helpers';

describe('Trading OS → SaaS Acceptance Scenario Integration', () => {
  const refDate = new Date('2026-09-05T12:00:00Z');

  // 1. Feature: Dashboard Redesign, status: IN_PROGRESS
  const feature: SaasFeature = {
    id: 'feat-dashboard-redesign',
    name: 'Dashboard Redesign',
    description: 'Redesign trading console for low-latency workflow',
    status: 'IN_PROGRESS',
    priority: 'P1',
    category: 'Core Trading',
    createdAt: '2026-09-05T10:00:00Z',
    updatedAt: '2026-09-05T10:00:00Z',
  };

  // 2. Test: Associated with Dashboard Redesign, result: PASS
  const testRun: SaasTestRun = {
    id: 'test-order-book-stream',
    featureId: 'feat-dashboard-redesign',
    testType: 'Integration',
    result: 'PASS',
    notes: 'Streaming order book verified',
    executedAt: '2026-09-05T10:30:00Z',
    createdAt: '2026-09-05T10:30:00Z',
  };

  // 3. Release: v0.1.0, marked as released
  const release: SaasRelease = {
    id: 'rel-v010',
    version: 'v0.1.0',
    releaseName: 'Alpha MVP',
    releaseNotes: 'Initial release with live trading dashboard and risk controls',
    status: 'PUBLISHED',
    releasedAt: '2026-09-05T11:00:00Z',
    createdAt: '2026-09-05T11:00:00Z',
  };

  // 4. Distribution: LinkedIn post, Direct outreach, Community post
  const distribution: SaasDistributionActivity[] = [
    {
      id: 'dist-1',
      channel: 'LINKEDIN',
      activityType: 'POST',
      quantity: 1,
      notes: 'Shared demo teaser video',
      createdAt: '2026-09-05T11:15:00Z',
    },
    {
      id: 'dist-2',
      channel: 'DIRECT_OUTREACH',
      activityType: 'OUTREACH',
      quantity: 5,
      notes: 'DMed 5 algo traders on LinkedIn',
      createdAt: '2026-09-05T11:30:00Z',
    },
    {
      id: 'dist-3',
      channel: 'COMMUNITY',
      activityType: 'COMMUNITY',
      quantity: 1,
      notes: 'Answered questions in trading Discord',
      createdAt: '2026-09-05T11:45:00Z',
    },
  ];

  // 5. User snapshot: Total 10, Active 7, Paying 1, Recurring revenue: ₹100
  const snapshot: SaasUserMetricSnapshot = {
    id: 'snap-1',
    totalUsers: 10,
    activeUsers: 7,
    newUsers: 10,
    payingUsers: 1,
    churnedUsers: 0,
    revenue: 100,
    recurringRevenue: 100,
    recordedAt: '2026-09-05T11:50:00Z',
    createdAt: '2026-09-05T11:50:00Z',
  };

  // 6. Feedback: Users want faster dashboard loading, PERFORMANCE, HIGH, linked to Dashboard Redesign
  const feedback: SaasFeedback = {
    id: 'fb-1',
    source: 'Direct Outreach',
    feedbackType: 'PERFORMANCE',
    severity: 'HIGH',
    status: 'OPEN',
    content: 'Users want faster dashboard loading',
    relatedFeatureId: 'feat-dashboard-redesign',
    createdAt: '2026-09-05T11:55:00Z',
  };

  // 7. Activity Events corresponding to all the actions
  const activityEvents: ActivityEvent[] = [
    {
      id: 'evt-feat-created',
      pillarId: 'trading_os',
      eventType: 'SAAS_FEATURE_CREATED',
      occurredAt: '2026-09-05T10:00:00Z',
      entityRefType: 'SaasFeature',
      entityRefId: 'feat-dashboard-redesign',
      metadata: { name: 'Dashboard Redesign', priority: 'P1', category: 'Core Trading' },
    },
    {
      id: 'evt-test-run',
      pillarId: 'trading_os',
      eventType: 'SAAS_TEST_RUN',
      occurredAt: '2026-09-05T10:30:00Z',
      entityRefType: 'SaasTestRun',
      entityRefId: 'test-order-book-stream',
      metadata: { featureId: 'feat-dashboard-redesign', testType: 'Integration', result: 'PASS' },
    },
    {
      id: 'evt-rel-published',
      pillarId: 'trading_os',
      eventType: 'SAAS_RELEASE_PUBLISHED',
      occurredAt: '2026-09-05T11:00:00Z',
      entityRefType: 'SaasRelease',
      entityRefId: 'rel-v010',
      metadata: { version: 'v0.1.0', releaseName: 'Alpha MVP' },
    },
    {
      id: 'evt-dist-1',
      pillarId: 'trading_os',
      eventType: 'SAAS_DISTRIBUTION_ACTIVITY',
      occurredAt: '2026-09-05T11:15:00Z',
      quantity: 1,
      unit: 'activity',
      entityRefType: 'SaasDistributionActivity',
      entityRefId: 'dist-1',
      metadata: { channel: 'LINKEDIN', activityType: 'POST' },
    },
    {
      id: 'evt-dist-2',
      pillarId: 'trading_os',
      eventType: 'SAAS_DISTRIBUTION_ACTIVITY',
      occurredAt: '2026-09-05T11:30:00Z',
      quantity: 5,
      unit: 'activity',
      entityRefType: 'SaasDistributionActivity',
      entityRefId: 'dist-2',
      metadata: { channel: 'DIRECT_OUTREACH', activityType: 'OUTREACH' },
    },
    {
      id: 'evt-dist-3',
      pillarId: 'trading_os',
      eventType: 'SAAS_DISTRIBUTION_ACTIVITY',
      occurredAt: '2026-09-05T11:45:00Z',
      quantity: 1,
      unit: 'activity',
      entityRefType: 'SaasDistributionActivity',
      entityRefId: 'dist-3',
      metadata: { channel: 'COMMUNITY', activityType: 'COMMUNITY' },
    },
    {
      id: 'evt-user-snap',
      pillarId: 'trading_os',
      eventType: 'SAAS_USER_METRIC_RECORDED',
      occurredAt: '2026-09-05T11:50:00Z',
      entityRefType: 'SaasUserMetricSnapshot',
      entityRefId: 'snap-1',
      metadata: { totalUsers: 10, activeUsers: 7, payingUsers: 1, recurringRevenue: 100 },
    },
    {
      id: 'evt-feedback',
      pillarId: 'trading_os',
      eventType: 'SAAS_FEEDBACK_RECEIVED',
      occurredAt: '2026-09-05T11:55:00Z',
      entityRefType: 'SaasFeedback',
      entityRefId: 'fb-1',
      metadata: { feedbackType: 'PERFORMANCE', severity: 'HIGH', relatedFeatureId: 'feat-dashboard-redesign' },
    },
  ];

  it('verifies deterministic KPI calculations for the acceptance scenario', () => {
    const kpis = computeSaasKpis(
      [feature],
      [testRun],
      [release],
      distribution,
      [snapshot],
      [feedback],
      [],
      activityEvents,
      refDate
    );

    // Feature verification
    expect(kpis.totalFeatures).toBe(1);
    expect(kpis.featuresInProgress).toBe(1);
    expect(kpis.featuresDone).toBe(0);

    // Test verification
    expect(kpis.totalTestRuns).toBe(1);
    expect(kpis.passTestRuns).toBe(1);
    expect(kpis.testPassRate).toBe(100);

    // Release verification
    expect(kpis.totalReleases).toBe(1);
    expect(kpis.publishedReleases).toBe(1);
    expect(kpis.latestRelease?.version).toBe('v0.1.0');

    // Distribution verification
    expect(kpis.totalDistributionActivities).toBe(3);
    expect(kpis.distributionThisWeek).toBe(3);
    expect(kpis.distributionByChannel.LINKEDIN).toBe(1);
    expect(kpis.distributionByChannel.DIRECT_OUTREACH).toBe(1);
    expect(kpis.distributionByChannel.COMMUNITY).toBe(1);

    // User metrics verification
    expect(kpis.totalUsers).toBe(10);
    expect(kpis.activeUsers).toBe(7);
    expect(kpis.payingUsers).toBe(1);
    expect(kpis.payingConversionRate).toBe(10); // 1 / 10 = 10%
    expect(kpis.recurringRevenue).toBe(100);
    expect(kpis.revenue).toBe(100);

    // Feedback verification
    expect(kpis.totalFeedback).toBe(1);
    expect(kpis.openFeedback).toBe(1);
    expect(kpis.criticalOrHighFeedback).toBe(1);

    // Observed product vs distribution balance
    // Build effort: 0 min focus + (1 feature + 1 test + 1 release) = 3
    // Distribution effort: 0 min focus + 3 distribution activities = 3
    // 3 / 6 = 50% Build / 50% Distribution
    expect(kpis.buildEffortScore).toBe(3);
    expect(kpis.distributionEffortScore).toBe(3);
    expect(kpis.buildRatioPercent).toBe(50);
    expect(kpis.distributionRatioPercent).toBe(50);
    expect(kpis.balanceLabel).toBe('50% Build / 50% Distribution');
  });

  it('evaluates status verdict with open high-severity feedback alert', () => {
    const kpis = computeSaasKpis(
      [feature],
      [testRun],
      [release],
      distribution,
      [snapshot],
      [feedback],
      [],
      activityEvents,
      refDate
    );

    const goal: Goal = {
      id: 'g-users',
      pillarId: 'trading_os',
      title: 'Active Users Target',
      targetType: 'COUNT',
      targetValue: 100,
      currentComputedValue: 10,
      cadence: 'MONTHLY',
      weight: 100,
      isActive: true,
      createdAt: '2026-09-01T00:00:00Z',
    };

    const evalResult = evaluateSaasStatus(kpis, [goal]);
    expect(evalResult.verdict).toBe('BEHIND'); // 10/100 = 10% of monthly target

    // Without goal, heuristic reflects active traction
    const heuristicEval = evaluateSaasStatus(kpis, []);
    expect(heuristicEval.verdict).toBe('ON_TRACK');
    expect(heuristicEval.headline).toContain('Healthy SaaS Momentum');
  });

  it('verifies AI audit interprets deterministic facts without hallucinations', () => {
    const kpis = computeSaasKpis(
      [feature],
      [testRun],
      [release],
      distribution,
      [snapshot],
      [feedback],
      [],
      activityEvents,
      refDate
    );

    const facts: SaasAiFacts = {
      timestamp: refDate.toISOString(),
      pillar: 'trading_os',
      status: {
        verdict: 'ON_TRACK',
        score: 75,
        headline: 'Healthy SaaS Momentum [Heuristic]',
        reason: '1 feature in dev, 1 published release, 3 distribution activities.',
      },
      product: {
        totalFeatures: kpis.totalFeatures,
        inProgress: kpis.featuresInProgress,
        completed: kpis.featuresDone,
        blocked: kpis.featuresBlocked,
        completionRate: formatSafePercent(kpis.featureCompletionRate),
        testPassRate: formatSafePercent(kpis.testPassRate),
        totalReleases: kpis.totalReleases,
        latestReleaseVersion: kpis.latestRelease?.version || 'None',
        developmentFocusFormatted: '0m 00s',
        testingFocusFormatted: '0m 00s',
      },
      distribution: {
        totalActivities: kpis.totalDistributionActivities,
        activitiesThisWeek: kpis.distributionThisWeek,
        channelBreakdown: { LINKEDIN: 1, DIRECT_OUTREACH: 1, COMMUNITY: 1 },
        distributionFocusFormatted: '0m 00s',
      },
      business: {
        totalUsers: kpis.totalUsers,
        activeUsers: kpis.activeUsers,
        payingUsers: kpis.payingUsers,
        payingConversionRate: formatSafePercent(kpis.payingConversionRate),
        recurringRevenueFormatted: formatINR(kpis.recurringRevenue),
        revenueFormatted: formatINR(kpis.revenue),
      },
      balance: {
        buildRatio: `${kpis.buildRatioPercent}%`,
        distributionRatio: `${kpis.distributionRatioPercent}%`,
        observedMeasurement: kpis.balanceLabel,
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
        todayFormatted: '0m 00s',
        thisWeekFormatted: '0m 00s',
        totalFormatted: '0m 00s',
        categoryBreakdown: {},
      },
      activeGoals: [],
    };

    const audit = generateOfflineSaasAudit(facts);

    // Exact reality checks
    expect(audit).toContain('Trading OS → SaaS — Strategic Product & Business Audit');
    expect(audit).toContain('0 completed, 1 in dev');
    expect(audit).toContain('Pass Rate: 100.0%');
    expect(audit).toContain('Published Releases: 1 (Latest: v0.1.0)');
    expect(audit).toContain('10 total users (7 active, 1 paying)');
    expect(audit).toContain('₹100 MRR');
    expect(audit).toContain('10.0% paying conversion');
    expect(audit).toContain('High-Severity Feedback Alert');
    expect(audit).toContain('50% Build / 50% Distribution');
  });

  it('explicitly validates universal ActivityEvent ledger schema for all SaaS events', () => {
    for (const evt of activityEvents) {
      expect(evt.id).toBeDefined();
      expect(evt.pillarId).toBe('trading_os');
      expect(evt.occurredAt).toBeDefined();
      expect(evt.eventType.startsWith('SAAS_')).toBe(true);

      // Must have valid entityRefType and entityRefId
      expect(evt.entityRefType).toBeDefined();
      expect(evt.entityRefId).toBeDefined();
      expect(typeof evt.entityRefType).toBe('string');
      expect(typeof evt.entityRefId).toBe('string');

      // Metadata must be an object
      expect(evt.metadata).toBeDefined();
      expect(typeof evt.metadata).toBe('object');
    }
  });
});
