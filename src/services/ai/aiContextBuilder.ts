// ============================================================================
// PERSONAL OS — Canonical AI Context Builder
// Assembles structured deterministic facts and an evidence catalog from Layers 1-3.
//
// Core Axiom:
//   "Code calculates. AI judges and explains."
//   "No raw database dumps. Only deterministic structured facts."
// ============================================================================

import type {
  AIAnalysisMode,
  AIContext,
  AIEvidence,
} from '../../types/ai';
import type { PillarSlug } from '../../types/core';
import type { TimePeriodType } from '../../types/intelligence';
import { getPeriodBounds } from '../timeAggregation';
import { generateIntelligenceSnapshot } from '../intelligenceFacts';
import { evaluateAllGoals, loadNorthStar } from '../kpiEvaluation';
import { dbGetAll, STORES } from '../db';
import type { ActivityEvent } from '../../types/core';

export interface BuildContextOptions {
  mode: AIAnalysisMode;
  periodType?: TimePeriodType;
  refDate?: Date;
  pillarScope?: PillarSlug;
  goalScope?: string; // goalId
  userQuery?: string;
}

/**
 * Builds the canonical AIContext and deterministic evidence catalog.
 */
export async function buildCanonicalAIContext(options: BuildContextOptions): Promise<AIContext> {
  const {
    mode,
    refDate = new Date(),
    pillarScope,
    goalScope,
    userQuery,
  } = options;

  // 1. Determine period type based on mode
  let periodType: TimePeriodType = options.periodType || 'THIS_WEEK';
  if (mode === 'DAILY') {
    periodType = 'TODAY';
  } else if (mode === 'MONTHLY') {
    periodType = 'THIS_MONTH';
  }

  // 2. Fetch Layer 3 deterministic intelligence snapshot
  const snapshot = await generateIntelligenceSnapshot(periodType, refDate);
  const { current: periodBounds } = getPeriodBounds(periodType, refDate);

  // 3. Fetch Layer 2 evaluated goals and North Star
  const [allGoals, northStarResult] = await Promise.all([
    evaluateAllGoals(refDate),
    loadNorthStar(refDate),
  ]);

  // Filter goals if pillar-scoped or goal-scoped
  let relevantGoals = allGoals;
  if (goalScope) {
    relevantGoals = allGoals.filter((g) => g.goalId === goalScope);
  } else if (pillarScope) {
    relevantGoals = allGoals.filter((g) => g.pillarId === pillarScope);
  }

  // 4. Fetch recent ActivityEvents (minimized milestone summary, not raw dump)
  let rawEvents: ActivityEvent[] = [];
  try {
    rawEvents = await dbGetAll<ActivityEvent>(STORES.ACTIVITY_EVENTS);
  } catch {
    rawEvents = [];
  }

  // Take most recent 15 relevant events within current period
  const periodEvents = rawEvents
    .filter((e) => e.occurredAt >= periodBounds.start && e.occurredAt <= periodBounds.end)
    .filter((e) => !pillarScope || e.pillarId === pillarScope)
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .slice(0, 15);

  // 5. Build the Deterministic Evidence Catalog
  const evidenceCatalog: AIEvidence[] = [];

  // North Star Evidence
  if (northStarResult) {
    evidenceCatalog.push({
      id: 'north_star.current',
      category: 'GOAL',
      label: 'North Star Realized Cash Current',
      source: 'loadNorthStar()',
      value: northStarResult.current,
    });
    evidenceCatalog.push({
      id: 'north_star.target',
      category: 'GOAL',
      label: 'North Star Realized Cash Target',
      source: 'loadNorthStar()',
      value: northStarResult.target,
    });
    evidenceCatalog.push({
      id: 'north_star.gap',
      category: 'GOAL',
      label: 'North Star Cash Gap',
      source: 'loadNorthStar()',
      value: northStarResult.gap,
    });
    evidenceCatalog.push({
      id: 'north_star.agency_cash',
      category: 'FINANCIAL',
      label: 'Agency Realized Cash Contribution',
      source: 'agencyInvoices',
      value: northStarResult.breakdown.agencyRealizedCash,
    });
    evidenceCatalog.push({
      id: 'north_star.voire_cash',
      category: 'FINANCIAL',
      label: 'VOIRE Cash Received Contribution',
      source: 'voireOrders',
      value: northStarResult.breakdown.voireCashReceived,
    });
  }

  // Goal Evidence
  for (const g of relevantGoals) {
    if (g.current !== null) {
      evidenceCatalog.push({
        id: `goal.${g.metricKey}.current`,
        category: 'GOAL',
        label: `${g.title} Current Value`,
        source: 'GoalKpiSnapshot',
        value: g.current,
        period: { start: g.period.start, end: g.period.end },
      });
    }
    evidenceCatalog.push({
      id: `goal.${g.metricKey}.target`,
      category: 'GOAL',
      label: `${g.title} Target Value`,
      source: 'GoalKpiSnapshot',
      value: g.target,
    });
    if (g.gap !== null) {
      evidenceCatalog.push({
        id: `goal.${g.metricKey}.gap`,
        category: 'GOAL',
        label: `${g.title} Measurable Gap`,
        source: 'GoalKpiSnapshot',
        value: g.gap,
      });
    }
    evidenceCatalog.push({
      id: `goal.${g.metricKey}.status`,
      category: 'GOAL',
      label: `${g.title} Status Verdict`,
      source: 'GoalKpiSnapshot',
      value: g.status,
    });
  }

  // Time Evidence
  evidenceCatalog.push({
    id: 'time.total_hours',
    category: 'TIME',
    label: 'Total Focus Hours',
    source: 'TimeSummary',
    value: snapshot.time.totalHours,
  });
  evidenceCatalog.push({
    id: 'time.deep_work_ratio',
    category: 'TIME',
    label: 'Deep Work Ratio %',
    source: 'TimeSummary',
    value: snapshot.time.deepWorkRatioPercent,
  });
  evidenceCatalog.push({
    id: 'time.priority_alignment',
    category: 'TIME',
    label: 'Top 3 Priority Alignment %',
    source: 'TimeSummary',
    value: snapshot.time.priorityAlignedPercent,
  });

  for (const p of snapshot.time.pillarDetails) {
    if (!pillarScope || p.pillarId === pillarScope) {
      evidenceCatalog.push({
        id: `time.pillar.${p.pillarId}.minutes`,
        category: 'TIME',
        label: `${p.title} Focus Minutes`,
        source: 'PillarTimeDetail',
        value: p.minutes,
      });
      evidenceCatalog.push({
        id: `time.pillar.${p.pillarId}.share`,
        category: 'TIME',
        label: `${p.title} Time Share %`,
        source: 'PillarTimeDetail',
        value: p.sharePercent,
      });
    }
  }

  // Intelligence Trends & Anomalies Evidence
  for (const t of snapshot.trends) {
    evidenceCatalog.push({
      id: `trend.${t.id}`,
      category: 'TREND',
      label: t.title,
      source: 'TrendFact',
      value: t.statement,
    });
  }

  for (const a of snapshot.anomalies) {
    evidenceCatalog.push({
      id: `anomaly.${a.id}`,
      category: 'ANOMALY',
      label: a.title,
      source: 'AnomalyFact',
      value: `${a.description} (Baseline: ${a.baseline}, Threshold: ${a.threshold})`,
    });
  }

  // Pillar Operating Efficiency
  for (const pf of snapshot.pillars) {
    if ((!pillarScope || pf.pillarId === pillarScope) && pf.efficiency && pf.efficiency.value !== null) {
      evidenceCatalog.push({
        id: `efficiency.${pf.pillarId}`,
        category: 'EFFICIENCY',
        label: `${pf.title} ${pf.efficiency.label}`,
        source: 'PillarIntelligenceFact',
        value: `${pf.efficiency.value} ${pf.efficiency.unit}`,
      });
    }
  }

  // 6. Build the Final Sanitized AIContext
  const allComparisons = snapshot.pillars.flatMap((p) => p.changes || []);

  const context: AIContext = {
    contextVersion: '4.0.0',
    generatedAt: new Date().toISOString(),
    period: {
      type: periodBounds.type,
      start: periodBounds.start,
      end: periodBounds.end,
      label: periodBounds.label,
    },
    pillarScope,
    goalScope,
    northStar: northStarResult
      ? {
          title: northStarResult.title,
          target: northStarResult.target,
          current: northStarResult.current,
          gap: northStarResult.gap,
          progressPercent: northStarResult.progressPercent,
          status: northStarResult.status,
          breakdown: northStarResult.breakdown,
        }
      : undefined,
    goals: relevantGoals.map((g) => ({
      goalId: g.goalId,
      title: g.title,
      pillarId: g.pillarId,
      metricKey: g.metricKey,
      cadence: g.period.cadence,
      target: g.target,
      current: g.current,
      gap: g.gap,
      progressPercent: g.progressPercent,
      status: g.status,
    })),
    time: {
      summary: {
        totalHours: snapshot.time.totalHours,
        totalMinutes: snapshot.time.totalMinutes,
        sessionCount: snapshot.time.sessionCount,
        deepWorkMinutes: snapshot.time.deepWorkMinutes,
        deepWorkRatioPercent: snapshot.time.deepWorkRatioPercent,
        priorityAlignedPercent: snapshot.time.priorityAlignedPercent,
        changePercent: snapshot.time.changePercent ?? null,
      },
      pillars: snapshot.time.pillarDetails
        .filter((p) => !pillarScope || p.pillarId === pillarScope)
        .map((p) => ({
          pillarId: p.pillarId,
          pillarName: p.title,
          hours: p.hours,
          minutes: p.minutes,
          sharePercent: p.sharePercent,
          sessionCount: p.sessionCount,
          changePercent: p.changePercent ?? null,
          topCategories: p.byCategory,
        })),
    },
    intelligence: {
      comparisons: allComparisons.map((c) => ({
        metricKey: c.metricKey,
        label: c.label,
        currentValue: c.current,
        previousValue: c.previous,
        delta: c.absoluteChange,
        changePercent: c.percentageChange,
        direction: c.direction,
        isFavorable: c.favorable ?? null,
        statement: c.statement,
      })),
      trends: snapshot.trends.map((t) => ({
        id: t.id,
        title: t.title,
        statement: t.description,
        direction: t.direction,
        severity: t.favorable ? 'INFO' : 'WARNING',
      })),
      anomalies: snapshot.anomalies.map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        severity: a.severity,
        baseline: a.baseline,
        threshold: a.threshold,
      })),
      pillarFacts: snapshot.pillars
        .filter((pf) => !pillarScope || pf.pillarId === pillarScope)
        .map((pf) => ({
          pillarId: pf.pillarId,
          title: pf.title,
          focusMinutes: pf.focusMinutes,
          activityCount: pf.activityCount,
          statusHeadline: pf.title,
          operatingEfficiency: pf.efficiency
            ? {
                label: pf.efficiency.label,
                value: `${pf.efficiency.value} ${pf.efficiency.unit}`,
              }
            : undefined,
        })),
    },
    pillars: snapshot.pillars
      .filter((p) => !pillarScope || p.pillarId === pillarScope)
      .map((p) => ({
        pillarId: p.pillarId,
        name: p.title,
        status: p.title,
        keyMetrics: {
          focusMinutes: p.focusMinutes,
          activityCount: p.activityCount,
          operatingEfficiency: pfEfficiencyValue(p),
        },
      })),
    evidenceCatalog,
    analysisMode: mode,
    userQuery: userQuery?.trim() || undefined,
  };

  return context;
}

function pfEfficiencyValue(p: any): string | undefined {
  if (p.efficiency && p.efficiency.value !== null) {
    return `${p.efficiency.value} ${p.efficiency.unit}`;
  }
  return undefined;
}

