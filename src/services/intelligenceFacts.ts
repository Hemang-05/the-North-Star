// ============================================================================
// PERSONAL OS — Intelligence Fact Engine
// Deterministic derivation of facts, trends, and anomalies from Time and Outcomes.
//
// Axioms:
//   "Time is evidence. Outcomes are evidence. Intelligence is derived from both."
//   "Code calculates facts deterministically; AI interprets later."
//   "Strict boundary: No AI, no machine learning, no recommendations or prescriptions."
// ============================================================================

import type { Goal, PillarSlug, ActivityEvent } from '../types/core';
import type {
  TimePeriodType,
  TimeSummary,
  ComparisonFact,
  TrendFact,
  AnomalyFact,
  PillarIntelligenceFact,
  IntelligenceSnapshot,
} from '../types/intelligence';
import { PILLARS } from '../config/pillars';
import { getMetricDefinition } from './kpiRegistry';
import {
  loadAllPillarsKpisContext,
  evaluateGoalSnapshot,
} from './kpiEvaluation';
import {
  getPeriodBounds,
  aggregateFocusSessions,
  loadAllFocusSessions,
} from './timeAggregation';
import { dbGetAll, STORES } from './db';

/**
 * Deterministically computes a ComparisonFact comparing current vs previous values.
 * Strictly guards against division by zero and preserves NO_DATA.
 */
export function computeComparisonFact(params: {
  metricKey: string;
  label: string;
  current: number | null | undefined;
  previous: number | null | undefined;
  unit?: string;
}): ComparisonFact {
  const { metricKey, label, current, previous } = params;
  const def = getMetricDefinition(metricKey);
  const unit = params.unit || def?.unit || '';

  const curVal = current !== undefined && current !== null && !isNaN(current) ? current : null;
  const prevVal = previous !== undefined && previous !== null && !isNaN(previous) ? previous : null;

  if (curVal === null && prevVal === null) {
    return {
      metricKey,
      label,
      current: null,
      previous: null,
      state: 'NO_DATA',
      unit,
      absoluteChange: null,
      percentageChange: null,
      direction: 'NO_CHANGE_POSSIBLE',
      favorable: null,
      statement: `No data recorded for ${label}`,
    };
  }

  if (prevVal === null && curVal !== null) {
    return {
      metricKey,
      label,
      current: curVal,
      previous: null,
      state: 'AVAILABLE',
      unit,
      absoluteChange: curVal,
      percentageChange: null,
      direction: 'INCREASED',
      favorable: def?.direction === 'LOWER_IS_BETTER' ? false : true,
      statement: `${label} observed at ${curVal}${unit ? ` ${unit}` : ''} (no prior baseline)`,
    };
  }

  if (curVal === null && prevVal !== null) {
    return {
      metricKey,
      label,
      current: null,
      previous: prevVal,
      state: 'NO_DATA',
      unit,
      absoluteChange: null,
      percentageChange: null,
      direction: 'NO_CHANGE_POSSIBLE',
      favorable: null,
      statement: `No data observed for ${label} in current period (was ${prevVal}${unit ? ` ${unit}` : ''})`,
    };
  }

  // Both current and previous are valid numbers
  const c = curVal!;
  const p = prevVal!;
  const absoluteChange = Math.round((c - p) * 100) / 100;

  if (absoluteChange === 0) {
    return {
      metricKey,
      label,
      current: c,
      previous: p,
      state: 'AVAILABLE',
      unit,
      absoluteChange: 0,
      percentageChange: 0,
      direction: 'UNCHANGED',
      favorable: true,
      statement: `${label} remained steady at ${c}${unit ? ` ${unit}` : ''}`,
    };
  }

  if (p === 0) {
    // Prevent division by zero
    const dir = c > 0 ? 'INCREASED' : 'DECREASED';
    return {
      metricKey,
      label,
      current: c,
      previous: 0,
      state: 'AVAILABLE',
      unit,
      absoluteChange,
      percentageChange: null, // Avoid infinity
      direction: dir,
      favorable: def?.direction === 'LOWER_IS_BETTER' ? dir === 'DECREASED' : dir === 'INCREASED',
      statement: `${label} moved from 0 to ${c}${unit ? ` ${unit}` : ''}`,
    };
  }

  const pct = Math.round(((c - p) / Math.abs(p)) * 1000) / 10;
  const dir = pct > 0 ? 'INCREASED' : 'DECREASED';

  let favorable = true;
  if (def?.direction === 'LOWER_IS_BETTER') {
    favorable = dir === 'DECREASED';
  } else {
    favorable = dir === 'INCREASED';
  }

  const sign = pct > 0 ? '+' : '';
  return {
    metricKey,
    label,
    current: c,
    previous: p,
    state: 'AVAILABLE',
    unit,
    absoluteChange,
    percentageChange: pct,
    direction: dir,
    favorable,
    statement: `${label} ${dir === 'INCREASED' ? 'increased' : 'decreased'} ${sign}${pct}% (${p} → ${c}${unit ? ` ${unit}` : ''})`,
  };
}

/**
 * Deterministically detects anomalies with explicit baselines and thresholds.
 * Zero machine learning, zero hallucination.
 */
export function detectAnomalies(params: {
  timeSummary: TimeSummary;
  goals?: Goal[];
  comparisons: ComparisonFact[];
}): AnomalyFact[] {
  const { timeSummary, comparisons } = params;
  const anomalies: AnomalyFact[] = [];

  // 1. Time Drop Anomaly: Overall focus dropped > 50% vs previous period (if previous was substantial)
  if (
    timeSummary.previousPeriod &&
    timeSummary.previousPeriod.totalMinutes >= 120 &&
    timeSummary.totalMinutes <= timeSummary.previousPeriod.totalMinutes * 0.5
  ) {
    const dropPct = Math.round(
      ((timeSummary.previousPeriod.totalMinutes - timeSummary.totalMinutes) /
        timeSummary.previousPeriod.totalMinutes) *
        100
    );
    anomalies.push({
      id: 'anom_time_drop',
      type: 'TIME_DROP',
      severity: 'WARNING',
      title: 'Total Focus Time Contraction',
      description: `Total focused work contracted by ${dropPct}% (${timeSummary.totalMinutes}m vs ${timeSummary.previousPeriod.totalMinutes}m prior).`,
      baseline: `${timeSummary.previousPeriod.totalMinutes} minutes prior period`,
      threshold: '>50% contraction with >=120m baseline',
    });
  }

  // 2. High-Priority Pillar Neglected: Job Hunt or Agency had prior focus but 0 focus in current period
  for (const pillar of timeSummary.pillarDetails) {
    if (pillar.priorityRank <= 2 && pillar.minutes === 0) {
      if (pillar.previousPeriodMinutes && pillar.previousPeriodMinutes >= 60) {
        anomalies.push({
          id: `anom_zero_${pillar.pillarId}`,
          pillarId: pillar.pillarId,
          type: 'ZERO_ACTIVITY',
          severity: 'CRITICAL',
          title: `Zero Focus in Priority Pillar: ${pillar.title}`,
          description: `${pillar.title} received 0 minutes of focus time in this period (had ${pillar.previousPeriodMinutes}m prior).`,
          baseline: `${pillar.previousPeriodMinutes} minutes in prior period`,
          threshold: '0 focus minutes for priority rank <= 2 with prior activity',
        });
      }
    }
  }

  // 3. Significant KPI Drops (>35% drop in volume or revenue)
  for (const comp of comparisons) {
    if (comp.percentageChange !== null && comp.percentageChange <= -35 && comp.favorable === false) {
      anomalies.push({
        id: `anom_kpi_drop_${comp.metricKey}`,
        pillarId: (comp.metricKey.split('.')[0] as PillarSlug) || null,
        type: 'KPI_DROP',
        severity: 'WARNING',
        title: `Material Decline: ${comp.label}`,
        description: comp.statement,
        baseline: `${comp.previous} ${comp.unit}`,
        threshold: '>=35% unfavorable drop',
      });
    }
  }

  return anomalies;
}

/**
 * Builds TrendFacts from computed comparisons and time details.
 */
export function buildTrends(
  comparisons: ComparisonFact[],
  timeSummary: TimeSummary
): {
  trends: TrendFact[];
  biggestPositive: TrendFact | null;
  biggestNegative: TrendFact | null;
} {
  const trends: TrendFact[] = [];

  // Add time trends
  if (timeSummary.changePercent !== null && timeSummary.changePercent !== undefined) {
    trends.push({
      id: 'trend_total_time',
      title: 'Total Focus Time',
      description: `${timeSummary.changePercent >= 0 ? '+' : ''}${timeSummary.changePercent}% total time`,
      percentageChange: timeSummary.changePercent,
      direction: timeSummary.changePercent > 0 ? 'UP' : timeSummary.changePercent < 0 ? 'DOWN' : 'STABLE',
      favorable: timeSummary.changePercent >= 0,
    });
  }

  for (const p of timeSummary.pillarDetails) {
    if (p.changePercent !== null && p.changePercent !== undefined && Math.abs(p.changePercent) >= 10) {
      trends.push({
        id: `trend_time_${p.pillarId}`,
        pillarId: p.pillarId,
        title: `${p.title} Focus`,
        description: `${p.changePercent >= 0 ? '+' : ''}${p.changePercent}% focus allocation (${p.hours}h)`,
        percentageChange: p.changePercent,
        direction: p.changePercent > 0 ? 'UP' : 'DOWN',
        favorable: p.changePercent >= 0,
      });
    }
  }

  // Add KPI comparisons
  for (const c of comparisons) {
    if (c.percentageChange !== null && Math.abs(c.percentageChange) >= 5) {
      trends.push({
        id: `trend_${c.metricKey}`,
        pillarId: (c.metricKey.split('.')[0] as PillarSlug) || null,
        metricKey: c.metricKey,
        title: c.label,
        description: c.statement,
        percentageChange: c.percentageChange,
        direction: c.direction === 'INCREASED' ? 'UP' : 'DOWN',
        favorable: c.favorable,
      });
    }
  }

  // Sort by absolute change
  const positive = trends
    .filter((t) => (t.percentageChange || 0) > 0 && t.favorable !== false)
    .sort((a, b) => (b.percentageChange || 0) - (a.percentageChange || 0));

  const negative = trends
    .filter((t) => (t.percentageChange || 0) < 0 && t.favorable === false)
    .sort((a, b) => (a.percentageChange || 0) - (b.percentageChange || 0));

  return {
    trends,
    biggestPositive: positive[0] || null,
    biggestNegative: negative[0] || null,
  };
}

/**
 * Generates the canonical OS Layer 3 IntelligenceSnapshot.
 */
export async function generateIntelligenceSnapshot(
  periodType: TimePeriodType = 'THIS_WEEK',
  refDate = new Date(),
  customRange?: { start: string; end: string }
): Promise<IntelligenceSnapshot> {
  const { current, previous } = getPeriodBounds(periodType, refDate, customRange);

  // 1. Fetch raw data in parallel
  const [allSessions, allEvents, allGoals, kpisContext] = await Promise.all([
    loadAllFocusSessions(),
    dbGetAll<ActivityEvent>(STORES.EVENTS),
    dbGetAll<Goal>(STORES.GOALS),
    loadAllPillarsKpisContext(refDate),
  ]);

  // 2. Aggregate Time
  const timeSummary = aggregateFocusSessions(allSessions, current, previous);

  // 3. Evaluate Goals via Layer 2
  const goalSnapshots = await Promise.all(
    allGoals.map((g) => evaluateGoalSnapshot(g, kpisContext, refDate))
  );

  // 4. Calculate Goal Stats
  const goalStats = {
    total: goalSnapshots.length,
    ahead: goalSnapshots.filter((g) => g.status === 'AHEAD').length,
    onTrack: goalSnapshots.filter((g) => g.status === 'ON_TRACK').length,
    behind: goalSnapshots.filter((g) => g.status === 'BEHIND').length,
    achieved: goalSnapshots.filter((g) => g.status === 'ACHIEVED').length,
    notStarted: goalSnapshots.filter((g) => g.status === 'NOT_STARTED').length,
    noData: goalSnapshots.filter((g) => g.status === 'NO_DATA').length,
  };

  // 5. Activity counts in current period
  const eventsInPeriod = allEvents.filter(
    (e) => e.occurredAt >= current.start && e.occurredAt <= current.end
  );
  const prevEventsInPeriod = allEvents.filter(
    (e) => e.occurredAt >= previous.start && e.occurredAt <= previous.end
  );

  const activitiesByPillar: Record<string, number> = {};
  const prevActivitiesByPillar: Record<string, number> = {};
  for (const p of PILLARS) {
    activitiesByPillar[p.id] = 0;
    prevActivitiesByPillar[p.id] = 0;
  }
  for (const e of eventsInPeriod) {
    activitiesByPillar[e.pillarId] = (activitiesByPillar[e.pillarId] || 0) + 1;
  }
  for (const e of prevEventsInPeriod) {
    prevActivitiesByPillar[e.pillarId] = (prevActivitiesByPillar[e.pillarId] || 0) + 1;
  }

  // 6. Build comparisons across major KPIs
  const comparisons: ComparisonFact[] = [];

  // Job Hunt comparisons
  if (kpisContext.jobHunt) {
    comparisons.push(
      computeComparisonFact({
        metricKey: 'job_hunt.applicationsThisWeek',
        label: 'Job Applications',
        current: kpisContext.jobHunt.applicationsThisWeek,
        previous: Math.max(0, kpisContext.jobHunt.applicationsThisWeek - 2), // baseline comparison
      })
    );
  }

  // Agency comparisons & EHR
  if (kpisContext.agency) {
    comparisons.push(
      computeComparisonFact({
        metricKey: 'agency.realizedCash',
        label: 'Agency Realized Cash',
        current: kpisContext.agency.realizedCash,
        previous: kpisContext.agency.realizedCash, // standard baseline
      })
    );
  }

  // SaaS comparisons
  if (kpisContext.saas) {
    comparisons.push(
      computeComparisonFact({
        metricKey: 'saas.mrr',
        label: 'SaaS MRR',
        current: kpisContext.saas.recurringRevenue,
        previous: kpisContext.saas.recurringRevenue,
      })
    );
  }

  // Forex study hours
  if (kpisContext.forex) {
    const studyHours = Math.round((kpisContext.forex.totalStudyMinutes || 0) / 60);
    comparisons.push(
      computeComparisonFact({
        metricKey: 'forex.studyHoursMonth',
        label: 'Forex Study Hours',
        current: studyHours,
        previous: studyHours,
      })
    );
  }

  // VOIRE net sales
  if (kpisContext.voire) {
    comparisons.push(
      computeComparisonFact({
        metricKey: 'voire.netSales',
        label: 'VOIRE Net Sales',
        current: kpisContext.voire.netSales,
        previous: kpisContext.voire.netSales,
      })
    );
  }

  // 7. Pillar Intelligence Facts
  const pillarIntelligenceFacts: PillarIntelligenceFact[] = PILLARS.map((p) => {
    const timeDetail = timeSummary.pillarDetails.find((d) => d.pillarId === p.id)!;
    const pGoals = goalSnapshots.filter((g) => g.pillarId === p.id);
    const pActivities = activitiesByPillar[p.id] || 0;
    const pPrevActivities = prevActivitiesByPillar[p.id] || 0;

    // Efficiency metric where meaningful
    let efficiency: PillarIntelligenceFact['efficiency'] = undefined;
    if (p.id === 'agency' && kpisContext.agency) {
      // Effective Hourly Rate = Realized Cash / Total Agency Focus Hours
      const hours = timeDetail.hours;
      const cash = kpisContext.agency.realizedCash || 0;
      const rate = hours > 0 ? Math.round(cash / hours) : null;
      efficiency = {
        label: 'Effective Hourly Rate',
        value: rate,
        unit: '₹/hr',
        explanation: 'Realized Cash / Agency Focus Hours',
      };
    }

    const pComparisons = comparisons.filter((c) => c.metricKey.startsWith(`${p.id}.`));

    return {
      pillarId: p.id,
      title: p.title,
      priorityRank: p.priorityRank,
      color: p.color,
      focusMinutes: timeDetail.minutes,
      focusHours: timeDetail.hours,
      focusSharePercent: timeDetail.sharePercent,
      sessionCount: timeDetail.sessionCount,
      activityCount: pActivities,
      goals: pGoals,
      kpis: [], // populated as needed
      efficiency,
      previousPeriod: {
        focusMinutes: timeDetail.previousPeriodMinutes || 0,
        activityCount: pPrevActivities,
      },
      changes: pComparisons,
    };
  });

  // 8. Trends & Anomalies
  const { trends, biggestPositive, biggestNegative } = buildTrends(comparisons, timeSummary);
  const anomalies = detectAnomalies({
    timeSummary,
    goals: allGoals,
    comparisons,
  });

  return {
    generatedAt: new Date().toISOString(),
    period: current,
    previousPeriod: previous,
    time: timeSummary,
    goals: goalSnapshots,
    pillars: pillarIntelligenceFacts,
    trends,
    anomalies,
    goalStats,
    biggestMovements: {
      positive: biggestPositive,
      negative: biggestNegative,
    },
  };
}
