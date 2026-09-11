// ============================================================================
// PERSONAL OS — Alert & Exception Engine
// Deterministic detection of meaningful operational deviations and lifecycle management.
//
// Axioms:
//   "Alerts are NOT notifications for everything. They represent meaningful deviations."
//   "Fingerprint identifies the logical failure mode; ID binds it to period bounds."
//   "Historical records are preserved: disappearing conditions auto-resolve, never delete."
// ============================================================================

import type {
  PillarSlug,
  PeriodBounds,
  GoalKpiSnapshot,
  TimeSummary,
  AnomalyFact,
  TimePeriodType,
} from '../types';
import type {
  Alert,
  AlertType,
  DataQualityReport,
  EvidenceReference,
  CrossPillarFact,
} from '../types/layer5';
import { Layer5DetectionConfig } from '../config/layer5DetectionConfig';
import { dbGetAll, dbPut, STORES } from './db';
import { notifyDataChange } from '../hooks/useDatabase';
import { getPeriodBounds, loadAllFocusSessions, aggregateFocusSessions } from './timeAggregation';
import { loadAllPillarsKpisContext, evaluateAllGoals } from './kpiEvaluation';
import type { KpisEvaluationContext } from './kpiEvaluation';
import { generateIntelligenceSnapshot } from './intelligenceFacts';
import { runDataQualityCheck } from './dataQuality';

export interface AlertEvaluationParams {
  period?: PeriodBounds | { start: string; end: string; label?: string; type?: TimePeriodType };
  previousPeriod?: PeriodBounds | { start: string; end: string; label?: string; type?: TimePeriodType };
  currentGoals?: GoalKpiSnapshot[];
  previousGoals?: GoalKpiSnapshot[];
  timeSummary?: TimeSummary;
  kpisContext?: KpisEvaluationContext;
  anomalies?: AnomalyFact[];
  dataQualityReport?: DataQualityReport;
  existingAlerts?: Alert[];
  facts?: CrossPillarFact[];
  now?: Date;
  // Aliases for callers & tests
  currentPeriod?: PeriodBounds | { start: string; end: string; label?: string; type?: TimePeriodType };
  currentSnapshots?: GoalKpiSnapshot[];
  previousPeriodSnapshots?: GoalKpiSnapshot[];
  dataQuality?: DataQualityReport;
}

/**
 * Computes the deterministic logical fingerprint for an alert.
 */
export function computeAlertFingerprint(
  type: AlertType,
  pillarIds: PillarSlug[],
  targetKey: string = 'general'
): string {
  const sortedPillars = [...pillarIds].sort().join(',');
  return `${type}:${sortedPillars}:${targetKey}`;
}

export const generateAlertFingerprint = computeAlertFingerprint;

/**
 * Computes the deterministic period-bound occurrence ID for an alert.
 */
export function computeAlertOccurrenceId(fingerprint: string, period: PeriodBounds): string {
  const startDay = period.start.split('T')[0];
  const endDay = period.end.split('T')[0];
  return `alert:${fingerprint}:${startDay}_${endDay}`;
}

export const generatePeriodOccurrenceId = computeAlertOccurrenceId;

/**
 * Pure evaluation function for Alert exceptions and lifecycle state reconciliation.
 */
export function evaluateAlerts(params: AlertEvaluationParams): {
  activeAlerts: Alert[];
  resolvedAlerts: Alert[];
  allCurrentAlerts: Alert[];
  alertsToUpsert: Alert[];
} {
  const rawPeriod = params.period || params.currentPeriod;
  const period: PeriodBounds = rawPeriod
    ? {
        type: (rawPeriod as any).type || 'THIS_WEEK',
        start: rawPeriod.start,
        end: rawPeriod.end,
        label: rawPeriod.label || 'Current Period',
      }
    : {
        type: 'THIS_WEEK',
        start: new Date().toISOString(),
        end: new Date().toISOString(),
        label: 'Current Period',
      };
  const currentGoals = params.currentGoals || params.currentSnapshots || [];
  const previousGoals = params.previousGoals || params.previousPeriodSnapshots || [];
  const timeSummary: TimeSummary = params.timeSummary || {
    totalMinutes: 0,
    totalHours: 0,
    byPillar: {} as any,
    pillarDetails: [],
    byCategory: {},
    sessionCount: 0,
    averageSessionMinutes: 0,
    longestSessionMinutes: 0,
    deepWorkMinutes: 0,
    deepWorkSessionCount: 0,
    deepWorkRatioPercent: 0,
    priorityAlignedMinutes: 0,
    priorityAlignedPercent: 0,
    period,
  };
  const kpisContext = params.kpisContext || {};
  const anomalies = params.anomalies || [];
  const dataQualityReport = params.dataQualityReport || params.dataQuality || {
    totalChecked: 0,
    issuesBySeverity: { CRITICAL: 0, WARNING: 0, INFO: 0 },
    issuesByType: {
      INVALID_TIMESTAMP: 0,
      ORPHANED_RELATION: 0,
      NEGATIVE_AMOUNT: 0,
      ZERO_VALUE_SUSPICION: 0,
      DUPLICATE_ACTIVITY: 0,
      FINANCIAL_INVARIANT_VIOLATION: 0,
      CHRONOLOGY_VIOLATION: 0,
    },
    issues: [],
    runAt: new Date().toISOString(),
  };
  const existingAlerts = params.existingAlerts || [];
  const facts = params.facts || [];
  const now = params.now || new Date();

  const nowIso = now.toISOString();
  const detectedCandidateAlerts: Alert[] = [];

  // Map existing alerts by occurrence ID
  const existingMap = new Map<string, Alert>();
  for (const a of existingAlerts) {
    existingMap.set(a.id, a);
  }

  // --------------------------------------------------------------------------
  // 1. GOAL REGRESSION (Previous on-track -> now behind)
  // --------------------------------------------------------------------------
  for (const curGoal of currentGoals) {
    const prevGoal = previousGoals.find((g) => g.goalId === curGoal.goalId);
    if (prevGoal) {
      const prevWasGood =
        prevGoal.status === 'ON_TRACK' || prevGoal.status === 'AHEAD' || prevGoal.status === 'ACHIEVED';
      const nowIsBad = curGoal.status === 'BEHIND' || curGoal.status === 'NO_DATA';

      if (prevWasGood && nowIsBad) {
        const pillarIds: PillarSlug[] = curGoal.pillarId ? [curGoal.pillarId] : [];
        const fp = computeAlertFingerprint('GOAL_REGRESSION', pillarIds, curGoal.goalId);
        const id = computeAlertOccurrenceId(fp, period);

        const evidence: EvidenceReference[] = [
          {
            sourceType: 'GOAL',
            sourceId: curGoal.goalId,
            metricKey: curGoal.metricKey,
            value: `Previous: ${prevGoal.status} (${prevGoal.progressPercent ?? 0}%) -> Current: ${curGoal.status} (${curGoal.progressPercent ?? 0}%)`,
            period,
          },
        ];

        detectedCandidateAlerts.push({
          id,
          fingerprint: fp,
          type: 'GOAL_REGRESSION',
          severity: 'CRITICAL',
          pillarIds,
          goalId: curGoal.goalId,
          metricKey: curGoal.metricKey,
          period,
          title: `Goal Regressed: "${curGoal.title || curGoal.goalId}"`,
          description: `Goal was previously ${prevGoal.status} (${prevGoal.progressPercent ?? 0}%) in comparable period, but has dropped to ${curGoal.status} (${curGoal.progressPercent ?? 0}%).`,
          message: `Status changed from ${prevGoal.status} to ${curGoal.status}`,
          evidence,
          evidenceIds: [`snapshot:${(curGoal as any).id || curGoal.goalId}`],
          detectedAt: nowIso,
          firstDetectedAt: nowIso,
          lastEvaluatedAt: nowIso,
          occurrenceCount: 1,
          metadata: {
            previousStatus: prevGoal.status,
            currentStatus: curGoal.status,
          },
          status: 'OPEN',
        });
      }
    }
  }

  // --------------------------------------------------------------------------
  // 2. GOAL BEHIND SCHEDULE
  // --------------------------------------------------------------------------
  for (const curGoal of currentGoals) {
    if (
      curGoal.status === 'BEHIND' &&
      curGoal.progress !== null &&
      curGoal.progress < Layer5DetectionConfig.ALERT_GOAL_BEHIND_PROGRESS_THRESHOLD
    ) {
      const pillarIds: PillarSlug[] = curGoal.pillarId ? [curGoal.pillarId] : [];
      const fp = computeAlertFingerprint('GOAL_BEHIND', pillarIds, curGoal.goalId);
      const id = computeAlertOccurrenceId(fp, period);

      detectedCandidateAlerts.push({
        id,
        fingerprint: fp,
        type: 'GOAL_BEHIND',
        severity: 'WARNING',
        pillarIds,
        goalId: curGoal.goalId,
        metricKey: curGoal.metricKey,
        period,
        title: `Goal Critically Behind Target: "${curGoal.title}"`,
        description: `Current progress is only ${curGoal.progressPercent}% (target: ${curGoal.target}${curGoal.unit ? ` ${curGoal.unit}` : ''}).`,
        evidence: [
          {
            sourceType: 'GOAL',
            sourceId: curGoal.goalId,
            metricKey: curGoal.metricKey,
            value: curGoal.progressPercent,
            period,
          },
        ],
        detectedAt: nowIso,
        lastEvaluatedAt: nowIso,
        status: 'OPEN',
      });
    }
  }

  // --------------------------------------------------------------------------
  // 3. TIME MISMATCH (Priority 1 receiving < 10% of focus)
  // --------------------------------------------------------------------------
  if (timeSummary.totalMinutes >= 120) {
    const jobHuntDetail = timeSummary.pillarDetails.find((d) => d.pillarId === 'job_hunt');
    const jhShare = jobHuntDetail ? jobHuntDetail.sharePercent : 0;
    if (jhShare < Layer5DetectionConfig.ALERT_TIME_MISMATCH_PRIORITY_1_MIN_SHARE) {
      const fp = computeAlertFingerprint('TIME_MISMATCH', ['job_hunt'], 'priority_allocation');
      const id = computeAlertOccurrenceId(fp, period);

      detectedCandidateAlerts.push({
        id,
        fingerprint: fp,
        type: 'TIME_MISMATCH',
        severity: 'CRITICAL',
        pillarIds: ['job_hunt'],
        metricKey: 'time.job_hunt.sharePercent',
        period,
        title: 'Priority 1 Under-Allocation Exception',
        description: `Job Hunt (Priority 1) received only ${Math.round(jhShare)}% of total focus time (${jobHuntDetail ? Math.round(jobHuntDetail.hours * 10) / 10 : 0}h) during this period.`,
        evidence: [
          {
            sourceType: 'FOCUS_SESSION',
            sourceId: 'time.job_hunt.sharePercent',
            value: jhShare,
            period,
          },
        ],
        detectedAt: nowIso,
        lastEvaluatedAt: nowIso,
        status: 'OPEN',
      });
    }
  }

  // --------------------------------------------------------------------------
  // 4. KPI ANOMALIES (from Layer 3 AnomalyFacts)
  // --------------------------------------------------------------------------
  for (const a of anomalies) {
    if (a.severity === 'CRITICAL' || a.severity === 'WARNING') {
      const pillarIds: PillarSlug[] = a.pillarId ? [a.pillarId] : [];
      const fp = computeAlertFingerprint('KPI_ANOMALY', pillarIds, a.id);
      const id = computeAlertOccurrenceId(fp, period);

      detectedCandidateAlerts.push({
        id,
        fingerprint: fp,
        type: 'KPI_ANOMALY',
        severity: a.severity,
        pillarIds,
        period,
        title: `Anomaly Detected: ${a.title}`,
        description: a.description,
        evidence: [
          {
            sourceType: 'KPI',
            sourceId: a.id,
            value: `Baseline: ${a.baseline}, Threshold: ${a.threshold}`,
            period,
          },
        ],
        detectedAt: nowIso,
        lastEvaluatedAt: nowIso,
        status: 'OPEN',
      });
    }
  }

  // --------------------------------------------------------------------------
  // 5. BUSINESS EXCEPTIONS
  // --------------------------------------------------------------------------
  // Agency AR Elevated
  if (kpisContext.agency && kpisContext.agency.billedRevenue > 0) {
    const arRatio = kpisContext.agency.accountsReceivable / kpisContext.agency.billedRevenue;
    if (arRatio > Layer5DetectionConfig.ALERT_AGENCY_AR_RATIO_THRESHOLD) {
      const fp = computeAlertFingerprint('BUSINESS_EXCEPTION', ['agency'], 'accounts_receivable_elevated');
      const id = computeAlertOccurrenceId(fp, period);

      detectedCandidateAlerts.push({
        id,
        fingerprint: fp,
        type: 'BUSINESS_EXCEPTION',
        severity: 'WARNING',
        pillarIds: ['agency'],
        metricKey: 'agency.accountsReceivable',
        period,
        title: 'Agency Accounts Receivable Elevated',
        description: `Uncollected Accounts Receivable (₹${kpisContext.agency.accountsReceivable.toLocaleString()}) represents ${Math.round(arRatio * 100)}% of total billed revenue.`,
        evidence: [
          {
            sourceType: 'KPI',
            sourceId: 'agency.accountsReceivable',
            value: kpisContext.agency.accountsReceivable,
            period,
          },
        ],
        detectedAt: nowIso,
        lastEvaluatedAt: nowIso,
        status: 'OPEN',
      });
    }
  }

  // SaaS Distribution Starvation
  if (kpisContext.saas) {
    const devSecs = kpisContext.saas.developmentFocusSeconds || 0;
    const distCount = kpisContext.saas.distributionThisWeek ?? kpisContext.saas.totalDistributionActivities ?? 0;
    if (
      devSecs >= Layer5DetectionConfig.SAAS_ACTIVE_DEV_SECONDS_THRESHOLD &&
      distCount === Layer5DetectionConfig.SAAS_DISTRIBUTION_STARVATION_ACTIVITIES
    ) {
      const fp = computeAlertFingerprint('BUSINESS_EXCEPTION', ['trading_os'], 'distribution_starvation');
      const id = computeAlertOccurrenceId(fp, period);

      detectedCandidateAlerts.push({
        id,
        fingerprint: fp,
        type: 'BUSINESS_EXCEPTION',
        severity: 'WARNING',
        pillarIds: ['trading_os'],
        metricKey: 'saas.distributionThisWeek',
        period,
        title: 'SaaS Distribution Starvation Exception',
        description: `Product development is active (${Math.round((devSecs / 3600) * 10) / 10}h), but 0 distribution activities have been logged this period.`,
        evidence: [
          {
            sourceType: 'KPI',
            sourceId: 'saas.distributionThisWeek',
            value: 0,
            period,
          },
        ],
        detectedAt: nowIso,
        lastEvaluatedAt: nowIso,
        status: 'OPEN',
      });
    }
  }

  // Forex Severe Discipline Breach (authoritative threshold from forexKpi.ts)
  if (kpisContext.forex) {
    const criticalMistakes = (kpisContext.forex.fomoCount || 0) + (kpisContext.forex.revengeCount || 0);
    if (criticalMistakes >= Layer5DetectionConfig.FOREX_CRITICAL_MISTAKE_COUNT_THRESHOLD) {
      const fp = computeAlertFingerprint('BUSINESS_EXCEPTION', ['forex'], 'severe_mistakes');
      const id = computeAlertOccurrenceId(fp, period);

      detectedCandidateAlerts.push({
        id,
        fingerprint: fp,
        type: 'BUSINESS_EXCEPTION',
        severity: 'CRITICAL',
        pillarIds: ['forex'],
        metricKey: 'forex.severeMistakes',
        period,
        title: `Forex Discipline Breach (${criticalMistakes} Severe Mistakes)`,
        description: `Observed ${criticalMistakes} severe discipline breaches (${kpisContext.forex.fomoCount} FOMO, ${kpisContext.forex.revengeCount} Revenge) against the threshold of ${Layer5DetectionConfig.FOREX_CRITICAL_MISTAKE_COUNT_THRESHOLD}.`,
        evidence: [
          {
            sourceType: 'KPI',
            sourceId: 'forex.severeMistakes',
            value: criticalMistakes,
            period,
          },
        ],
        detectedAt: nowIso,
        lastEvaluatedAt: nowIso,
        status: 'OPEN',
      });
    }
  }

  // --------------------------------------------------------------------------
  // 6. DATA QUALITY CRITICAL EXCEPTIONS ESCALATION
  // --------------------------------------------------------------------------
  for (const issue of dataQualityReport.issues) {
    if (issue.severity === 'CRITICAL') {
      const pillarIds: PillarSlug[] = issue.pillarId ? [issue.pillarId] : [];
      const fp = computeAlertFingerprint('DATA_QUALITY', pillarIds, issue.id);
      const id = computeAlertOccurrenceId(fp, period);
      const entityName = (issue as any).entityType || (issue as any).entityRef?.type;
      const entityPrefix = entityName ? ` [${entityName}]` : '';
      const issueTitle = issue.title || (issue as any).message || 'Data Quality Violation';
      const issueDesc = issue.description || (issue as any).message || '';

      detectedCandidateAlerts.push({
        id,
        fingerprint: fp,
        type: 'DATA_QUALITY',
        severity: 'CRITICAL',
        pillarIds,
        period,
        title: `Data Integrity Alert${entityPrefix}: ${issueTitle}`,
        description: issueDesc,
        message: issueDesc,
        evidence: issue.evidence || [],
        evidenceIds: issue.evidence && issue.evidence.length > 0
          ? issue.evidence.map((e) => `${e.sourceType.toLowerCase()}:${e.sourceId}`)
          : [`quality:${issue.id}`],
        detectedAt: nowIso,
        firstDetectedAt: nowIso,
        lastEvaluatedAt: nowIso,
        occurrenceCount: 1,
        status: 'OPEN',
      });
    }
  }

  // --------------------------------------------------------------------------
  // 6b. CROSS-PILLAR FACTS ESCALATION (Tradeoffs & Mismatches)
  // --------------------------------------------------------------------------
  for (const fact of facts) {
    if (
      (fact.type as string) === 'TRADEOFF' ||
      fact.type === 'PRIORITY_TIME_MISMATCH' ||
      (fact.type as string) === 'PRIORITY_MISMATCH'
    ) {
      const pIds = fact.pillarIds || [
        ...((fact as any).primaryPillars || []),
        ...((fact as any).secondaryPillars || []),
      ];
      const fp = computeAlertFingerprint('TIME_MISMATCH', pIds, fact.id);
      const id = computeAlertOccurrenceId(fp, period);
      const factTitle = fact.title || (fact as any).statement || 'Time Allocation Mismatch';
      const factDesc = fact.description || (fact as any).statement || '';

      detectedCandidateAlerts.push({
        id,
        fingerprint: fp,
        type: 'TIME_MISMATCH',
        severity: fact.severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
        pillarIds: pIds,
        period,
        title: factTitle,
        description: factDesc,
        message: factDesc,
        evidence: fact.evidence || [],
        detectedAt: nowIso,
        firstDetectedAt: nowIso,
        lastEvaluatedAt: nowIso,
        occurrenceCount: 1,
        status: 'OPEN',
      });
    }
  }

  // --------------------------------------------------------------------------
  // 7. LIFECYCLE RECONCILIATION
  // --------------------------------------------------------------------------
  const activeAlerts: Alert[] = [];
  const resolvedAlerts: Alert[] = [];
  const candidateMap = new Map<string, Alert>();

  for (const candidate of detectedCandidateAlerts) {
    candidateMap.set(candidate.id, candidate);
  }

  // Process all newly detected / remaining active candidates
  for (const candidate of detectedCandidateAlerts) {
    const existing = existingMap.get(candidate.id);
    if (existing) {
      // Preserve user acknowledgment
      const preservedStatus = existing.status === 'ACKNOWLEDGED' ? 'ACKNOWLEDGED' : 'OPEN';
      const merged: Alert = {
        ...candidate,
        status: preservedStatus,
        firstDetectedAt: existing.firstDetectedAt || existing.detectedAt,
        detectedAt: existing.detectedAt, // Keep original detection timestamp
        lastEvaluatedAt: nowIso,
        acknowledgedAt: existing.acknowledgedAt,
        acknowledgedBy: existing.acknowledgedBy,
        occurrenceCount: (existing.occurrenceCount || 1) + 1,
        metadata: { ...candidate.metadata, ...existing.metadata },
      };
      activeAlerts.push(merged);
    } else {
      activeAlerts.push(candidate);
    }
  }

  // Process previously open/acknowledged alerts whose condition disappeared
  for (const existing of existingAlerts) {
    const isSamePeriod =
      existing.period.start === period.start && existing.period.end === period.end;

    if (isSamePeriod) {
      const stillActive = candidateMap.has(existing.id);
      if (!stillActive && (existing.status === 'OPEN' || existing.status === 'ACKNOWLEDGED')) {
        // Condition cleared! Auto-resolve
        const resolved: Alert = {
          ...existing,
          status: 'RESOLVED',
          resolvedAt: nowIso,
          resolutionReason: 'CONDITION_CLEARED',
          lastEvaluatedAt: nowIso,
        };
        resolvedAlerts.push(resolved);
      } else if (existing.status === 'RESOLVED') {
        resolvedAlerts.push(existing);
      }
    } else {
      // Historical alert from another period: preserve as-is
      resolvedAlerts.push(existing);
    }
  }

  const allCurrentAlerts = [...activeAlerts, ...resolvedAlerts];

  return {
    activeAlerts,
    resolvedAlerts,
    allCurrentAlerts,
    alertsToUpsert: allCurrentAlerts,
  };
}

/**
 * Service function to sync alerts against authoritative reality and update
 * the IndexedDB alert store.
 */
export async function syncAlerts(
  periodType: TimePeriodType = 'THIS_WEEK',
  refDate: Date = new Date()
): Promise<Alert[]> {
  const { current: period, previous } = getPeriodBounds(periodType, refDate);

  // Derive previous period refDate
  const prevDate = new Date(period.start);
  prevDate.setDate(prevDate.getDate() - 1);

  const [
    allSessions,
    kpisContext,
    currentGoals,
    previousGoals,
    existingAlerts,
    dataQualityReport,
    intelligenceSnapshot,
  ] = await Promise.all([
    loadAllFocusSessions(),
    loadAllPillarsKpisContext(refDate),
    evaluateAllGoals(refDate),
    evaluateAllGoals(prevDate),
    dbGetAll<Alert>(STORES.ALERTS),
    runDataQualityCheck(periodType, refDate),
    generateIntelligenceSnapshot(periodType, refDate),
  ]);

  const timeSummary = aggregateFocusSessions(allSessions, period, previous);

  const { activeAlerts, resolvedAlerts } = evaluateAlerts({
    period,
    previousPeriod: previous,
    currentGoals,
    previousGoals,
    timeSummary,
    kpisContext,
    anomalies: intelligenceSnapshot.anomalies,
    dataQualityReport,
    existingAlerts,
    now: refDate,
  });

  // Persist updated alerts to IndexedDB
  for (const alert of [...activeAlerts, ...resolvedAlerts]) {
    await dbPut(STORES.ALERTS, alert);
  }

  notifyDataChange();
  return activeAlerts;
}

/**
 * User action to acknowledge an alert.
 */
export async function acknowledgeAlert(alertId: string): Promise<Alert | null> {
  const alerts = await dbGetAll<Alert>(STORES.ALERTS);
  const target = alerts.find((a) => a.id === alertId);
  if (!target) return null;

  const updated: Alert = {
    ...target,
    status: 'ACKNOWLEDGED',
    acknowledgedAt: new Date().toISOString(),
  };

  await dbPut(STORES.ALERTS, updated);
  notifyDataChange();
  return updated;
}

/**
 * User action to manually resolve an alert.
 */
export async function resolveAlert(alertId: string): Promise<Alert | null> {
  const alerts = await dbGetAll<Alert>(STORES.ALERTS);
  const target = alerts.find((a) => a.id === alertId);
  if (!target) return null;

  const updated: Alert = {
    ...target,
    status: 'RESOLVED',
    resolvedAt: new Date().toISOString(),
    resolutionReason: 'MANUAL_RESOLUTION',
  };

  await dbPut(STORES.ALERTS, updated);
  notifyDataChange();
  return updated;
}
