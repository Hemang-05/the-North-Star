// ============================================================================
// PERSONAL OS — Cross-Pillar Intelligence Engine
// Deterministic detection of relationships, trade-offs, and allocations BETWEEN pillars.
//
// Axioms:
//   "Code calculates facts deterministically; AI interprets later."
//   "Strictly observational: describes what coincided, never asserts causation."
//   "No duplicate KPI recalculations: consumes authoritative facts from Layers 1-3."
// ============================================================================

import type {
  GoalKpiSnapshot,
  PillarSlug,
  PeriodBounds,
  TimeSummary,
  TimePeriodType,
} from '../types';
import type { CrossPillarFact, EvidenceReference } from '../types/layer5';
import { PILLAR_MAP } from '../config/pillars';
import { Layer5DetectionConfig } from '../config/layer5DetectionConfig';
import { isWeekendCalendarDay } from './voireKpi';
import { getPeriodBounds, loadAllFocusSessions, aggregateFocusSessions } from './timeAggregation';
import { loadAllPillarsKpisContext, evaluateAllGoals } from './kpiEvaluation';
import type { KpisEvaluationContext } from './kpiEvaluation';

export interface CrossPillarInput {
  timeSummary: TimeSummary;
  goalSnapshots: GoalKpiSnapshot[];
  kpisContext: KpisEvaluationContext;
  period: PeriodBounds;
  now?: Date;
}

/**
 * Deterministically derives cross-pillar facts from already-computed facts,
 * time summaries, and goal snapshots.
 * Zero causal claims. Uses strictly observational phrasing.
 */
export function computeCrossPillarFacts(input: CrossPillarInput): CrossPillarFact[] {
  const { timeSummary, goalSnapshots, kpisContext, period, now = new Date() } = input;
  const facts: CrossPillarFact[] = [];
  const totalMinutes = timeSummary.totalMinutes;

  const topPrioritySlugs: PillarSlug[] = ['job_hunt', 'agency', 'trading_os'];
  const lowerPrioritySlugs: PillarSlug[] = ['forex', 'fitness', 'voire'];

  // Calculate focus distribution
  let topPriorityMinutes = 0;
  let lowerPriorityMinutes = 0;

  for (const detail of timeSummary.pillarDetails) {
    if (topPrioritySlugs.includes(detail.pillarId)) {
      topPriorityMinutes += detail.minutes;
    } else if (lowerPrioritySlugs.includes(detail.pillarId)) {
      lowerPriorityMinutes += detail.minutes;
    }
  }

  const topPriorityShare = totalMinutes > 0 ? (topPriorityMinutes / totalMinutes) * 100 : 0;
  const lowerPriorityShare = totalMinutes > 0 ? (lowerPriorityMinutes / totalMinutes) * 100 : 0;

  // --------------------------------------------------------------------------
  // 1. PRIORITY_TIME_MISMATCH
  // --------------------------------------------------------------------------
  if (
    totalMinutes >= 60 &&
    topPriorityShare < Layer5DetectionConfig.PRIORITY_TIME_MISMATCH_TOP_MAX_SHARE &&
    lowerPriorityShare > Layer5DetectionConfig.PRIORITY_TIME_MISMATCH_LOWER_MIN_SHARE
  ) {
    const evidence: EvidenceReference[] = [
      {
        sourceType: 'FOCUS_SESSION',
        sourceId: 'time.top_priority_share',
        value: `${Math.round(topPriorityShare)}%`,
        period,
      },
      {
        sourceType: 'FOCUS_SESSION',
        sourceId: 'time.lower_priority_share',
        value: `${Math.round(lowerPriorityShare)}%`,
        period,
      },
    ];

    facts.push({
      id: `fact:mismatch:${period.start.split('T')[0]}`,
      type: 'PRIORITY_TIME_MISMATCH',
      severity: 'WARNING',
      pillarIds: topPrioritySlugs,
      period,
      title: 'Priority Alignment Inversion',
      description: `Observed ${Math.round(lowerPriorityShare)}% of total focus allocated to lower-priority pillars, while Top 3 priority pillars (Job Hunt, Agency, Trading OS) received ${Math.round(topPriorityShare)}% of focus during this period.`,
      evidence,
      createdAt: now.toISOString(),
    });
  }

  // --------------------------------------------------------------------------
  // 2. TIME_CONCENTRATION
  // --------------------------------------------------------------------------
  if (totalMinutes >= 90) {
    for (const detail of timeSummary.pillarDetails) {
      if (detail.sharePercent >= Layer5DetectionConfig.TIME_CONCENTRATION_SINGLE_PILLAR_SHARE) {
        const pillarTitle = PILLAR_MAP[detail.pillarId]?.title || detail.pillarId;
        facts.push({
          id: `fact:concentration:${detail.pillarId}:${period.start.split('T')[0]}`,
          type: 'TIME_CONCENTRATION',
          severity: 'INFO',
          pillarIds: [detail.pillarId],
          period,
          title: `Heavy Focus Concentration in ${pillarTitle}`,
          description: `${pillarTitle} received ${Math.round(detail.sharePercent)}% (${Math.round(detail.hours * 10) / 10}h) of all recorded focus time in this period.`,
          evidence: [
            {
              sourceType: 'FOCUS_SESSION',
              sourceId: `time.${detail.pillarId}.share`,
              value: `${Math.round(detail.sharePercent)}%`,
              period,
            },
          ],
          createdAt: now.toISOString(),
        });
      }
    }
  }

  // --------------------------------------------------------------------------
  // 3. TIME_NEGLECT (with VOIRE weekend neutrality)
  // --------------------------------------------------------------------------
  if (totalMinutes >= 120) {
    for (const slug of topPrioritySlugs) {
      const detail = timeSummary.pillarDetails.find((d) => d.pillarId === slug);
      const minutes = detail ? detail.minutes : 0;
      if (minutes === 0) {
        const pillarTitle = PILLAR_MAP[slug]?.title || slug;
        facts.push({
          id: `fact:neglect:${slug}:${period.start.split('T')[0]}`,
          type: 'TIME_NEGLECT',
          severity: 'WARNING',
          pillarIds: [slug],
          period,
          title: `Zero Focus Recorded for ${pillarTitle}`,
          description: `Priority ${PILLAR_MAP[slug]?.priorityRank || ''} pillar (${pillarTitle}) received 0 minutes of focus time in this period while other pillars received ${Math.round(totalMinutes / 60 * 10) / 10}h.`,
          evidence: [
            {
              sourceType: 'FOCUS_SESSION',
              sourceId: `time.${slug}.minutes`,
              value: 0,
              period,
            },
          ],
          createdAt: now.toISOString(),
        });
      }
    }

    // VOIRE neglect evaluation: must respect weekend neutrality
    const voireDetail = timeSummary.pillarDetails.find((d) => d.pillarId === 'voire');
    const voireMinutes = voireDetail ? voireDetail.minutes : 0;
    const isWeekend = isWeekendCalendarDay(now);

    // Only flag VOIRE if total period is THIS_MONTH or if weekend has passed with 0 creative focus
    if (period.type === 'THIS_MONTH' && voireMinutes === 0) {
      facts.push({
        id: `fact:neglect:voire:${period.start.split('T')[0]}`,
        type: 'TIME_NEGLECT',
        severity: 'INFO',
        pillarIds: ['voire'],
        period,
        title: 'Monthly Creative Activity Inactive',
        description: `VOIRE recorded 0 focus minutes across the monthly cycle.`,
        evidence: [
          {
            sourceType: 'FOCUS_SESSION',
            sourceId: 'time.voire.minutes',
            value: 0,
            period,
          },
        ],
        createdAt: now.toISOString(),
      });
    } else if (!isWeekend && voireMinutes === 0) {
      // Intentionally neutral: weekday inactivity for VOIRE is expected schedule
    }
  }

  // --------------------------------------------------------------------------
  // 4. TRADEOFFS (Pillar A focus ↑ while Pillar B focus ↓)
  // --------------------------------------------------------------------------
  const detailsWithChange = timeSummary.pillarDetails.filter(
    (d) => d.changePercent !== undefined && d.changePercent !== null
  );

  const increasing = detailsWithChange.filter(
    (d) => (d.changePercent || 0) >= Layer5DetectionConfig.TRADEOFF_CHANGE_PERCENT_MIN
  );
  const decreasing = detailsWithChange.filter(
    (d) => (d.changePercent || 0) <= -Layer5DetectionConfig.TRADEOFF_CHANGE_PERCENT_MIN
  );

  for (const inc of increasing) {
    for (const dec of decreasing) {
      const incTitle = PILLAR_MAP[inc.pillarId]?.title || inc.pillarId;
      const decTitle = PILLAR_MAP[dec.pillarId]?.title || dec.pillarId;

      // Check if decreasing pillar has active goals
      const decGoals = goalSnapshots.filter((g) => g.pillarId === dec.pillarId);
      const hasBehindGoal = decGoals.some((g) => g.status === 'BEHIND');

      facts.push({
        id: `fact:tradeoff:${inc.pillarId}_vs_${dec.pillarId}:${period.start.split('T')[0]}`,
        type: 'TRADEOFF',
        severity: hasBehindGoal ? 'WARNING' : 'INFO',
        pillarIds: [inc.pillarId, dec.pillarId],
        period,
        title: `Focus Shift: ${incTitle} vs ${decTitle}`,
        description: `${incTitle} focus increased by ${Math.round(inc.changePercent || 0)}% while ${decTitle} focus decreased by ${Math.abs(Math.round(dec.changePercent || 0))}% compared to the prior comparable period.${hasBehindGoal ? ` Note: ${decTitle} contains an active goal currently behind target.` : ''}`,
        evidence: [
          {
            sourceType: 'FOCUS_SESSION',
            sourceId: `time.${inc.pillarId}.changePercent`,
            value: inc.changePercent,
            period,
          },
          {
            sourceType: 'FOCUS_SESSION',
            sourceId: `time.${dec.pillarId}.changePercent`,
            value: dec.changePercent,
            period,
          },
        ],
        createdAt: now.toISOString(),
      });
    }
  }

  // --------------------------------------------------------------------------
  // 5. TIME_OUTCOME_DIVERGENCE
  // --------------------------------------------------------------------------
  // Agency: High focus coincided with increased realized cash
  if (kpisContext.agency) {
    const agencyDetail = timeSummary.pillarDetails.find((d) => d.pillarId === 'agency');
    if (agencyDetail && agencyDetail.hours >= 4 && kpisContext.agency.realizedCash > 0) {
      facts.push({
        id: `fact:divergence:agency_cash:${period.start.split('T')[0]}`,
        type: 'TIME_OUTCOME_DIVERGENCE',
        severity: 'INFO',
        pillarIds: ['agency'],
        period,
        title: 'Agency Focus Coinciding with Realized Cash',
        description: `Agency recorded ${Math.round(agencyDetail.hours * 10) / 10}h of focus time, coinciding with ₹${kpisContext.agency.realizedCash.toLocaleString()} in realized cash collection.`,
        evidence: [
          {
            sourceType: 'FOCUS_SESSION',
            sourceId: 'time.agency.hours',
            value: agencyDetail.hours,
            period,
          },
          {
            sourceType: 'KPI',
            sourceId: 'agency.realizedCash',
            value: kpisContext.agency.realizedCash,
            period,
          },
        ],
        createdAt: now.toISOString(),
      });
    }
  }

  // Job Hunt: High applications while interviews remained flat
  if (kpisContext.jobHunt) {
    const apps = kpisContext.jobHunt.applicationsThisWeek || kpisContext.jobHunt.totalApplications || 0;
    const interviews = kpisContext.jobHunt.interviewsReached || kpisContext.jobHunt.totalInterviewRounds || 0;
    if (apps >= 4 && interviews === 0) {
      facts.push({
        id: `fact:divergence:job_hunt_apps:${period.start.split('T')[0]}`,
        type: 'TIME_OUTCOME_DIVERGENCE',
        severity: 'INFO',
        pillarIds: ['job_hunt'],
        period,
        title: 'Application Volume vs Pipeline Conversion',
        description: `The data shows ${apps} job applications submitted during this period while 0 interviews were scheduled or completed.`,
        evidence: [
          {
            sourceType: 'KPI',
            sourceId: 'job_hunt.applications',
            value: apps,
            period,
          },
          {
            sourceType: 'KPI',
            sourceId: 'job_hunt.interviews',
            value: interviews,
            period,
          },
        ],
        createdAt: now.toISOString(),
      });
    }
  }

  // SaaS: Active dev focus while distribution activities was 0
  if (kpisContext.saas) {
    const devSecs = kpisContext.saas.developmentFocusSeconds || 0;
    const distActivities = kpisContext.saas.distributionThisWeek ?? kpisContext.saas.totalDistributionActivities ?? 0;
    if (
      devSecs >= Layer5DetectionConfig.SAAS_ACTIVE_DEV_SECONDS_THRESHOLD &&
      distActivities === Layer5DetectionConfig.SAAS_DISTRIBUTION_STARVATION_ACTIVITIES
    ) {
      const devHours = Math.round((devSecs / 3600) * 10) / 10;
      facts.push({
        id: `fact:divergence:saas_distribution:${period.start.split('T')[0]}`,
        type: 'TIME_OUTCOME_DIVERGENCE',
        severity: 'WARNING',
        pillarIds: ['trading_os'],
        period,
        title: 'SaaS Build Active with Zero Distribution',
        description: `Trading OS recorded ${devHours}h of product development focus, while 0 distribution activities were logged during the period.`,
        evidence: [
          {
            sourceType: 'FOCUS_SESSION',
            sourceId: 'saas.dev_seconds',
            value: devSecs,
            period,
          },
          {
            sourceType: 'KPI',
            sourceId: 'saas.distribution_count',
            value: distActivities,
            period,
          },
        ],
        createdAt: now.toISOString(),
      });
    }
  }

  // --------------------------------------------------------------------------
  // 6. GOAL PRESSURE
  // --------------------------------------------------------------------------
  for (const g of goalSnapshots) {
    if (g.status === 'BEHIND') {
      const pillarDetail = g.pillarId
        ? timeSummary.pillarDetails.find((d) => d.pillarId === g.pillarId)
        : undefined;
      const hoursSpent = pillarDetail ? pillarDetail.hours : 0;

      if (hoursSpent >= Layer5DetectionConfig.GOAL_PRESSURE_HIGH_TIME_HOURS) {
        facts.push({
          id: `fact:goal_pressure:${g.goalId}:${period.start.split('T')[0]}`,
          type: 'GOAL_PRESSURE',
          severity: 'WARNING',
          pillarIds: g.pillarId ? [g.pillarId] : [],
          period,
          title: `Goal Behind Schedule Despite Focus: "${g.title}"`,
          description: `Goal "${g.title}" is currently evaluated as ${g.status} (progress ${g.progressPercent ?? 0}%) despite ${Math.round(hoursSpent * 10) / 10}h of focus spent in ${g.pillarId ? PILLAR_MAP[g.pillarId]?.title : 'this area'}.`,
          evidence: [
            {
              sourceType: 'GOAL',
              sourceId: g.goalId,
              value: g.progressPercent,
              period,
            },
            {
              sourceType: 'FOCUS_SESSION',
              sourceId: `time.${g.pillarId || 'all'}.hours`,
              value: hoursSpent,
              period,
            },
          ],
          createdAt: now.toISOString(),
        });
      }
    }
  }

  return facts;
}

/**
 * Service function to load authoritative IndexedDB records and compute
 * CrossPillarFacts for the specified period.
 */
export async function generateCrossPillarIntelligence(
  periodType: TimePeriodType = 'THIS_WEEK',
  refDate: Date = new Date()
): Promise<{ period: PeriodBounds; facts: CrossPillarFact[] }> {
  const { current: period, previous } = getPeriodBounds(periodType, refDate);

  const [allSessions, kpisContext, goalSnapshots] = await Promise.all([
    loadAllFocusSessions(),
    loadAllPillarsKpisContext(refDate),
    evaluateAllGoals(refDate),
  ]);

  const timeSummary = aggregateFocusSessions(allSessions, period, previous);

  const facts = computeCrossPillarFacts({
    timeSummary,
    goalSnapshots,
    kpisContext,
    period,
    now: refDate,
  });

  return { period, facts };
}
