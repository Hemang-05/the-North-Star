import { describe, it, expect } from 'vitest';
import {
  generateAlertFingerprint,
  generatePeriodOccurrenceId,
  evaluateAlerts,
} from '../services/alertEngine.js';
import type { Alert, DataQualityReport, CrossPillarFact } from '../types/layer5.js';
import type { GoalKpiSnapshot, PeriodBounds } from '../types';

describe('Alert Engine (Layer 5)', () => {
  const currentPeriod: PeriodBounds = {
    type: 'WEEKLY',
    start: '2026-03-01T00:00:00.000Z',
    end: '2026-03-07T23:59:59.999Z',
    label: 'Week 10',
  };

  const previousPeriod: PeriodBounds = {
    type: 'WEEKLY',
    start: '2026-02-22T00:00:00.000Z',
    end: '2026-02-28T23:59:59.999Z',
    label: 'Week 9',
  };

  const emptyDataQualityReport: DataQualityReport = {
    period: currentPeriod,
    checkedAt: '2026-03-07T12:00:00.000Z',
    summary: {
      totalIssues: 0,
      criticalCount: 0,
      warningCount: 0,
      infoCount: 0,
      byCategory: {
        COMPLETENESS: 0,
        VALIDITY: 0,
        CONSISTENCY: 0,
        DUPLICATION: 0,
        REFERENTIAL_INTEGRITY: 0,
        TEMPORAL_INTEGRITY: 0,
      },
    },
    issues: [],
  };

  it('generates deterministic logical fingerprints and period occurrence IDs', () => {
    const fp1 = generateAlertFingerprint('GOAL_REGRESSION', ['agency'], 'goal-revenue-1');
    const fp2 = generateAlertFingerprint('GOAL_REGRESSION', ['agency'], 'goal-revenue-1');
    expect(fp1).toBe(fp2);
    expect(fp1).toBe('GOAL_REGRESSION:agency:goal-revenue-1');

    // Sorting of pillars in fingerprint
    const fpMulti1 = generateAlertFingerprint('TIME_MISMATCH', ['agency', 'fitness'], 'time-tradeoff');
    const fpMulti2 = generateAlertFingerprint('TIME_MISMATCH', ['fitness', 'agency'], 'time-tradeoff');
    expect(fpMulti1).toBe(fpMulti2);

    const occId = generatePeriodOccurrenceId(fp1, currentPeriod);
    expect(occId).toBe(`alert:${fp1}:2026-03-01_2026-03-07`);
  });

  it('detects GOAL_REGRESSION when a goal regresses from AHEAD/ON_TRACK to BEHIND vs comparable period', () => {
    const previousSnapshots: GoalKpiSnapshot[] = [
      {
        id: 'snap-prev-1',
        goalId: 'goal-agency-rev',
        pillarId: 'agency',
        period: previousPeriod,
        snapshotDate: previousPeriod.end,
        targetValue: 10000,
        currentValue: 10500,
        status: 'ON_TRACK',
        kpiValues: {},
      },
    ];

    const currentSnapshots: GoalKpiSnapshot[] = [
      {
        id: 'snap-curr-1',
        goalId: 'goal-agency-rev',
        pillarId: 'agency',
        period: currentPeriod,
        snapshotDate: currentPeriod.end,
        targetValue: 12000,
        currentValue: 6000,
        status: 'BEHIND',
        kpiValues: {},
      },
    ];

    const evaluation = evaluateAlerts({
      currentPeriod,
      previousPeriodSnapshots: previousSnapshots,
      currentSnapshots,
      facts: [],
      dataQuality: emptyDataQualityReport,
      existingAlerts: [],
    });

    expect(evaluation.alertsToUpsert.length).toBe(1);
    const alert = evaluation.alertsToUpsert[0];
    expect(alert.type).toBe('GOAL_REGRESSION');
    expect(alert.severity).toBe('CRITICAL');
    expect(alert.status).toBe('OPEN');
    expect(alert.occurrenceCount).toBe(1);
    expect(alert.metadata?.previousStatus).toBe('ON_TRACK');
    expect(alert.metadata?.currentStatus).toBe('BEHIND');
  });

  it('preserves ACKNOWLEDGED state and increments occurrenceCount on re-evaluation in the same period', () => {
    const fp = generateAlertFingerprint('GOAL_REGRESSION', ['agency'], 'goal-agency-rev');
    const occId = generatePeriodOccurrenceId(fp, currentPeriod);

    const existingAcknowledgedAlert: Alert = {
      id: occId,
      fingerprint: fp,
      type: 'GOAL_REGRESSION',
      severity: 'CRITICAL',
      status: 'ACKNOWLEDGED',
      title: 'Goal Regressed: Agency Revenue',
      description: 'Status changed from ON_TRACK to BEHIND',
      message: 'Status changed from ON_TRACK to BEHIND',
      evidence: [
        {
          sourceType: 'GOAL',
          sourceId: 'snap-curr-1',
          value: 'BEHIND',
        },
      ],
      evidenceIds: ['snapshot:snap-curr-1'],
      pillarIds: ['agency'],
      period: currentPeriod,
      detectedAt: '2026-03-01T10:00:00.000Z',
      lastEvaluatedAt: '2026-03-01T10:00:00.000Z',
      firstDetectedAt: '2026-03-01T10:00:00.000Z',
      lastDetectedAt: '2026-03-01T10:00:00.000Z',
      occurrenceCount: 1,
      acknowledgedAt: '2026-03-02T14:00:00.000Z',
      acknowledgedBy: 'user',
    };

    const previousSnapshots: GoalKpiSnapshot[] = [
      {
        id: 'snap-prev-1',
        goalId: 'goal-agency-rev',
        pillarId: 'agency',
        period: previousPeriod,
        snapshotDate: previousPeriod.end,
        targetValue: 10000,
        currentValue: 10500,
        status: 'ON_TRACK',
        kpiValues: {},
      },
    ];

    const currentSnapshots: GoalKpiSnapshot[] = [
      {
        id: 'snap-curr-1',
        goalId: 'goal-agency-rev',
        pillarId: 'agency',
        period: currentPeriod,
        snapshotDate: currentPeriod.end,
        targetValue: 12000,
        currentValue: 6000,
        status: 'BEHIND',
        kpiValues: {},
      },
    ];

    const evaluation = evaluateAlerts({
      currentPeriod,
      previousPeriodSnapshots: previousSnapshots,
      currentSnapshots,
      facts: [],
      dataQuality: emptyDataQualityReport,
      existingAlerts: [existingAcknowledgedAlert],
    });

    expect(evaluation.alertsToUpsert.length).toBe(1);
    const updated = evaluation.alertsToUpsert[0];
    expect(updated.status).toBe('ACKNOWLEDGED'); // Preserved user state
    expect(updated.occurrenceCount).toBe(2); // Incremented
    expect(updated.acknowledgedAt).toBe('2026-03-02T14:00:00.000Z');
  });

  it('auto-resolves active alert when condition clears on subsequent calculation', () => {
    const fp = generateAlertFingerprint('GOAL_REGRESSION', ['agency'], 'goal-agency-rev');
    const occId = generatePeriodOccurrenceId(fp, currentPeriod);

    const existingAlert: Alert = {
      id: occId,
      fingerprint: fp,
      type: 'GOAL_REGRESSION',
      severity: 'CRITICAL',
      status: 'OPEN',
      title: 'Goal Regressed: Agency Revenue',
      description: 'Status changed from ON_TRACK to BEHIND',
      message: 'Status changed from ON_TRACK to BEHIND',
      evidence: [
        {
          sourceType: 'GOAL',
          sourceId: 'snap-curr-1',
          value: 'BEHIND',
        },
      ],
      evidenceIds: ['snapshot:snap-curr-1'],
      pillarIds: ['agency'],
      period: currentPeriod,
      detectedAt: '2026-03-01T10:00:00.000Z',
      lastEvaluatedAt: '2026-03-01T10:00:00.000Z',
      firstDetectedAt: '2026-03-01T10:00:00.000Z',
      lastDetectedAt: '2026-03-01T10:00:00.000Z',
      occurrenceCount: 1,
    };

    // Goal is now ON_TRACK (recovered)
    const currentSnapshots: GoalKpiSnapshot[] = [
      {
        id: 'snap-curr-recovered',
        goalId: 'goal-agency-rev',
        pillarId: 'agency',
        period: currentPeriod,
        snapshotDate: currentPeriod.end,
        targetValue: 12000,
        currentValue: 12500,
        status: 'ON_TRACK',
        kpiValues: {},
      },
    ];

    const evaluation = evaluateAlerts({
      currentPeriod,
      previousPeriodSnapshots: [],
      currentSnapshots,
      facts: [],
      dataQuality: emptyDataQualityReport,
      existingAlerts: [existingAlert],
    });

    expect(evaluation.alertsToUpsert.length).toBe(1);
    const resolved = evaluation.alertsToUpsert[0];
    expect(resolved.status).toBe('RESOLVED');
    expect(resolved.resolutionReason).toBe('CONDITION_CLEARED');
    expect(resolved.resolvedAt).toBeDefined();
  });

  it('escalates CRITICAL data quality violations into high-severity alerts', () => {
    const criticalQualityReport: DataQualityReport = {
      period: currentPeriod,
      checkedAt: '2026-03-07T12:00:00.000Z',
      summary: {
        totalIssues: 1,
        criticalCount: 1,
        warningCount: 0,
        infoCount: 0,
        byCategory: {
          COMPLETENESS: 0,
          VALIDITY: 0,
          CONSISTENCY: 0,
          DUPLICATION: 0,
          REFERENTIAL_INTEGRITY: 0,
          TEMPORAL_INTEGRITY: 1,
        },
      },
      issues: [
        {
          id: 'dq-inv-1',
          severity: 'CRITICAL',
          category: 'TEMPORAL_INTEGRITY',
          pillarId: 'agency',
          title: 'AgencyInvoice Billed Revenue Mismatch',
          description: 'Billed revenue mismatch: sum of paid+sent ($1000) != billed ($2000)',
          evidence: [
            {
              sourceType: 'DATA_QUALITY',
              sourceId: 'inv-viol-1',
              metricKey: 'billedRevenue',
              value: 2000,
            },
          ],
        },
      ],
    };

    const evaluation = evaluateAlerts({
      currentPeriod,
      previousPeriodSnapshots: [],
      currentSnapshots: [],
      facts: [],
      dataQuality: criticalQualityReport,
      existingAlerts: [],
    });

    const dqAlert = evaluation.alertsToUpsert.find(a => a.type === 'DATA_QUALITY');
    expect(dqAlert).toBeDefined();
    expect(dqAlert?.severity).toBe('CRITICAL');
    expect(dqAlert?.title).toContain('AgencyInvoice');
    expect(dqAlert?.evidenceIds).toContain('data_quality:inv-viol-1');
  });

  it('generates alerts from TIME_MISMATCH and BUSINESS_EXCEPTION cross-pillar facts', () => {
    const facts: CrossPillarFact[] = [
      {
        id: 'fact-tradeoff-1',
        type: 'TRADEOFF',
        severity: 'WARNING',
        pillarIds: ['agency', 'fitness'],
        title: 'Time Tradeoff: Agency vs Fitness',
        description: 'Agency received 30h while Fitness received 1h this week.',
        evidence: [
          {
            sourceType: 'ACTIVITY_EVENT',
            sourceId: 'act-1',
            value: 30,
          },
        ],
        period: currentPeriod,
        createdAt: '2026-03-07T12:00:00.000Z',
      },
    ];

    const evaluation = evaluateAlerts({
      currentPeriod,
      previousPeriodSnapshots: [],
      currentSnapshots: [],
      facts,
      dataQuality: emptyDataQualityReport,
      existingAlerts: [],
    });

    const timeAlert = evaluation.alertsToUpsert.find(a => a.type === 'TIME_MISMATCH');
    expect(timeAlert).toBeDefined();
    expect(timeAlert?.severity).toBe('WARNING');
    expect(timeAlert?.pillarIds).toContain('agency');
    expect(timeAlert?.pillarIds).toContain('fitness');
  });
});
