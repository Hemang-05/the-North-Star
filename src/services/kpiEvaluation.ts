// ============================================================================
// PERSONAL OS — Canonical KPI Evaluation Engine
// Authoritative measurement of reality against targets.
// Routes to existing frozen pillar KPI engines without duplicating formulas.
//
// Core Axiom:
//   "I define what I want. The system measures what is actually happening.
//    The system calculates the gap. AI interprets that gap later."
// ============================================================================

import type {
  Goal,
  GoalCadence,
  MetricDirection,
  KpiValueState,
  GoalStatus,
  GoalKpiSnapshot,
} from '../types';
import { getMetricDefinition } from './kpiRegistry';

// Frozen Pillar KPI Loaders
import { loadJobHuntKpiSummary, type JobHuntKpiSummary } from './jobHuntKpi';
import { loadAgencyKpiSummary, type AgencyKpiSummary } from './agencyKpi';
import { loadSaasKpiSummary, type SaasKpiSummary } from './saasKpi';
import { loadForexKpiSummary, type ForexKpiSummary } from './forexKpi';
import { loadFitnessKpiSummary, type FitnessKpiSummary } from './fitnessKpi';
import { loadVoireKpiSummary, type VoireKpiSummary } from './voireKpi';
import { dbGetAll, STORES } from './db';

export interface CurrentKpiValueResult {
  metricKey: string;
  state: KpiValueState;
  value: number | null;
  unit: string;
  period: {
    start: string;
    end: string;
    cadence: GoalCadence;
  };
}

/**
 * Calculates local calendar period bounds for a given cadence and reference date.
 */
export function getCadencePeriod(cadence: GoalCadence, refDate = new Date()): { start: string; end: string; cadence: GoalCadence } {
  const d = new Date(refDate);

  if (cadence === 'DAILY') {
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    return { start: start.toISOString(), end: end.toISOString(), cadence };
  }

  if (cadence === 'WEEKLY') {
    // Local Monday to Sunday
    const day = d.getDay(); // 0 = Sunday, 1 = Monday
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToMonday, 0, 0, 0, 0);
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 23, 59, 59, 999);
    return { start: monday.toISOString(), end: sunday.toISOString(), cadence };
  }

  if (cadence === 'MONTHLY') {
    const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start: start.toISOString(), end: end.toISOString(), cadence };
  }

  if (cadence === 'QUARTERLY') {
    const currentQuarter = Math.floor(d.getMonth() / 3);
    const start = new Date(d.getFullYear(), currentQuarter * 3, 1, 0, 0, 0, 0);
    const end = new Date(d.getFullYear(), (currentQuarter + 1) * 3, 0, 23, 59, 59, 999);
    return { start: start.toISOString(), end: end.toISOString(), cadence };
  }

  if (cadence === 'YEARLY' || cadence === 'NORTH_STAR') {
    const start = new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0);
    const end = new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);
    return { start: start.toISOString(), end: end.toISOString(), cadence };
  }

  // CUSTOM fallback
  const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString(), cadence };
}

/**
 * Cached context container to allow evaluating multiple goals without refetching DB on every call.
 */
export interface KpisEvaluationContext {
  jobHunt?: JobHuntKpiSummary;
  agency?: AgencyKpiSummary;
  saas?: SaasKpiSummary;
  forex?: ForexKpiSummary;
  fitness?: FitnessKpiSummary;
  voire?: VoireKpiSummary;
}

/**
 * Loads summaries for all 6 pillars in parallel.
 */
export async function loadAllPillarsKpisContext(refDate = new Date()): Promise<KpisEvaluationContext> {
  const [jobHunt, agency, saas, forex, fitness, voire] = await Promise.all([
    loadJobHuntKpiSummary(),
    loadAgencyKpiSummary(),
    loadSaasKpiSummary(),
    loadForexKpiSummary(),
    loadFitnessKpiSummary(refDate),
    loadVoireKpiSummary(refDate),
  ]);

  return { jobHunt, agency, saas, forex, fitness, voire };
}

/**
 * Canonically retrieves current measured reality for any registered metricKey.
 * Strict Axiom: Differentiates between 0 (valid measured observation) and NO_DATA (null/unobserved).
 */
export async function getCurrentKpiValue(
  metricKey: string,
  cadence: GoalCadence,
  context?: KpisEvaluationContext,
  refDate = new Date()
): Promise<CurrentKpiValueResult> {
  const def = getMetricDefinition(metricKey);
  const period = getCadencePeriod(cadence, refDate);
  const unit = def?.unit || '';

  // 1. Resolve owning pillar context
  const prefix = metricKey.split('.')[0];
  let rawVal: number | null | undefined = undefined;

  if (prefix === 'job_hunt') {
    const kpis = context?.jobHunt || (await loadJobHuntKpiSummary());
    switch (metricKey) {
      case 'job_hunt.applicationsToday': rawVal = kpis.applicationsToday; break;
      case 'job_hunt.applicationsThisWeek': rawVal = kpis.applicationsThisWeek; break;
      case 'job_hunt.applicationsThisMonth': rawVal = kpis.applicationsThisMonth; break;
      case 'job_hunt.totalApplications': rawVal = kpis.totalApplications; break;
      case 'job_hunt.outreachThisWeek': rawVal = kpis.outreachThisWeek; break;
      case 'job_hunt.interviewsReached': rawVal = kpis.interviewsReached; break;
      case 'job_hunt.offersReceived': rawVal = kpis.offersReceived; break;
      case 'job_hunt.focusTimeHoursThisWeek':
        rawVal = Math.round((kpis.focusTimeThisWeekSeconds / 3600) * 10) / 10;
        break;
      default:
        rawVal = undefined;
    }
  } else if (prefix === 'agency') {
    const kpis = context?.agency || (await loadAgencyKpiSummary());
    switch (metricKey) {
      case 'agency.realizedCash': rawVal = kpis.realizedCash; break;
      case 'agency.billedRevenue': rawVal = kpis.billedRevenue; break;
      case 'agency.accountsReceivable': rawVal = kpis.accountsReceivable; break;
      case 'agency.activeClients': rawVal = kpis.activeClients; break;
      case 'agency.leadsThisWeek': rawVal = kpis.leadsThisWeek; break;
      case 'agency.proposalsThisWeek': rawVal = kpis.proposalsThisWeek; break;
      case 'agency.deliveryHours': rawVal = kpis.totalDeliveryHours; break;
      default:
        rawVal = undefined;
    }
  } else if (prefix === 'saas') {
    const kpis = context?.saas || (await loadSaasKpiSummary());
    switch (metricKey) {
      case 'saas.activeUsers': rawVal = kpis.activeUsers; break;
      case 'saas.totalUsers': rawVal = kpis.totalUsers; break;
      case 'saas.payingUsers': rawVal = kpis.payingUsers; break;
      case 'saas.mrr': rawVal = kpis.recurringRevenue; break;
      case 'saas.payingConversionRate': rawVal = kpis.payingConversionRate; break;
      case 'saas.featuresDone': rawVal = kpis.featuresDone; break;
      case 'saas.distributionThisWeek': rawVal = kpis.distributionThisWeek; break;
      default:
        rawVal = undefined;
    }
  } else if (prefix === 'forex') {
    const kpis = context?.forex || (await loadForexKpiSummary());
    switch (metricKey) {
      case 'forex.studyHoursMonth': rawVal = kpis.studyHoursMonth; break;
      case 'forex.backtestedTrades': rawVal = kpis.totalBacktestedTrades; break;
      case 'forex.ruleAdherenceRate': rawVal = kpis.ruleAdherenceRate; break;
      case 'forex.validatedSetups': rawVal = kpis.validatedSetups; break;
      case 'forex.cleanTradeStreak': rawVal = kpis.cleanTradeStreak; break;
      default:
        rawVal = undefined;
    }
  } else if (prefix === 'fitness') {
    const kpis = context?.fitness || (await loadFitnessKpiSummary(refDate));
    switch (metricKey) {
      case 'fitness.workoutsThisWeek': rawVal = kpis.workoutsThisWeek; break;
      case 'fitness.distanceThisWeekKm': rawVal = kpis.distanceThisWeekKm; break;
      case 'fitness.fiveKmRunsThisWeek': rawVal = kpis.fiveKmRunsThisWeek; break;
      case 'fitness.avgDailyProteinWeek': rawVal = kpis.avgDailyProteinWeek; break;
      case 'fitness.benchPressMaxPerSideKg': rawVal = kpis.benchPressMaxPerSideKg; break;
      case 'fitness.latestWeightKg': rawVal = kpis.latestWeightKg; break;
      case 'fitness.avgSleepHoursWeek': rawVal = kpis.avgSleepHoursWeek; break;
      default:
        rawVal = undefined;
    }
  } else if (prefix === 'voire') {
    const kpis = context?.voire || (await loadVoireKpiSummary(refDate));
    switch (metricKey) {
      case 'voire.netSales': rawVal = kpis.netSales; break;
      case 'voire.cashReceived': rawVal = kpis.cashReceived; break;
      case 'voire.contributionProfit': rawVal = kpis.contributionProfit; break;
      case 'voire.paidOrdersCount': rawVal = kpis.paidOrdersCount; break;
      case 'voire.roas': rawVal = kpis.roas; break;
      case 'voire.totalDesigns': rawVal = kpis.totalDesigns; break;
      case 'voire.activeProducts': rawVal = kpis.activeProducts; break;
      default:
        rawVal = undefined;
    }
  } else if (metricKey === 'north_star.financialProceeds') {
    // Deterministic aggregated cash proceeds: Agency Realized Cash + VOIRE Cash Received (actual bank inflows)
    const agencyKpis = context?.agency || (await loadAgencyKpiSummary());
    const voireKpis = context?.voire || (await loadVoireKpiSummary(refDate));
    rawVal = (agencyKpis.realizedCash || 0) + (voireKpis.cashReceived || 0);
  }

  // 2. Strict evaluation of AVAILABLE vs NO_DATA
  if (rawVal === undefined || rawVal === null || Number.isNaN(rawVal)) {
    return {
      metricKey,
      state: 'NO_DATA',
      value: null,
      unit,
      period,
    };
  }

  return {
    metricKey,
    state: 'AVAILABLE',
    value: rawVal,
    unit,
    period,
  };
}

/**
 * Calculates deterministic progress ratio (e.g. 0.45 for 45%).
 */
export function calculateProgress(
  current: number | null,
  target: number,
  direction: MetricDirection = 'HIGHER_IS_BETTER'
): number | null {
  if (current === null || target <= 0) return null;

  if (direction === 'HIGHER_IS_BETTER') {
    return current / target;
  }

  if (direction === 'LOWER_IS_BETTER') {
    // If current <= target, progress is 100% (1.0) or higher
    if (current <= target) {
      return 1.0 + Math.max(0, (target - current) / target);
    }
    // If current > target, progress is degraded
    return Math.max(0, target / current);
  }

  if (direction === 'TARGET_RANGE') {
    // For range metrics, target is the midpoint or upper bound
    return current >= target ? 1.0 : current / target;
  }

  if (direction === 'MILESTONE') {
    return current >= target ? 1.0 : 0.0;
  }

  return current / target;
}

/**
 * Calculates deterministic gap between target and reality.
 * Sign convention:
 *   HIGHER_IS_BETTER: positive gap = behind target (amount still needed).
 *                     negative gap = exceeded target.
 *   LOWER_IS_BETTER:  positive gap = excess above target (behind).
 *                     negative gap = below target (exceeded/safe).
 */
export function calculateGap(
  current: number | null,
  target: number,
  direction: MetricDirection = 'HIGHER_IS_BETTER'
): number | null {
  if (current === null) return null;

  if (direction === 'HIGHER_IS_BETTER') {
    return target - current;
  }

  if (direction === 'LOWER_IS_BETTER') {
    return current - target;
  }

  return target - current;
}

/**
 * Calculates deterministic goal status respecting cadence, elapsed period time, and direction.
 */
export function calculateGoalStatus(params: {
  state: KpiValueState;
  current: number | null;
  target: number;
  progress: number | null;
  cadence: GoalCadence;
  direction?: MetricDirection;
  period: { start: string; end: string };
  refDate?: Date;
}): GoalStatus {
  const { state, current, target, progress, cadence, period, refDate = new Date() } = params;

  if (state === 'NO_DATA' || current === null || progress === null) {
    return 'NO_DATA';
  }

  // 1. Goal Achieved check
  if (progress >= 1.0) {
    return 'ACHIEVED';
  }

  // 2. Trajectory check based on period progress
  const startTime = new Date(period.start).getTime();
  const endTime = new Date(period.end).getTime();
  const nowTime = refDate.getTime();

  // If period hasn't started yet or target is completely uninitiated
  if (nowTime < startTime || (current === 0 && target > 0)) {
    // If we are at the very beginning of period and zero activity
    const totalPeriodMs = Math.max(1, endTime - startTime);
    const elapsedPeriodMs = Math.max(0, nowTime - startTime);
    const timeFraction = elapsedPeriodMs / totalPeriodMs;

    if (timeFraction <= 0.15 && current === 0) {
      return 'NOT_STARTED';
    }
  }

  // For NORTH_STAR or CUSTOM long-horizon goals without linear period constraints
  if (cadence === 'NORTH_STAR') {
    if (progress >= 1.0) return 'ACHIEVED';
    if (progress >= 0.75) return 'AHEAD';
    if (progress >= 0.40) return 'ON_TRACK';
    return 'BEHIND';
  }

  const totalPeriodMs = Math.max(1, endTime - startTime);
  const elapsedPeriodMs = Math.max(0, Math.min(nowTime - startTime, totalPeriodMs));
  const timeFraction = Math.max(0.01, elapsedPeriodMs / totalPeriodMs);

  // Trajectory ratio: how does actual progress compare to time elapsed?
  // e.g. If 50% of the month has passed, we expect ~50% progress.
  const trajectoryRatio = progress / timeFraction;

  if (trajectoryRatio >= 1.15) {
    return 'AHEAD';
  }
  if (trajectoryRatio >= 0.75) {
    return 'ON_TRACK';
  }

  return 'BEHIND';
}

/**
 * Generates a complete, deterministic GoalKpiSnapshot for any goal.
 */
export async function evaluateGoalSnapshot(
  goal: Goal,
  context?: KpisEvaluationContext,
  refDate = new Date()
): Promise<GoalKpiSnapshot> {
  const def = goal.metricKey ? getMetricDefinition(goal.metricKey) : undefined;
  const direction: MetricDirection = goal.direction || def?.direction || 'HIGHER_IS_BETTER';
  const cadence: GoalCadence = goal.cadence;
  const metricKey = goal.metricKey || (def?.metricKey ?? `custom.${goal.id}`);

  let currentVal: number | null = null;
  let state: KpiValueState = 'NO_DATA';
  let period = getCadencePeriod(cadence, refDate);

  if (goal.metricKey) {
    const kpiResult = await getCurrentKpiValue(goal.metricKey, cadence, context, refDate);
    state = kpiResult.state;
    currentVal = kpiResult.value;
    period = kpiResult.period;
  } else if (typeof goal.currentComputedValue === 'number' && !Number.isNaN(goal.currentComputedValue)) {
    // Backward compatibility fallback if goal was created without metricKey
    state = 'AVAILABLE';
    currentVal = goal.currentComputedValue;
  }

  const progress = calculateProgress(currentVal, goal.targetValue, direction);
  const progressPercent = progress !== null ? Math.round(progress * 1000) / 10 : null;
  const gap = calculateGap(currentVal, goal.targetValue, direction);

  const status = calculateGoalStatus({
    state,
    current: currentVal,
    target: goal.targetValue,
    progress,
    cadence,
    direction,
    period,
    refDate,
  });

  return {
    goalId: goal.id,
    title: goal.title,
    metricKey,
    pillarId: goal.pillarId,
    period,
    target: goal.targetValue,
    current: currentVal,
    state,
    unit: goal.unit || def?.unit,
    progress,
    progressPercent,
    gap,
    status,
    direction,
  };
}

export interface NorthStarEvaluationResult {
  title: string;
  target: number;
  current: number;
  gap: number;
  progressPercent: number;
  status: GoalStatus;
  breakdown: {
    agencyRealizedCash: number;
    voireCashReceived: number;
  };
}

/**
 * Canonically evaluates all active user goals against current measured reality.
 */
export async function evaluateAllGoals(refDate = new Date()): Promise<GoalKpiSnapshot[]> {
  try {
    const goals = await dbGetAll<Goal>(STORES.GOALS);
    if (!goals || goals.length === 0) return [];

    const context = await loadAllPillarsKpisContext(refDate);
    const snapshots: GoalKpiSnapshot[] = [];

    for (const g of goals) {
      if (g.isActive !== false) {
        snapshots.push(await evaluateGoalSnapshot(g, context, refDate));
      }
    }

    return snapshots;
  } catch (err) {
    console.error('Failed in evaluateAllGoals:', err);
    return [];
  }
}

/**
 * Canonically loads and evaluates the North Star goal reality.
 * Frozen Axiom: Agency Realized Cash + VOIRE Cash Received (SaaS MRR excluded).
 */
export async function loadNorthStar(refDate = new Date()): Promise<NorthStarEvaluationResult | null> {
  try {
    const [goals, agencyKpi, voireKpi] = await Promise.all([
      dbGetAll<Goal>(STORES.GOALS),
      loadAgencyKpiSummary(),
      loadVoireKpiSummary(refDate),
    ]);

    const northStarGoal = goals.find((g) => g.cadence === 'NORTH_STAR' && g.pillarId === null);
    const target = northStarGoal?.targetValue || 10000000; // 1 Cr default

    const agencyRealizedCash = agencyKpi?.realizedCashTotal || agencyKpi?.realizedCashThisMonth || 0;
    const voireCashReceived = voireKpi?.financialReality?.cashReceived || 0;
    const current = agencyRealizedCash + voireCashReceived;

    const gap = current - target;
    const progressPercent = target > 0 ? Math.round((current / target) * 1000) / 10 : 0;
    const status: GoalStatus = current >= target ? 'ACHIEVED' : progressPercent >= 75 ? 'AHEAD' : progressPercent >= 40 ? 'ON_TRACK' : 'BEHIND';

    return {
      title: northStarGoal?.title || 'North Star',
      target,
      current,
      gap,
      progressPercent,
      status,
      breakdown: {
        agencyRealizedCash,
        voireCashReceived,
      },
    };
  } catch (err) {
    console.error('Failed in loadNorthStar:', err);
    return null;
  }
}
