// ============================================================================
// PERSONAL OS — Job Hunt KPI Engine
// Deterministic computation of all Job Hunt metrics, pipeline statistics,
// and conversion rates. Pure calculation functions for complete testability.
// ============================================================================

import type {
  JobOpportunity,
  JobApplication,
  JobOutreach,
  CareerCapital,
  InterviewRecord,
  Goal,
  JobStage,
  FocusSession,
  ActivityEvent,
} from '../types';
import { safePct, startOfToday, startOfWeeksAgo, startOfMonth } from '../utils/helpers';
import { dbGetAll, dbPut, STORES } from './db';

export interface StageDistribution {
  stage: JobStage;
  label: string;
  count: number;
  percentage: number;
}

export interface JobHuntKpiSummary {
  // Volume & Pipeline
  totalOpportunities: number;
  activeOpportunities: number;
  archivedOpportunities: number; // REJECTED, WITHDRAWN, GHOSTED
  opportunitiesToday: number;
  opportunitiesThisWeek: number;
  opportunitiesThisMonth: number;
  stageCounts: Record<JobStage, number>;
  stageDistribution: StageDistribution[];

  // Applications
  totalApplications: number;
  applicationsToday: number;
  applicationsThisWeek: number;
  applicationsThisMonth: number;
  customizationBreakdown: {
    quick: number;
    tailored: number;
    deep: number;
  };

  // Outreach
  totalOutreach: number;
  outreachToday: number;
  outreachThisWeek: number;
  outreachThisMonth: number;
  totalReplied: number;
  repliedThisWeek: number;
  responseRate: number | null; // safe percentage or null

  // Conversion Funnel
  screeningsReached: number;
  interviewsReached: number;
  offersReceived: number;
  totalInterviewRounds: number;
  interviewConversionRate: number | null; // (interviews / applications) * 100
  offerConversionRate: number | null;     // (offers / applications) * 100
  replyToInterviewRate: number | null;    // (interviews / replies) * 100
  interviewToOfferRate: number | null;    // (offers / interviews) * 100
  applicationToOfferRate: number | null;  // (offers / applications) * 100

  // Focus Time
  focusTimeTodaySeconds: number;
  focusTimeThisWeekSeconds: number;
  focusTimeTotalSeconds: number;
  focusTimeByCategory: Record<string, number>;

  // Velocity & Consistency
  weeklyApplicationVelocity: number; // applications in last 7 days
  weeklyOutreachVelocity: number;    // outreach in last 7 days
  daysActiveThisWeek: number;         // distinct active days in last 7 days

  // Career Assets
  totalAssets: number;
  activeAssets: number;
  inProgressAssets: number;
}

export const ALL_JOB_STAGES: { stage: JobStage; label: string; color: string }[] = [
  { stage: 'DISCOVERED', label: 'Discovered', color: '#64748b' },
  { stage: 'APPLIED', label: 'Applied', color: '#3b82f6' },
  { stage: 'OUTREACH', label: 'Outreach', color: '#8b5cf6' },
  { stage: 'REPLIED', label: 'Replied', color: '#06b6d4' },
  { stage: 'SCREENING', label: 'Screening', color: '#f59e0b' },
  { stage: 'INTERVIEW', label: 'Interview', color: '#ec4899' },
  { stage: 'ASSESSMENT', label: 'Assessment', color: '#10b981' },
  { stage: 'FINAL_ROUND', label: 'Final Round', color: '#6366f1' },
  { stage: 'OFFER', label: 'Offer', color: '#22c55e' },
  { stage: 'REJECTED', label: 'Rejected', color: '#ef4444' },
  { stage: 'WITHDRAWN', label: 'Withdrawn', color: '#71717a' },
  { stage: 'GHOSTED', label: 'Ghosted', color: '#a1a1aa' },
];

export const ACTIVE_STAGES: Set<JobStage> = new Set([
  'DISCOVERED',
  'APPLIED',
  'OUTREACH',
  'REPLIED',
  'SCREENING',
  'INTERVIEW',
  'ASSESSMENT',
  'FINAL_ROUND',
  'OFFER',
]);

export const INTERVIEW_STAGES: Set<JobStage> = new Set([
  'SCREENING',
  'INTERVIEW',
  'ASSESSMENT',
  'FINAL_ROUND',
  'OFFER',
]);

/**
 * Pure calculation of Job Hunt KPIs from raw domain datasets.
 */
export function calculateJobHuntKpis(params: {
  opportunities: JobOpportunity[];
  applications: JobApplication[];
  outreaches: JobOutreach[];
  assets: CareerCapital[];
  focusSessions: FocusSession[];
  events: ActivityEvent[];
  interviews?: InterviewRecord[];
  referenceDate?: string;
}): JobHuntKpiSummary {
  const {
    opportunities,
    applications,
    outreaches,
    assets,
    focusSessions,
    events,
    interviews = [],
  } = params;

  const todayIso = startOfToday();
  const weekAgoIso = startOfWeeksAgo(1);
  const monthAgoIso = startOfMonth();

  // --- Stage Counts ---
  const initialCounts: Record<JobStage, number> = {
    DISCOVERED: 0,
    APPLIED: 0,
    OUTREACH: 0,
    REPLIED: 0,
    SCREENING: 0,
    INTERVIEW: 0,
    ASSESSMENT: 0,
    FINAL_ROUND: 0,
    OFFER: 0,
    REJECTED: 0,
    WITHDRAWN: 0,
    GHOSTED: 0,
  };

  const stageCounts = opportunities.reduce((acc, opp) => {
    if (acc[opp.stage] !== undefined) {
      acc[opp.stage]++;
    } else {
      acc.DISCOVERED++;
    }
    return acc;
  }, { ...initialCounts });

  const totalOpportunities = opportunities.length;
  let activeOpportunities = 0;
  let archivedOpportunities = 0;

  for (const opp of opportunities) {
    if (ACTIVE_STAGES.has(opp.stage)) {
      activeOpportunities++;
    } else {
      archivedOpportunities++;
    }
  }

  const stageDistribution: StageDistribution[] = ALL_JOB_STAGES.map((s) => ({
    stage: s.stage,
    label: s.label,
    count: stageCounts[s.stage] || 0,
    percentage: totalOpportunities > 0 ? ((stageCounts[s.stage] || 0) / totalOpportunities) * 100 : 0,
  }));

  // --- Opportunities Velocity ---
  let opportunitiesToday = 0;
  let opportunitiesThisWeek = 0;
  let opportunitiesThisMonth = 0;

  for (const opp of opportunities) {
    const oppDate = opp.createdAt || opp.discoveredAt || opp.updatedAt || '';
    if (oppDate >= todayIso) opportunitiesToday++;
    if (oppDate >= weekAgoIso) opportunitiesThisWeek++;
    if (oppDate >= monthAgoIso) opportunitiesThisMonth++;
  }

  // --- Applications ---
  const appliedOppIds = new Set<string>();
  let appRecordsToday = 0;
  let appRecordsThisWeek = 0;
  let appRecordsThisMonth = 0;
  let quick = 0;
  let tailored = 0;
  let deep = 0;

  for (const app of applications) {
    if (app.opportunityId) appliedOppIds.add(app.opportunityId);
    const appliedAt = app.appliedAt || '';
    if (appliedAt >= todayIso) appRecordsToday++;
    if (appliedAt >= weekAgoIso) appRecordsThisWeek++;
    if (appliedAt >= monthAgoIso) appRecordsThisMonth++;

    if (app.customizationLevel === 'QUICK') quick++;
    else if (app.customizationLevel === 'TAILORED') tailored++;
    else if (app.customizationLevel === 'DEEP') deep++;
  }

  // Also count opportunities that have reached APPLIED or subsequent active stages
  let oppAppliedCount = 0;
  let oppAppliedToday = 0;
  let oppAppliedThisWeek = 0;
  let oppAppliedThisMonth = 0;

  for (const opp of opportunities) {
    if (!appliedOppIds.has(opp.id)) {
      const isApplied = opp.stage !== 'DISCOVERED';
      if (isApplied) {
        oppAppliedCount++;
        const oppDate = opp.updatedAt || opp.createdAt || opp.discoveredAt || '';
        if (oppDate >= todayIso) oppAppliedToday++;
        if (oppDate >= weekAgoIso) oppAppliedThisWeek++;
        if (oppDate >= monthAgoIso) oppAppliedThisMonth++;
      }
    }
  }

  const explicitAppCount = applications.length;
  const combinedAppCount = explicitAppCount + oppAppliedCount;
  // If user logged jobs in pipeline, ensure totalApplications reflects active logged roles if explicit apps are 0
  const totalApplications = combinedAppCount > 0 ? combinedAppCount : opportunities.length;

  const applicationsToday = combinedAppCount > 0 ? (appRecordsToday + oppAppliedToday) : opportunitiesToday;
  const applicationsThisWeek = combinedAppCount > 0 ? (appRecordsThisWeek + oppAppliedThisWeek) : opportunitiesThisWeek;
  const applicationsThisMonth = combinedAppCount > 0 ? (appRecordsThisMonth + oppAppliedThisMonth) : opportunitiesThisMonth;

  // --- Outreach ---
  const totalOutreach = outreaches.length;
  let outreachToday = 0;
  let outreachThisWeek = 0;
  let outreachThisMonth = 0;
  let totalReplied = 0;
  let repliedThisWeek = 0;

  for (const out of outreaches) {
    const sentAt = out.sentAt || '';
    if (sentAt >= todayIso) outreachToday++;
    if (sentAt >= weekAgoIso) outreachThisWeek++;
    if (sentAt >= monthAgoIso) outreachThisMonth++;

    if (out.repliedAt) {
      totalReplied++;
      if (out.repliedAt >= weekAgoIso) repliedThisWeek++;
    }
  }

  const responseRate = safePct(totalReplied, totalOutreach);

  // --- Funnel & Conversion ---
  let screeningsReached = 0;
  let interviewsReached = 0;
  let offersReceived = stageCounts.OFFER;

  for (const opp of opportunities) {
    if (opp.stage === 'SCREENING') screeningsReached++;
    if (
      opp.stage === 'INTERVIEW' ||
      opp.stage === 'ASSESSMENT' ||
      opp.stage === 'FINAL_ROUND' ||
      opp.stage === 'OFFER'
    ) {
      interviewsReached++;
    }
  }

  const totalInterviewsOrScreening = Math.max(screeningsReached + interviewsReached, interviews.length);
  const interviewConversionRate = safePct(totalInterviewsOrScreening, totalApplications);
  const offerConversionRate = safePct(offersReceived, totalApplications);
  const replyToInterviewRate = safePct(totalInterviewsOrScreening, totalReplied);
  const interviewToOfferRate = safePct(offersReceived, totalInterviewsOrScreening);
  const applicationToOfferRate = safePct(offersReceived, totalApplications);

  // --- Focus Time ---
  let focusTimeTodaySeconds = 0;
  let focusTimeThisWeekSeconds = 0;
  let focusTimeTotalSeconds = 0;
  const focusTimeByCategory: Record<string, number> = {};

  for (const s of focusSessions) {
    if (s.pillarId !== 'job_hunt' || s.status !== 'STOPPED') continue;
    const duration = s.durationSeconds || 0;
    focusTimeTotalSeconds += duration;

    const startedAt = s.startedAt || '';
    if (startedAt >= todayIso) focusTimeTodaySeconds += duration;
    if (startedAt >= weekAgoIso) focusTimeThisWeekSeconds += duration;

    const cat = s.category || 'General';
    focusTimeByCategory[cat] = (focusTimeByCategory[cat] || 0) + duration;
  }

  // --- Active Days This Week ---
  const activeDaysSet = new Set<string>();
  for (const ev of events) {
    const occurredAt = ev.occurredAt || '';
    if (occurredAt >= weekAgoIso) {
      activeDaysSet.add(occurredAt.slice(0, 10));
    }
  }
  for (const s of focusSessions) {
    if (s.pillarId !== 'job_hunt') continue;
    const startedAt = s.startedAt || '';
    if (startedAt >= weekAgoIso) {
      activeDaysSet.add(startedAt.slice(0, 10));
    }
  }

  // --- Career Assets ---
  const totalAssets = assets.length;
  let activeAssets = 0;
  let inProgressAssets = 0;

  for (const a of assets) {
    if (a.status === 'ACTIVE') activeAssets++;
    else if (a.status === 'IN_PROGRESS') inProgressAssets++;
  }

  return {
    totalOpportunities,
    activeOpportunities,
    archivedOpportunities,
    opportunitiesToday,
    opportunitiesThisWeek,
    opportunitiesThisMonth,
    stageCounts,
    stageDistribution,
    totalApplications,
    applicationsToday,
    applicationsThisWeek,
    applicationsThisMonth,
    customizationBreakdown: { quick, tailored, deep },
    totalOutreach,
    outreachToday,
    outreachThisWeek,
    outreachThisMonth,
    totalReplied,
    repliedThisWeek,
    responseRate,
    screeningsReached,
    interviewsReached: totalInterviewsOrScreening,
    offersReceived,
    totalInterviewRounds: interviews.length,
    interviewConversionRate,
    offerConversionRate,
    replyToInterviewRate,
    interviewToOfferRate,
    applicationToOfferRate,
    focusTimeTodaySeconds,
    focusTimeThisWeekSeconds,
    focusTimeTotalSeconds,
    focusTimeByCategory,
    weeklyApplicationVelocity: applicationsThisWeek,
    weeklyOutreachVelocity: outreachThisWeek,
    daysActiveThisWeek: activeDaysSet.size,
    totalAssets,
    activeAssets,
    inProgressAssets,
  };
}

/**
 * Synchronize calculated metrics into STORES.GOALS entities
 * so that any view reading from IndexedDB has live computed values.
 */
export async function syncJobHuntGoalValues(kpis: JobHuntKpiSummary): Promise<void> {
  try {
    const allGoals = await dbGetAll<Goal>(STORES.GOALS);
    const jobGoals = allGoals.filter((g) => g.pillarId === 'job_hunt');

    for (const goal of jobGoals) {
      const title = (goal.title || '').toLowerCase();
      const unit = (goal.unit || '').toLowerCase();
      let newVal = goal.currentComputedValue;

      if (
        title.includes('application') ||
        title.includes('applied') ||
        title.includes('job') ||
        title.includes('role') ||
        unit.includes('app') ||
        unit.includes('job') ||
        unit.includes('role')
      ) {
        if (goal.cadence === 'DAILY') {
          newVal = Math.max(kpis.applicationsToday, kpis.opportunitiesToday ?? 0);
        } else if (goal.cadence === 'WEEKLY') {
          newVal = Math.max(kpis.applicationsThisWeek, kpis.opportunitiesThisWeek ?? 0);
        } else if (goal.cadence === 'MONTHLY') {
          newVal = Math.max(kpis.applicationsThisMonth, kpis.opportunitiesThisMonth ?? 0);
        } else {
          newVal = Math.max(kpis.totalApplications, kpis.totalOpportunities);
        }
      } else if (
        title.includes('outreach') ||
        title.includes('message') ||
        title.includes('dm') ||
        title.includes('mail') ||
        title.includes('email') ||
        title.includes('contact') ||
        unit.includes('message') ||
        unit.includes('dm') ||
        unit.includes('mail') ||
        unit.includes('outreach')
      ) {
        if (goal.cadence === 'DAILY') newVal = kpis.outreachToday;
        else if (goal.cadence === 'WEEKLY') newVal = kpis.outreachThisWeek;
        else if (goal.cadence === 'MONTHLY') newVal = kpis.outreachThisMonth ?? kpis.totalOutreach;
        else newVal = kpis.totalOutreach;
      } else if (title.includes('interview') || title.includes('screening')) {
        newVal = kpis.interviewsReached;
      } else if (title.includes('offer')) {
        newVal = kpis.offersReceived;
      } else if (title.includes('focus') || title.includes('hour') || unit.includes('hour')) {
        newVal = Math.round((kpis.focusTimeThisWeekSeconds / 3600) * 10) / 10;
      }

      if (newVal !== goal.currentComputedValue) {
        await dbPut(STORES.GOALS, { ...goal, currentComputedValue: newVal });
      }
    }
  } catch (err) {
    console.warn('Notice: goal sync deferred:', err);
  }
}

/**
 * Fetch all Job Hunt data from IndexedDB and calculate full KPI summary.
 */
export async function loadJobHuntKpiSummary(): Promise<JobHuntKpiSummary> {
  const [
    opportunities,
    applications,
    outreaches,
    assets,
    allSessions,
    allEvents,
    interviews,
  ] = await Promise.all([
    dbGetAll<JobOpportunity>(STORES.JOB_OPPORTUNITIES),
    dbGetAll<JobApplication>(STORES.JOB_APPLICATIONS),
    dbGetAll<JobOutreach>(STORES.JOB_OUTREACH),
    dbGetAll<CareerCapital>(STORES.CAREER_CAPITAL),
    dbGetAll<FocusSession>(STORES.FOCUS_SESSIONS),
    dbGetAll<ActivityEvent>(STORES.EVENTS),
    dbGetAll<InterviewRecord>(STORES.JOB_INTERVIEWS),
  ]);

  const jobFocusSessions = allSessions.filter((s) => s.pillarId === 'job_hunt');
  const jobEvents = allEvents.filter((e) => e.pillarId === 'job_hunt');

  const summary = calculateJobHuntKpis({
    opportunities,
    applications,
    outreaches,
    assets,
    focusSessions: jobFocusSessions,
    events: jobEvents,
    interviews,
  });

  // Sync computed values back to Goal entities in IndexedDB
  await syncJobHuntGoalValues(summary);

  return summary;
}
