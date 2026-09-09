// ============================================================================
// PERSONAL OS — SaaS KPI Engine Tests
// Unit tests for product velocity, test pass rate, distribution, user metrics,
// and product vs distribution effort balance.
// ============================================================================

import { describe, it, expect } from 'vitest';
import { computeSaasKpis } from '../services/saasKpi';
import type {
  SaasFeature,
  SaasTestRun,
  SaasRelease,
  SaasDistributionActivity,
  SaasUserMetricSnapshot,
  SaasFeedback,
  FocusSession,
  ActivityEvent,
} from '../types';

describe('SaaS KPI Engine', () => {
  const refDate = new Date('2026-09-05T12:00:00Z');

  it('handles completely empty inputs safely with null rates and zero counts', () => {
    const kpis = computeSaasKpis([], [], [], [], [], [], [], [], refDate);

    expect(kpis.totalFeatures).toBe(0);
    expect(kpis.featuresDone).toBe(0);
    expect(kpis.featureCompletionRate).toBeNull();
    expect(kpis.totalTestRuns).toBe(0);
    expect(kpis.testPassRate).toBeNull();
    expect(kpis.totalReleases).toBe(0);
    expect(kpis.publishedReleases).toBe(0);
    expect(kpis.latestRelease).toBeNull();
    expect(kpis.totalDistributionActivities).toBe(0);
    expect(kpis.totalUsers).toBe(0);
    expect(kpis.activeUsers).toBe(0);
    expect(kpis.payingUsers).toBe(0);
    expect(kpis.recurringRevenue).toBe(0);
    expect(kpis.revenue).toBe(0);
    expect(kpis.payingConversionRate).toBeNull();
    expect(kpis.totalFeedback).toBe(0);
    expect(kpis.openFeedback).toBe(0);
    expect(kpis.criticalOrHighFeedback).toBe(0);
    expect(kpis.buildRatioPercent).toBe(50);
    expect(kpis.distributionRatioPercent).toBe(50);
    expect(kpis.balanceLabel).toBe('50% Build / 50% Distribution');
  });

  it('computes feature status breakdown and completion rate', () => {
    const features: SaasFeature[] = [
      { id: 'f-1', name: 'Order Book', status: 'DONE', priority: 'P0', category: 'Trading', createdAt: '2026-09-01T10:00:00Z', updatedAt: '2026-09-02T10:00:00Z' },
      { id: 'f-2', name: 'Risk Engine', status: 'DONE', priority: 'P0', category: 'Trading', createdAt: '2026-09-01T10:00:00Z', updatedAt: '2026-09-03T10:00:00Z' },
      { id: 'f-3', name: 'Strategy Backtester', status: 'IN_PROGRESS', priority: 'P1', category: 'Trading', createdAt: '2026-09-02T10:00:00Z', updatedAt: '2026-09-04T10:00:00Z' },
      { id: 'f-4', name: 'Broker API', status: 'BLOCKED', priority: 'P1', category: 'Integrations', createdAt: '2026-09-03T10:00:00Z', updatedAt: '2026-09-04T10:00:00Z' },
      { id: 'f-5', name: 'Mobile Layout', status: 'PLANNED', priority: 'P2', category: 'UI', createdAt: '2026-09-04T10:00:00Z', updatedAt: '2026-09-04T10:00:00Z' },
    ];

    const kpis = computeSaasKpis(features, [], [], [], [], [], [], [], refDate);

    expect(kpis.totalFeatures).toBe(5);
    expect(kpis.featuresDone).toBe(2);
    expect(kpis.featuresInProgress).toBe(1);
    expect(kpis.featuresBlocked).toBe(1);
    expect(kpis.featuresPlanned).toBe(1);
    expect(kpis.featureCompletionRate).toBe(40); // 2/5 = 40%
  });

  it('computes testing pass rate correctly and safely', () => {
    const tests: SaasTestRun[] = [
      { id: 't-1', featureId: 'f-1', testType: 'Unit', result: 'PASS', executedAt: '2026-09-02T10:00:00Z', createdAt: '2026-09-02T10:00:00Z' },
      { id: 't-2', featureId: 'f-1', testType: 'Integration', result: 'PASS', executedAt: '2026-09-02T11:00:00Z', createdAt: '2026-09-02T11:00:00Z' },
      { id: 't-3', featureId: 'f-2', testType: 'Regression', result: 'FAIL', executedAt: '2026-09-03T10:00:00Z', createdAt: '2026-09-03T10:00:00Z' },
      { id: 't-4', featureId: 'f-3', testType: 'E2E', result: 'BLOCKED', executedAt: '2026-09-04T10:00:00Z', createdAt: '2026-09-04T10:00:00Z' },
    ];

    const kpis = computeSaasKpis([], tests, [], [], [], [], [], [], refDate);

    expect(kpis.totalTestRuns).toBe(4);
    expect(kpis.passTestRuns).toBe(2);
    expect(kpis.failTestRuns).toBe(1);
    expect(kpis.blockedTestRuns).toBe(1);
    expect(kpis.testPassRate).toBe(50); // 2/4 = 50%
  });

  it('determines latest published release', () => {
    const releases: SaasRelease[] = [
      { id: 'r-1', version: 'v0.1.0', releaseName: 'Alpha', releaseNotes: 'Initial', status: 'PUBLISHED', releasedAt: '2026-08-15T10:00:00Z', createdAt: '2026-08-15T10:00:00Z' },
      { id: 'r-2', version: 'v0.2.0', releaseName: 'Beta', releaseNotes: 'Upgrades', status: 'PUBLISHED', releasedAt: '2026-09-01T10:00:00Z', createdAt: '2026-09-01T10:00:00Z' },
      { id: 'r-3', version: 'v0.3.0', releaseName: 'RC', releaseNotes: 'Staging candidate', status: 'DRAFT', createdAt: '2026-09-04T10:00:00Z' },
    ];

    const kpis = computeSaasKpis([], [], releases, [], [], [], [], [], refDate);

    expect(kpis.totalReleases).toBe(3);
    expect(kpis.publishedReleases).toBe(2);
    expect(kpis.latestRelease?.version).toBe('v0.3.0'); // most recent created
  });

  it('computes distribution metrics and channel breakdown', () => {
    const distribution: SaasDistributionActivity[] = [
      { id: 'd-1', channel: 'LINKEDIN', activityType: 'POST', quantity: 1, createdAt: '2026-09-04T10:00:00Z' },
      { id: 'd-2', channel: 'LINKEDIN', activityType: 'OUTREACH', quantity: 5, createdAt: '2026-09-03T10:00:00Z' },
      { id: 'd-3', channel: 'DISCORD', activityType: 'COMMUNITY', quantity: 1, createdAt: '2026-09-02T10:00:00Z' },
      { id: 'd-4', channel: 'X', activityType: 'POST', quantity: 1, createdAt: '2026-08-01T10:00:00Z' }, // >30d ago
    ];

    const kpis = computeSaasKpis([], [], [], distribution, [], [], [], [], refDate);

    expect(kpis.totalDistributionActivities).toBe(4);
    expect(kpis.distributionByChannel.LINKEDIN).toBe(2);
    expect(kpis.distributionByChannel.DISCORD).toBe(1);
    expect(kpis.distributionByChannel.X).toBe(1);
    expect(kpis.distributionThisWeek).toBe(3); // d-1, d-2, d-3
    expect(kpis.distributionThisMonth).toBe(3);
  });

  it('extracts latest observed user snapshot and calculates paying conversion', () => {
    const snapshots: SaasUserMetricSnapshot[] = [
      { id: 's-1', totalUsers: 5, activeUsers: 3, newUsers: 5, payingUsers: 0, churnedUsers: 0, revenue: 0, recurringRevenue: 0, recordedAt: '2026-08-20T10:00:00Z', createdAt: '2026-08-20T10:00:00Z' },
      { id: 's-2', totalUsers: 10, activeUsers: 7, newUsers: 5, payingUsers: 2, churnedUsers: 1, revenue: 200, recurringRevenue: 200, recordedAt: '2026-09-05T10:00:00Z', createdAt: '2026-09-05T10:00:00Z' },
    ];

    const kpis = computeSaasKpis([], [], [], [], snapshots, [], [], [], refDate);

    expect(kpis.totalUsers).toBe(10);
    expect(kpis.activeUsers).toBe(7);
    expect(kpis.payingUsers).toBe(2);
    expect(kpis.recurringRevenue).toBe(200);
    expect(kpis.revenue).toBe(200);
    expect(kpis.payingConversionRate).toBe(20); // 2/10 = 20%
    expect(kpis.activationRate).toBe(70); // 7/10 = 70%
    expect(kpis.retentionRate).toBe(90); // (10-1)/10 = 90%
  });

  it('triages feedback counts by type and severity', () => {
    const feedback: SaasFeedback[] = [
      { id: 'fb-1', source: 'Discord', feedbackType: 'BUG', severity: 'CRITICAL', status: 'OPEN', content: 'Chart crashes', createdAt: '2026-09-01T10:00:00Z' },
      { id: 'fb-2', source: 'LinkedIn', feedbackType: 'PERFORMANCE', severity: 'HIGH', status: 'OPEN', content: 'Slow order book', createdAt: '2026-09-02T10:00:00Z' },
      { id: 'fb-3', source: 'Email', feedbackType: 'FEATURE_REQUEST', severity: 'MEDIUM', status: 'RESOLVED', content: 'Dark mode', createdAt: '2026-09-03T10:00:00Z' },
    ];

    const kpis = computeSaasKpis([], [], [], [], [], feedback, [], [], refDate);

    expect(kpis.totalFeedback).toBe(3);
    expect(kpis.openFeedback).toBe(2);
    expect(kpis.resolvedFeedback).toBe(1);
    expect(kpis.criticalOrHighFeedback).toBe(2);
    expect(kpis.feedbackByType.BUG).toBe(1);
    expect(kpis.feedbackByType.PERFORMANCE).toBe(1);
    expect(kpis.feedbackByType.FEATURE_REQUEST).toBe(1);
  });

  it('calculates product vs distribution balance without subjective health judgement', () => {
    const features: SaasFeature[] = [
      { id: 'f-1', name: 'Trading Engine', status: 'DONE', priority: 'P0', category: 'Core', createdAt: '2026-09-01T10:00:00Z', updatedAt: '2026-09-01T10:00:00Z' },
    ];
    const tests: SaasTestRun[] = [
      { id: 't-1', featureId: 'f-1', testType: 'Unit', result: 'PASS', executedAt: '2026-09-01T10:00:00Z', createdAt: '2026-09-01T10:00:00Z' },
    ];
    const distribution: SaasDistributionActivity[] = [
      { id: 'd-1', channel: 'LINKEDIN', activityType: 'POST', quantity: 1, createdAt: '2026-09-01T10:00:00Z' },
    ];
    const focusSessions: FocusSession[] = [
      // 120 mins of product development
      { id: 'fs-1', pillarId: 'trading_os', category: 'Product Development', durationSeconds: 7200, status: 'COMPLETED', startedAt: '2026-09-04T10:00:00Z', completedAt: '2026-09-04T12:00:00Z' },
      // 60 mins of distribution
      { id: 'fs-2', pillarId: 'trading_os', category: 'Distribution', durationSeconds: 3600, status: 'COMPLETED', startedAt: '2026-09-04T13:00:00Z', completedAt: '2026-09-04T14:00:00Z' },
    ];

    const kpis = computeSaasKpis(features, tests, [], distribution, [], [], focusSessions, [], refDate);

    // Build effort = 120 mins + (1 feature + 1 test + 0 releases) = 122
    // Distribution effort = 60 mins + 1 distribution activity = 61
    // Total effort = 183
    // Build ratio = round(122 / 183 * 100) = 67%
    // Distribution ratio = 33%
    expect(kpis.buildEffortScore).toBe(122);
    expect(kpis.distributionEffortScore).toBe(61);
    expect(kpis.buildRatioPercent).toBe(67);
    expect(kpis.distributionRatioPercent).toBe(33);
    expect(kpis.balanceLabel).toBe('67% Build / 33% Distribution');
  });
});
