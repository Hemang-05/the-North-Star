// ============================================================================
// PERSONAL OS — Status Engine
// Deterministic evaluation of status verdicts (ON_TRACK, AT_RISK, BEHIND, NEGLECTED, EXCEEDING)
// for pillars and specific goals based on real activity and metrics.
// ============================================================================

import type { StatusVerdict, Goal, FitnessKpiSummary, VoireKpiSummary } from '../types';
import type { JobHuntKpiSummary } from './jobHuntKpi';
import type { AgencyKpiSummary } from './agencyKpi';
import type { SaasKpiSummary } from './saasKpi';
import { type ForexKpiSummary, CRITICAL_MISTAKE_COUNT_THRESHOLD } from './forexKpi';
import { isWeekendCalendarDay } from './voireKpi';
import { safePct } from '../utils/helpers';

export interface StatusEvaluation {
  verdict: StatusVerdict;
  headline: string;
  reason: string;
  score: number; // 0 to 100 health score
  badges: string[];
}

/**
 * Deterministically evaluate the status of the Job Hunt pillar.
 */
export function evaluateJobHuntStatus(kpis: JobHuntKpiSummary, goals: Goal[] = []): StatusEvaluation {
  // If there is zero data tracked yet
  if (
    kpis.totalOpportunities === 0 &&
    kpis.totalApplications === 0 &&
    kpis.totalOutreach === 0 &&
    kpis.focusTimeTotalSeconds === 0
  ) {
    return {
      verdict: 'NEGLECTED',
      headline: 'Awaiting Initial Input',
      reason: 'No Job Hunt opportunities, applications, or outreach tracked yet. Log your first opportunity to start tracking.',
      score: 10,
      badges: ['Uninitialized'],
    };
  }

  // Check recency / consistency
  const activeDays = kpis.daysActiveThisWeek;
  const weeklyApps = kpis.weeklyApplicationVelocity;
  const weeklyOutreach = kpis.weeklyOutreachVelocity;
  const weeklyFocusMinutes = Math.floor(kpis.focusTimeThisWeekSeconds / 60);

  // Check for offer
  if (kpis.offersReceived > 0) {
    return {
      verdict: 'EXCEEDING',
      headline: `${kpis.offersReceived} Offer${kpis.offersReceived > 1 ? 's' : ''} Received!`,
      reason: 'Outstanding execution: Active job offer secured in pipeline.',
      score: 100,
      badges: ['Offer Secured', `${weeklyApps} Apps this week`],
    };
  }

  // Neglect check: zero activity in the last 7 days
  if (activeDays === 0 && weeklyApps === 0 && weeklyOutreach === 0 && weeklyFocusMinutes === 0) {
    return {
      verdict: 'NEGLECTED',
      headline: 'Zero Activity in 7 Days',
      reason: 'Job Hunt is currently neglected. No applications, outreach, or focus sessions recorded this week.',
      score: 15,
      badges: ['Inactive 7d', 'High Priority'],
    };
  }

  // Active days check: only 1 day active and very low volume
  if (activeDays <= 1 && weeklyApps === 0 && weeklyOutreach <= 1) {
    return {
      verdict: 'BEHIND',
      headline: 'Severe Momentum Stall',
      reason: `Only active ${activeDays} day this week with ${weeklyApps} applications and ${weeklyOutreach} outreach.`,
      score: 30,
      badges: [`${activeDays}/7 Days Active`, 'Low Velocity'],
    };
  }

  // Evaluate against active goals if present
  const jobGoals = goals.filter((g) => g.pillarId === 'job_hunt' && g.isActive);
  let goalScoreSum = 0;
  let goalCount = 0;

  for (const g of jobGoals) {
    if (g.targetValue > 0) {
      let val = g.currentComputedValue;
      if (val === 0) {
        const title = (g.title || '').toLowerCase();
        const unit = (g.unit || '').toLowerCase();
        if (title.includes('application') || unit.includes('app')) {
          val = g.cadence === 'DAILY' ? kpis.applicationsToday : g.cadence === 'WEEKLY' ? kpis.applicationsThisWeek : kpis.totalApplications;
        } else if (title.includes('outreach') || unit.includes('message')) {
          val = g.cadence === 'DAILY' ? kpis.outreachToday : g.cadence === 'WEEKLY' ? kpis.outreachThisWeek : kpis.totalOutreach;
        } else if (title.includes('interview') || title.includes('screening')) {
          val = kpis.interviewsReached;
        } else if (title.includes('offer')) {
          val = kpis.offersReceived;
        } else if (title.includes('focus') || title.includes('hour') || unit.includes('hour')) {
          val = Math.round((kpis.focusTimeThisWeekSeconds / 3600) * 10) / 10;
        }
      }
      const pctValue = safePct(val, g.targetValue) || 0;
      goalScoreSum += Math.min(pctValue, 120);
      goalCount++;
    }
  }

  const avgGoalProgress = goalCount > 0 ? goalScoreSum / goalCount : null;

  // If we have goal progress
  if (avgGoalProgress !== null) {
    if (avgGoalProgress >= 100) {
      return {
        verdict: 'EXCEEDING',
        headline: 'Surpassing Weekly Targets',
        reason: `Averaging ${Math.round(avgGoalProgress)}% completion across active Job Hunt goals.`,
        score: 95,
        badges: [`${weeklyApps} Apps`, `${weeklyOutreach} Outreach`, `${activeDays} Active Days`],
      };
    }
    if (avgGoalProgress >= 75) {
      return {
        verdict: 'ON_TRACK',
        headline: 'On Track with Targets',
        reason: `Strong execution: ${Math.round(avgGoalProgress)}% of target pace achieved with steady weekly activity.`,
        score: 80,
        badges: [`${weeklyApps} Apps`, `${weeklyOutreach} Outreach`, `${activeDays} Active Days`],
      };
    }
    if (avgGoalProgress >= 40) {
      return {
        verdict: 'AT_RISK',
        headline: 'Below Target Pace',
        reason: `Pace is currently at ${Math.round(avgGoalProgress)}% of target. Need more volume to hit weekly milestones.`,
        score: 55,
        badges: ['Pace Warning', `${activeDays}/7 Days Active`],
      };
    }
    return {
      verdict: 'BEHIND',
      headline: 'Significantly Behind Goals',
      reason: `Only ${Math.round(avgGoalProgress)}% of targets reached. Ramp up outbound outreach and tailored applications.`,
      score: 35,
      badges: ['Under Target', `${weeklyApps} Apps`],
    };
  }

  // Fallback heuristic if no explicit goals are configured yet
  // Reasonable baseline: ~5 applications/wk or ~10 outreach/wk or 180min focus/wk
  let heuristicScore = 0;
  if (weeklyApps >= 5) heuristicScore += 35;
  else if (weeklyApps >= 2) heuristicScore += 20;
  else if (weeklyApps >= 1) heuristicScore += 10;

  if (weeklyOutreach >= 8) heuristicScore += 35;
  else if (weeklyOutreach >= 3) heuristicScore += 20;
  else if (weeklyOutreach >= 1) heuristicScore += 10;

  if (activeDays >= 4) heuristicScore += 20;
  else if (activeDays >= 2) heuristicScore += 10;

  if (weeklyFocusMinutes >= 120) heuristicScore += 10;
  else if (weeklyFocusMinutes >= 45) heuristicScore += 5;

  if (kpis.interviewsReached > 0) heuristicScore += 10;

  if (heuristicScore >= 75) {
    return {
      verdict: 'ON_TRACK',
      headline: 'Healthy Momentum',
      reason: `Strong pace with ${weeklyApps} applications and ${weeklyOutreach} outreaches across ${activeDays} active days.`,
      score: heuristicScore,
      badges: [`${weeklyApps} Apps this week`, `${weeklyOutreach} Outreach`],
    };
  } else if (heuristicScore >= 45) {
    return {
      verdict: 'AT_RISK',
      headline: 'Moderate Activity — At Risk',
      reason: `Tracking ${weeklyApps} applications and ${weeklyOutreach} outreach. Need higher consistency across the week.`,
      score: heuristicScore,
      badges: ['Moderate Pace', `${activeDays}/7 Days`],
    };
  } else {
    return {
      verdict: 'BEHIND',
      headline: 'Behind Optimal Velocity',
      reason: `Low weekly volume (${weeklyApps} apps, ${weeklyOutreach} outreach). Increase daily pipeline generation.`,
      score: Math.max(heuristicScore, 25),
      badges: ['Low Velocity', `${activeDays} Active Days`],
    };
  }
}

/**
 * Return display styling for a verdict.
 */
export function getVerdictStyle(verdict: StatusVerdict): {
  color: string;
  bg: string;
  border: string;
  label: string;
} {
  switch (verdict) {
    case 'EXCEEDING':
      return {
        color: '#10b981',
        bg: 'rgba(16, 185, 129, 0.12)',
        border: 'rgba(16, 185, 129, 0.25)',
        label: 'Exceeding',
      };
    case 'ON_TRACK':
      return {
        color: '#22c55e',
        bg: 'rgba(34, 197, 94, 0.12)',
        border: 'rgba(34, 197, 94, 0.25)',
        label: 'On Track',
      };
    case 'AT_RISK':
      return {
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.12)',
        border: 'rgba(245, 158, 11, 0.25)',
        label: 'At Risk',
      };
    case 'BEHIND':
      return {
        color: '#ef4444',
        bg: 'rgba(239, 68, 68, 0.12)',
        border: 'rgba(239, 68, 68, 0.25)',
        label: 'Behind',
      };
    case 'NEGLECTED':
    default:
      return {
        color: '#a1a1aa',
        bg: 'rgba(161, 161, 170, 0.12)',
        border: 'rgba(161, 161, 170, 0.25)',
        label: 'Neglected',
      };
  }
}

/**
 * Deterministically evaluate the status of the Agency pillar.
 */
export function evaluateAgencyStatus(kpis: AgencyKpiSummary, goals: Goal[] = []): StatusEvaluation {
  // Zero-data state: nothing tracked yet
  if (
    kpis.totalClients === 0 &&
    kpis.totalLeads === 0 &&
    kpis.totalInvoices === 0 &&
    kpis.focusTimeTotalSeconds === 0
  ) {
    return {
      verdict: 'NEGLECTED',
      headline: 'Awaiting Initial Input',
      reason: 'No clients, leads, invoices, or focus sessions tracked yet. Add your first lead to get started.',
      score: 10,
      badges: ['Uninitialized'],
    };
  }

  // Check for zero weekly activity — NEGLECTED
  const weeklyFocusMinutes = Math.floor(kpis.focusTimeThisWeekSeconds / 60);
  if (
    kpis.daysActiveThisWeek === 0 &&
    kpis.leadsThisWeek === 0 &&
    weeklyFocusMinutes === 0
  ) {
    return {
      verdict: 'NEGLECTED',
      headline: 'Zero Activity in 7 Days',
      reason: 'Agency pillar is dormant. No focus sessions, outreach, or pipeline activity recorded this week.',
      score: 15,
      badges: ['Inactive 7d', 'High Priority'],
    };
  }

  // Evaluate against goals if present
  const agencyGoals = goals.filter(g => g.pillarId === 'agency' && g.isActive);
  let goalScoreSum = 0;
  let goalCount = 0;

  for (const g of agencyGoals) {
    if (g.targetValue > 0) {
      const pctValue = safePct(g.currentComputedValue, g.targetValue) || 0;
      goalScoreSum += Math.min(pctValue, 120);
      goalCount++;
    }
  }

  const avgGoalProgress = goalCount > 0 ? goalScoreSum / goalCount : null;

  // Check for high accounts receivable risk
  const receivableRatio = kpis.billedRevenue > 0
    ? (kpis.accountsReceivable / kpis.billedRevenue) * 100
    : 0;

  // Pipeline drought: 0 new leads in 7 days with <3 active leads
  const pipelineDrought = kpis.leadsThisWeek === 0 && kpis.activeLeads < 3;

  // Goal-based evaluation
  if (avgGoalProgress !== null) {
    if (avgGoalProgress >= 110) {
      return {
        verdict: 'EXCEEDING',
        headline: 'Surpassing Agency Targets',
        reason: `Averaging ${Math.round(avgGoalProgress)}% across active goals. Strong execution.`,
        score: 95,
        badges: [
          `₹${Math.round(kpis.realizedCash / 1000)}K Cash`,
          `${kpis.activeClients} Clients`,
          `${kpis.activeLeads} Active Leads`,
        ],
      };
    }
    if (avgGoalProgress >= 75) {
      // Check for risk factors even if goal progress looks OK
      if (receivableRatio > 50) {
        return {
          verdict: 'AT_RISK',
          headline: 'High Accounts Receivable',
          reason: `Goal progress is ${Math.round(avgGoalProgress)}% but ${Math.round(receivableRatio)}% of billed revenue is uncollected. Follow up on unpaid invoices.`,
          score: 60,
          badges: ['Cash Collection Risk', `${kpis.overdueInvoices} Overdue`],
        };
      }
      return {
        verdict: 'ON_TRACK',
        headline: 'On Track with Agency Targets',
        reason: `Solid execution at ${Math.round(avgGoalProgress)}% of targets. ${kpis.activeClients} active clients, ${kpis.activeLeads} pipeline leads.`,
        score: 80,
        badges: [
          `${kpis.activeClients} Clients`,
          `${kpis.leadsThisWeek} Leads/wk`,
          `${kpis.daysActiveThisWeek} Active Days`,
        ],
      };
    }
    if (avgGoalProgress >= 40) {
      return {
        verdict: 'AT_RISK',
        headline: 'Below Target Pace',
        reason: `Agency execution is at ${Math.round(avgGoalProgress)}% of target. ${pipelineDrought ? 'Pipeline drought: 0 new leads this week.' : 'Increase outreach and proposal velocity.'}`,
        score: 55,
        badges: ['Pace Warning', `${kpis.daysActiveThisWeek}/7 Days`],
      };
    }
    return {
      verdict: 'BEHIND',
      headline: 'Significantly Behind Goals',
      reason: `Only ${Math.round(avgGoalProgress)}% of targets reached. Revenue and pipeline need urgent attention.`,
      score: 35,
      badges: ['Under Target', `${kpis.activeLeads} Pipeline`],
    };
  }

  // Heuristic fallback: no goals configured
  let score = 0;
  if (kpis.activeClients >= 2) score += 25;
  else if (kpis.activeClients >= 1) score += 15;
  if (kpis.activeLeads >= 3) score += 20;
  else if (kpis.activeLeads >= 1) score += 10;
  if (kpis.leadsThisWeek >= 2) score += 15;
  else if (kpis.leadsThisWeek >= 1) score += 8;
  if (kpis.daysActiveThisWeek >= 3) score += 15;
  else if (kpis.daysActiveThisWeek >= 1) score += 8;
  if (kpis.realizedCash > 0) score += 15;
  if (receivableRatio > 50) score -= 10;

  if (score >= 75) {
    return {
      verdict: 'ON_TRACK',
      headline: 'Healthy Agency Momentum',
      reason: `${kpis.activeClients} active clients, ${kpis.activeLeads} pipeline leads, ₹${Math.round(kpis.realizedCash / 1000)}K realized cash.`,
      score,
      badges: [`${kpis.activeClients} Clients`, `${kpis.leadsThisWeek} Leads/wk`],
    };
  }
  if (score >= 45) {
    return {
      verdict: 'AT_RISK',
      headline: 'Moderate Activity — At Risk',
      reason: `Agency is active but needs stronger pipeline. ${pipelineDrought ? 'No new leads this week.' : `${kpis.leadsThisWeek} leads acquired.`}`,
      score,
      badges: ['Moderate Pace', `${kpis.daysActiveThisWeek}/7 Days`],
    };
  }
  return {
    verdict: 'BEHIND',
    headline: 'Behind Optimal Velocity',
    reason: `Low weekly volume. ${kpis.activeClients} clients, ${kpis.activeLeads} leads. Ramp up outbound and proposals.`,
    score: Math.max(score, 25),
    badges: ['Low Velocity', `${kpis.daysActiveThisWeek} Active Days`],
  };
}

/**
 * Deterministically evaluate the status of Pillar 3: Trading OS → SaaS.
 */
export function evaluateSaasStatus(
  kpis: SaasKpiSummary,
  goals: Goal[] = []
): StatusEvaluation {
  // 1. Zero-data state: uninitialized
  if (
    kpis.totalFeatures === 0 &&
    kpis.totalDistributionActivities === 0 &&
    kpis.totalUsers === 0 &&
    kpis.focusTimeTotalSeconds === 0
  ) {
    return {
      verdict: 'NEGLECTED',
      headline: 'Awaiting Initial Input',
      reason:
        'No features, test runs, distribution, or user metrics tracked yet. Create your first feature to begin.',
      score: 10,
      badges: ['Uninitialized'],
    };
  }

  // 2. Inactivity in past 7 days
  const weeklyFocusMinutes = Math.floor(kpis.focusTimeThisWeekSeconds / 60);
  if (
    kpis.daysActiveThisWeek === 0 &&
    weeklyFocusMinutes === 0 &&
    kpis.distributionThisWeek === 0
  ) {
    return {
      verdict: 'NEGLECTED',
      headline: 'Zero Activity in 7 Days',
      reason:
        'SaaS pillar is dormant. No build sessions, distribution activities, or updates recorded this week.',
      score: 15,
      badges: ['Inactive 7d', 'High Priority'],
    };
  }

  // 3. Evaluate against active goals if present
  const saasGoals = goals.filter(
    (g) => g.pillarId === 'trading_os' && g.isActive
  );
  let goalScoreSum = 0;
  let goalCount = 0;

  for (const g of saasGoals) {
    if (g.targetValue > 0) {
      const pctValue = safePct(g.currentComputedValue, g.targetValue) || 0;
      goalScoreSum += Math.min(pctValue, 120);
      goalCount++;
    }
  }

  const avgGoalProgress = goalCount > 0 ? goalScoreSum / goalCount : null;

  // Critical feedback risk
  const hasCriticalFeedback = kpis.criticalOrHighFeedback > 0;

  if (avgGoalProgress !== null) {
    if (avgGoalProgress >= 110) {
      return {
        verdict: 'EXCEEDING',
        headline: 'Surpassing SaaS Targets',
        reason: `Averaging ${Math.round(avgGoalProgress)}% across active goals. Strong velocity across product & distribution.`,
        score: 95,
        badges: [
          `${kpis.totalUsers} Users`,
          `${kpis.payingUsers} Paying`,
          `${kpis.featuresDone} Done`,
        ],
      };
    }
    if (avgGoalProgress >= 75) {
      if (hasCriticalFeedback) {
        return {
          verdict: 'AT_RISK',
          headline: 'High-Severity Feedback Open',
          reason: `Pace is ${Math.round(avgGoalProgress)}% of target, but there are ${kpis.criticalOrHighFeedback} critical or high-severity issue(s) unresolved.`,
          score: 65,
          badges: ['Feedback Risk', `${kpis.criticalOrHighFeedback} High/Crit`],
        };
      }
      return {
        verdict: 'ON_TRACK',
        headline: 'On Track with SaaS Targets',
        reason: `Solid execution at ${Math.round(avgGoalProgress)}% of targets. ${kpis.featuresInProgress} features in progress, ${kpis.totalUsers} total users.`,
        score: 80,
        badges: [
          `${kpis.featuresDone} Done`,
          `${kpis.distributionThisWeek} Dist/wk`,
          `${kpis.daysActiveThisWeek} Active Days`,
        ],
      };
    }
    if (avgGoalProgress >= 40) {
      return {
        verdict: 'AT_RISK',
        headline: 'Below Target Pace',
        reason: `SaaS progress is at ${Math.round(avgGoalProgress)}% of target. Ramp up build iterations or distribution activities.`,
        score: 55,
        badges: ['Pace Warning', `${kpis.daysActiveThisWeek}/7 Days`],
      };
    }
    return {
      verdict: 'BEHIND',
      headline: 'Significantly Behind Goals',
      reason: `Only ${Math.round(avgGoalProgress)}% of targets reached. Product delivery and distribution need attention.`,
      score: 35,
      badges: ['Under Target', `${kpis.featuresDone} Completed`],
    };
  }

  // 4. Heuristic Fallback (explicitly transparent)
  let heuristicScore = 0;

  // Product build momentum
  if (kpis.featuresDone >= 3 || kpis.publishedReleases >= 1) heuristicScore += 25;
  else if (kpis.featuresDone >= 1 || kpis.featuresInProgress >= 1) heuristicScore += 15;

  // Testing rigor
  if (kpis.testPassRate !== null && kpis.testPassRate >= 80) heuristicScore += 15;
  else if (kpis.totalTestRuns >= 1) heuristicScore += 8;

  // Distribution activity
  if (kpis.distributionThisWeek >= 3) heuristicScore += 20;
  else if (kpis.distributionThisWeek >= 1) heuristicScore += 10;

  // User traction
  if (kpis.payingUsers > 0) heuristicScore += 25;
  else if (kpis.totalUsers >= 5) heuristicScore += 15;
  else if (kpis.totalUsers >= 1) heuristicScore += 8;

  // Active consistency
  if (kpis.daysActiveThisWeek >= 3) heuristicScore += 15;
  else if (kpis.daysActiveThisWeek >= 1) heuristicScore += 8;

  // Deduct for unresolved critical feedback
  if (hasCriticalFeedback) heuristicScore = Math.max(heuristicScore - 15, 20);

  // Severe distribution starvation warning (building without any distribution)
  const distributionDrought = kpis.totalFeatures >= 2 && kpis.totalDistributionActivities === 0;

  if (distributionDrought && (kpis.featuresInProgress > 0 || kpis.featuresDone > 0)) {
    return {
      verdict: 'AT_RISK',
      headline: 'Distribution Starvation [Heuristic]',
      reason:
        'Product is being built with 0 distribution activities recorded. Distribution is needed for SaaS traction.',
      score: Math.max(heuristicScore, 45),
      badges: ['Distribution Starvation', `${kpis.daysActiveThisWeek} Active Days`],
    };
  }

  if (heuristicScore >= 75) {
    return {
      verdict: 'ON_TRACK',
      headline: 'Healthy SaaS Momentum [Heuristic]',
      reason: `Solid activity: ${kpis.featuresDone} features completed, ${kpis.distributionThisWeek} distribution activities this week across ${kpis.daysActiveThisWeek} active days.`,
      score: heuristicScore,
      badges: [`${kpis.featuresDone} Features Done`, `${kpis.distributionThisWeek} Dist/wk`],
    };
  }
  if (heuristicScore >= 40) {
    return {
      verdict: 'AT_RISK',
      headline: 'Moderate Activity — At Risk [Heuristic]',
      reason: `Moderate progress: ${kpis.featuresInProgress} features in dev, ${kpis.distributionThisWeek} distribution this week.`,
      score: heuristicScore,
      badges: ['Moderate Pace', `${kpis.daysActiveThisWeek}/7 Days`],
    };
  }
  return {
    verdict: 'BEHIND',
    headline: 'Behind Optimal Velocity [Heuristic]',
    reason: `Low weekly velocity (${kpis.featuresInProgress} in progress, ${kpis.distributionThisWeek} distribution). Step up build and distribution.`,
    score: Math.max(heuristicScore, 25),
    badges: ['Low Velocity', `${kpis.daysActiveThisWeek} Active Days`],
  };
}

/**
 * Deterministically evaluate the status of Pillar 4: Forex Learning.
 * Evaluates the core learning loop:
 * Study → Understanding → Setup Development → Backtesting → Paper Trading → Review → Discipline
 * Code calculates. AI judges and explains.
 */
export function evaluateForexStatus(
  kpis: ForexKpiSummary,
  goals: Goal[] = []
): StatusEvaluation {
  // 1. Zero Data / Uninitialized Check
  if (
    kpis.totalStudySessions === 0 &&
    kpis.totalSetups === 0 &&
    kpis.totalBacktestBatches === 0 &&
    kpis.totalPaperTrades === 0 &&
    kpis.focusTimeTotalSeconds === 0
  ) {
    return {
      verdict: 'NEGLECTED',
      headline: 'Awaiting Initial Input',
      reason:
        'No Forex study sessions, setups, backtests, or paper trades tracked yet. Log your first study session or setup to begin tracking.',
      score: 10,
      badges: ['Uninitialized'],
    };
  }

  // 2. Weekly Inactivity / Neglect Check (last 7 days)
  if (
    kpis.daysActiveThisWeek === 0 &&
    kpis.studySessionsThisWeek === 0 &&
    kpis.tradesThisWeek === 0 &&
    kpis.focusTimeThisWeekSeconds === 0
  ) {
    return {
      verdict: 'NEGLECTED',
      headline: 'Forex Learning Dormant',
      reason:
        '0 study sessions, backtests, or paper trades logged in the past 7 days. Consistency across study and practice is required to build trading skill.',
      score: 15,
      badges: ['7-Day Inactivity', 'Dormant'],
    };
  }

  // 3. Explicit Deterministic Critical Mistake Threshold Check
  const totalCriticalMistakes = kpis.fomoCount + kpis.revengeCount;
  if (totalCriticalMistakes >= CRITICAL_MISTAKE_COUNT_THRESHOLD) {
    return {
      verdict: 'AT_RISK',
      headline: `Discipline Breakdown: Severe Mistakes (Threshold >= ${CRITICAL_MISTAKE_COUNT_THRESHOLD})`,
      reason: `Observed ${totalCriticalMistakes} critical discipline breach(es) (${kpis.fomoCount} FOMO, ${kpis.revengeCount} Revenge). Explicit threshold is >= ${CRITICAL_MISTAKE_COUNT_THRESHOLD}. Emotional leaks compromise execution. Review your trading plan before next paper trade.`,
      score: 35,
      badges: [
        `Discipline Breach: ${totalCriticalMistakes} Critical`,
        `${kpis.ruleAdherenceRate ?? 0}% Adherence`,
      ],
    };
  }

  // 4. Low Rule Adherence Check (Process Breakdown)
  if (
    kpis.totalPaperTrades >= 3 &&
    kpis.ruleAdherenceRate !== null &&
    kpis.ruleAdherenceRate < 70
  ) {
    return {
      verdict: 'AT_RISK',
      headline: `Rule Adherence Compromised (${kpis.ruleAdherenceRate}%)`,
      reason: `Paper trading rule adherence is ${kpis.ruleAdherenceRate}%, below the 70% process minimum. You have violated rules on ${kpis.ruleViolatedCount} of ${kpis.totalPaperTrades} paper trades.`,
      score: 40,
      badges: [
        `Low Adherence: ${kpis.ruleAdherenceRate}%`,
        `${kpis.cleanTradeStreak} Streak`,
      ],
    };
  }

  // 5. Premature Paper Trading Check (Insufficient Backtest Sample Size)
  if (kpis.totalPaperTrades >= 5 && kpis.totalBacktestedTrades < 20) {
    return {
      verdict: 'AT_RISK',
      headline: 'Insufficient Backtesting Sample Size',
      reason: `Executing paper trades with only ${kpis.totalBacktestedTrades} backtested sample trades. Minimum statistical threshold is 20 historical sample trades to establish setup validity.`,
      score: 45,
      badges: [
        `Sample Deficit (${kpis.totalBacktestedTrades}/20)`,
        `${kpis.totalSetups} Setups`,
      ],
    };
  }

  // 6. Active Goals Progress Evaluation (if user defined active Forex goals)
  const activeForexGoals = goals.filter((g) => g.pillarId === 'forex' && g.isActive);
  if (activeForexGoals.length > 0) {
    let totalProgress = 0;
    for (const g of activeForexGoals) {
      const current = g.currentComputedValue || 0;
      const target = g.targetValue || 1;
      const pct = Math.min(150, Math.max(0, (current / target) * 100));
      totalProgress += pct;
    }
    const avgGoalProgress = totalProgress / activeForexGoals.length;

    if (avgGoalProgress >= 100) {
      return {
        verdict: 'EXCEEDING',
        headline: 'Surpassing Learning Goals',
        reason: `Average Forex goal progress is ${Math.round(avgGoalProgress)}%. Excellent pace across study, backtesting, and paper trading discipline.`,
        score: Math.min(100, Math.round(90 + (avgGoalProgress - 100) * 0.2)),
        badges: [
          'Goal Leader',
          `${activeForexGoals.length} Goals Active`,
          `${kpis.ruleAdherenceRate ?? 100}% Adherence`,
        ],
      };
    }
    if (avgGoalProgress >= 70) {
      return {
        verdict: 'ON_TRACK',
        headline: 'On Track with Learning Goals',
        reason: `Forex goal execution at ${Math.round(avgGoalProgress)}% of target. Steady study and practice rhythm.`,
        score: Math.round(70 + (avgGoalProgress - 70) * 0.6),
        badges: [
          'On Schedule',
          `${kpis.daysActiveThisWeek}/7 Days`,
          `${kpis.totalStudyHoursFormatted} Studied`,
        ],
      };
    }
    if (avgGoalProgress >= 40) {
      return {
        verdict: 'AT_RISK',
        headline: 'Pacing Behind Forex Goals',
        reason: `Progress is at ${Math.round(avgGoalProgress)}% of target. Increase study sessions or backtesting sample size.`,
        score: 50,
        badges: ['Pace Warning', `${kpis.daysActiveThisWeek}/7 Days`],
      };
    }
    return {
      verdict: 'BEHIND',
      headline: 'Significantly Behind Forex Goals',
      reason: `Only ${Math.round(avgGoalProgress)}% of targets reached. Revisit daily routine and study blocks.`,
      score: 35,
      badges: ['Under Target', `${kpis.daysActiveThisWeek} Active Days`],
    };
  }

  // 7. Transparent Heuristic Fallback (when no explicit user goals exist)
  let heuristicScore = 0;

  // Study Volume & Recency
  if (kpis.totalStudyMinutes >= 600 || kpis.studyMinutesThisWeek >= 120) {
    heuristicScore += 25;
  } else if (kpis.totalStudyMinutes >= 180 || kpis.studyMinutesThisWeek >= 45) {
    heuristicScore += 15;
  } else if (kpis.totalStudySessions >= 1) {
    heuristicScore += 8;
  }

  // Setup Development & Strategy Validation
  if (kpis.setupsValidated >= 1) {
    heuristicScore += 20;
  } else if (kpis.setupsPaperTrading >= 1 || kpis.setupsBacktesting >= 1) {
    heuristicScore += 12;
  } else if (kpis.totalSetups >= 1) {
    heuristicScore += 6;
  }

  // Backtesting Rigor
  if (kpis.totalBacktestedTrades >= 50) {
    heuristicScore += 20;
  } else if (kpis.totalBacktestedTrades >= 20) {
    heuristicScore += 12;
  } else if (kpis.totalBacktestBatches >= 1) {
    heuristicScore += 6;
  }

  // Paper Trading Discipline (Primary Weight)
  if (kpis.totalPaperTrades >= 5 && (kpis.ruleAdherenceRate ?? 0) >= 85) {
    heuristicScore += 25;
  } else if (kpis.totalPaperTrades >= 1 && (kpis.ruleAdherenceRate ?? 0) >= 70) {
    heuristicScore += 15;
  } else if (kpis.totalPaperTrades >= 1) {
    heuristicScore += 8;
  }

  // Consistency across the week
  if (kpis.daysActiveThisWeek >= 3) {
    heuristicScore += 10;
  } else if (kpis.daysActiveThisWeek >= 1) {
    heuristicScore += 5;
  }

  // Check for outstanding execution (Exceeding)
  if (
    heuristicScore >= 80 &&
    kpis.setupsValidated >= 1 &&
    (kpis.ruleAdherenceRate ?? 0) >= 90 &&
    kpis.cleanTradeStreak >= 5
  ) {
    return {
      verdict: 'EXCEEDING',
      headline: 'Mastery Discipline Achieved [Heuristic]',
      reason: `Outstanding execution: ${kpis.totalStudyHoursFormatted} studied, ${kpis.setupsValidated} validated setup(s), ${kpis.totalBacktestedTrades} backtested sample trades, and ${kpis.ruleAdherenceRate}% paper trade rule adherence with a ${kpis.cleanTradeStreak}-trade clean streak.`,
      score: Math.min(100, heuristicScore),
      badges: [
        'Discipline Master',
        `${kpis.ruleAdherenceRate}% Adherence`,
        `${kpis.cleanTradeStreak} Clean Streak`,
      ],
    };
  }

  if (heuristicScore >= 50) {
    return {
      verdict: 'ON_TRACK',
      headline: 'Healthy Learning Momentum [Heuristic]',
      reason: `Solid progress: ${kpis.totalStudyHoursFormatted} studied, ${kpis.totalSetups} setup(s) documented, ${kpis.totalBacktestedTrades} backtest samples across ${kpis.daysActiveThisWeek} active days this week.`,
      score: heuristicScore,
      badges: [
        `${kpis.totalStudyHoursFormatted} Studied`,
        `${kpis.daysActiveThisWeek}/7 Days`,
        `${kpis.ruleAdherenceRate ?? 100}% Adherence`,
      ],
    };
  }

  if (heuristicScore >= 35) {
    return {
      verdict: 'AT_RISK',
      headline: 'Moderate Progress — At Risk [Heuristic]',
      reason: `Pacing is intermittent: ${kpis.studySessionsThisWeek} study session(s) this week, ${kpis.totalBacktestedTrades} backtested trades. Expand backtest sample size or consistency.`,
      score: heuristicScore,
      badges: ['Moderate Pace', `${kpis.daysActiveThisWeek}/7 Days`],
    };
  }

  return {
    verdict: 'BEHIND',
    headline: 'Behind Desired Learning Pace [Heuristic]',
    reason: `Low weekly volume across study, backtesting, and paper trading. Dedicate scheduled study and chart time to maintain momentum.`,
    score: Math.max(heuristicScore, 25),
    badges: ['Low Velocity', `${kpis.daysActiveThisWeek} Active Days`],
  };
}

/**
 * Deterministically evaluate the status of the Fitness / Health pillar.
 * Evaluates recorded habit adherence, NOT clinical or medical diagnosis.
 * 
 * Strict Precedence Hierarchy:
 * 1. Zero data all-time -> NEGLECTED (Score 10)
 * 2. Inactivity trailing 7d -> NEGLECTED (Score 15)
 * 3. Recovery deficit (sleep < 6.0h over >= 2 days) -> AT_RISK (Score 35)
 * 4. Compounded consistency lag (< 2 workouts AND < 80g protein) -> AT_RISK (Score 40)
 * 5. Goal-driven evaluation (if active goals configured)
 * 6. Heuristic Adherence Score fallback
 */
export function evaluateFitnessStatus(kpis: FitnessKpiSummary, goals: Goal[] = []): StatusEvaluation {
  // Precedence 1: Zero data all-time
  if (
    kpis.workoutsCount === 0 &&
    kpis.totalDistanceKm === 0 &&
    kpis.daysWithMealsLogged === 0 &&
    kpis.latestWeightKg === null &&
    kpis.totalActiveMinutes === 0
  ) {
    return {
      verdict: 'NEGLECTED',
      headline: 'Awaiting Initial Input',
      reason: 'No workouts, runs, meals, or bio snapshots tracked yet. Log your first training or meal session to begin.',
      score: 10,
      badges: ['Uninitialized'],
    };
  }

  // Precedence 2: Inactivity in the trailing 7 days
  if (
    kpis.workoutsThisWeek === 0 &&
    kpis.distanceThisWeekKm === 0 &&
    kpis.todayCalories === 0 &&
    kpis.footballSessionsThisWeek === 0 &&
    kpis.daysWithMealsLogged === 0 &&
    kpis.chessSudokuMinutesWeek === 0
  ) {
    return {
      verdict: 'NEGLECTED',
      headline: 'Fitness & Health Dormant',
      reason: 'No workouts, runs, nutrition, or recovery logged in the trailing 7 days. Consistency is key to habit adherence.',
      score: 15,
      badges: ['Inactive 7d', 'High Priority'],
    };
  }

  // Precedence 3: Critical Sleep / Recovery Deficit (Safety rule)
  // Wins over high workouts if average sleep is critically low
  if (kpis.sleepDeficitFlag && kpis.avgSleepHoursWeek !== null) {
    return {
      verdict: 'AT_RISK',
      headline: 'Recovery Deficit — Sleep Deprivation',
      reason: `Average sleep is ${kpis.avgSleepHoursWeek}h (< 6.0h threshold) across logged nights. Adequate recovery is essential to sustain physical training safely.`,
      score: 35,
      badges: ['Sleep Deficit', `${kpis.avgSleepHoursWeek}h Sleep Avg`],
    };
  }

  // Precedence 4: Compounded Consistency Lag
  if (kpis.workoutsThisWeek < 2 && kpis.avgDailyProteinWeek !== null && kpis.avgDailyProteinWeek < 80) {
    return {
      verdict: 'AT_RISK',
      headline: 'Compounded Consistency Lag',
      reason: `Both training consistency (${kpis.workoutsThisWeek} workouts this week) and nutrition (${kpis.avgDailyProteinWeek}g protein/day) are lagging target baselines.`,
      score: 40,
      badges: ['Low Frequency', 'Low Protein'],
    };
  }

  // Precedence 5: Active user-configured goals evaluation
  const activeGoals = goals.filter((g) => g.pillarId === 'fitness');
  if (activeGoals.length > 0) {
    let totalProgress = 0;
    for (const g of activeGoals) {
      const current = g.currentValue ?? 0;
      const target = g.targetValue || 1;
      const progress = Math.min(200, (current / target) * 100);
      totalProgress += progress;
    }
    const avgProgress = totalProgress / activeGoals.length;

    if (avgProgress >= 100) {
      return {
        verdict: 'EXCEEDING',
        headline: 'Surpassing Fitness Goals',
        reason: `Exceeding active fitness goals with an average achievement rate of ${Math.round(avgProgress)}%.`,
        score: 90,
        badges: ['Goals Exceeded', `${Math.round(avgProgress)}% Avg Progress`],
      };
    }

    if (avgProgress >= 70) {
      return {
        verdict: 'ON_TRACK',
        headline: 'On Track with Fitness Goals',
        reason: `Solid pacing against active fitness goals with an average progress rate of ${Math.round(avgProgress)}%.`,
        score: 75,
        badges: ['Goals On Track', `${Math.round(avgProgress)}% Progress`],
      };
    }

    if (avgProgress >= 40) {
      return {
        verdict: 'AT_RISK',
        headline: 'Pacing Behind Goals — At Risk',
        reason: `Current progress across active goals averages ${Math.round(avgProgress)}%. Increase weekly workout or nutrition adherence to regain pace.`,
        score: 45,
        badges: ['Goals At Risk', `${Math.round(avgProgress)}% Progress`],
      };
    }

    return {
      verdict: 'BEHIND',
      headline: 'Behind Desired Goals',
      reason: `Significant variance against active goals (${Math.round(avgProgress)}% progress). Revisit routine or adjust goals to match current schedule.`,
      score: 30,
      badges: ['Behind Goals', `${Math.round(avgProgress)}% Progress`],
    };
  }

  // Precedence 6: Heuristic Fitness Adherence Score Fallback
  // Note: Measures habit adherence, NOT clinical health
  const score = kpis.fitnessAdherenceScore;

  if (score >= 75 && kpis.workoutsThisWeek >= 3 && (kpis.avgSleepHoursWeek === null || kpis.avgSleepHoursWeek >= 7.0)) {
    return {
      verdict: 'EXCEEDING',
      headline: 'High Habit Adherence [Heuristic]',
      reason: `Strong execution: ${kpis.workoutsThisWeek} workouts this week, ${kpis.totalActiveMinutes}m active, with ${score}/100 adherence score.`,
      score: Math.min(100, score),
      badges: ['High Adherence', `${kpis.workoutsThisWeek} Workouts/wk`, `${score}/100 Score`],
    };
  }

  if (score >= 50) {
    return {
      verdict: 'ON_TRACK',
      headline: 'Consistent Habit Momentum [Heuristic]',
      reason: `Solid routine: ${kpis.workoutsThisWeek} workout(s) this week, ${kpis.distanceThisWeekKm}km run, ${score}/100 adherence score.`,
      score,
      badges: ['Consistent Habit', `${kpis.workoutsThisWeek} Workouts`, `${score}/100 Score`],
    };
  }

  if (score >= 30) {
    return {
      verdict: 'AT_RISK',
      headline: 'Moderate Habit Adherence [Heuristic]',
      reason: `Habit adherence is intermittent (${score}/100 score). Aim for higher consistency across workouts and nutrition logs.`,
      score,
      badges: ['Moderate Adherence', `${score}/100 Score`],
    };
  }

  return {
    verdict: 'BEHIND',
    headline: 'Behind Desired Consistency [Heuristic]',
    reason: `Low weekly volume across workouts and habits (${score}/100 score). Log workouts and sleep regularly to build momentum.`,
    score: Math.max(score, 20),
    badges: ['Low Adherence', `${score}/100 Score`],
  };
}

// ============================================================================
// PILLAR 6: VOIRE Deterministic Status Evaluator
// ============================================================================

export const VOIRE_STATUS_THRESHOLDS = {
  MIN_WEEKEND_CREATIVE_DAYS_LOOKBACK: 14,
  MIN_COMMERCIAL_TRACTION_ORDERS_WEEK: 5,
  MIN_COMMERCIAL_TRACTION_MARGIN_PCT: 25,
  PIPELINE_BOTTLENECK_APPROVED_DESIGNS: 4,
  PIPELINE_BOTTLENECK_LIVE_PRODUCTS: 3,
};

/**
 * Deterministically evaluate the status of the VOIRE (D2C / POD Brand) pillar.
 * 
 * Precedence:
 * 1. Initial Uninitialized State (0 data -> NEGLECTED)
 * 2. Active User-Configured Goals (authoritative user targets)
 * 3. Commercial / Distribution Bottleneck (Products ready, 0 marketing/orders -> AT_RISK)
 * 4. Creative / Production Bottleneck (Designs approved, 0 products -> AT_RISK)
 * 5. Weekend Creative Neutrality (Weekday pause never causes penalty if weekend studio output exists -> ON_TRACK)
 * 6. Commercial Traction Heuristic (Orders/week >= 5 and margin >= 25% -> EXCEEDING)
 * 7. Baseline Active Momentum Fallback (Active operations -> ON_TRACK, else BEHIND)
 */
export function evaluateVoireStatus(
  kpis: VoireKpiSummary,
  goals: Goal[] = [],
  now = new Date()
): StatusEvaluation {
  // Precedence 1: Active User-Configured Goals (Authoritative User Intent)
  const activeGoals = goals.filter((g) => g.pillarId === 'voire');
  if (activeGoals.length > 0) {
    let totalProgress = 0;
    for (const g of activeGoals) {
      const current = g.currentValue ?? 0;
      const target = g.targetValue || 1;
      const progress = Math.min(200, (current / target) * 100);
      totalProgress += progress;
    }
    const avgProgress = totalProgress / activeGoals.length;

    if (avgProgress >= 100) {
      return {
        verdict: 'EXCEEDING',
        headline: 'Surpassing Brand Goals',
        reason: `Exceeding active brand goals with an average achievement rate of ${Math.round(avgProgress)}%.`,
        score: 90,
        badges: ['Goals Exceeded', `${Math.round(avgProgress)}% Avg Progress`],
      };
    }

    if (avgProgress >= 70) {
      return {
        verdict: 'ON_TRACK',
        headline: 'On Track with Brand Goals',
        reason: `Solid execution against active brand goals with an average progress rate of ${Math.round(avgProgress)}%.`,
        score: 75,
        badges: ['Goals On Track', `${Math.round(avgProgress)}% Progress`],
      };
    }

    if (avgProgress >= 40) {
      return {
        verdict: 'AT_RISK',
        headline: 'Pacing Behind Brand Goals',
        reason: `Current progress across active goals averages ${Math.round(avgProgress)}%. Increase marketing campaigns or drop launches to regain pace.`,
        score: 45,
        badges: ['Goals At Risk', `${Math.round(avgProgress)}% Progress`],
      };
    }

    return {
      verdict: 'BEHIND',
      headline: 'Behind Desired Brand Goals',
      reason: `Significant variance against active goals (${Math.round(avgProgress)}% progress). Revisit product catalog or marketing outreach.`,
      score: 30,
      badges: ['Behind Goals', `${Math.round(avgProgress)}% Progress`],
    };
  }

  // Precedence 2: Marketing Acquisition Leak
  if (kpis.marketingSpend > 0 && kpis.paidOrdersCount === 0) {
    return {
      verdict: 'AT_RISK',
      headline: 'Marketing Acquisition Leak',
      reason: `₹${kpis.marketingSpend.toLocaleString('en-IN')} committed to marketing campaigns with zero paid customer orders. Inspect campaign creative or conversion funnel.`,
      score: 35,
      badges: ['Acquisition Leak', '0 Paid Conversions'],
    };
  }

  // Precedence 3: Drop Execution Bottleneck
  if (kpis.activeDrops > 0 && kpis.activeProducts === 0) {
    return {
      verdict: 'AT_RISK',
      headline: 'Drop Execution Bottleneck',
      reason: 'Active or scheduled drop exists without assigned active catalog products. Assign SKUs before drop launch.',
      score: 40,
      badges: ['Drop Bottleneck', '0 Catalog SKUs'],
    };
  }

  // Precedence 4: Sampling Pipeline Bottleneck
  if (kpis.totalDesigns > 0 && kpis.readyOrSampledDesigns === 0) {
    return {
      verdict: 'AT_RISK',
      headline: 'Sampling Pipeline Bottleneck',
      reason: `${kpis.totalDesigns} design concepts exist, but none have completed sampling or sample approval. Order physical samples or finalize tech packs before scheduling drops.`,
      score: 45,
      badges: ['Sampling Bottleneck', `${kpis.totalDesigns} Designs Pending Sample`],
    };
  }

  // Precedence 5: Commercial Inactive Distribution Bottleneck
  if (
    kpis.activeProducts >= VOIRE_STATUS_THRESHOLDS.PIPELINE_BOTTLENECK_LIVE_PRODUCTS &&
    kpis.totalOrders === 0 &&
    kpis.marketingSpend === 0
  ) {
    return {
      verdict: 'AT_RISK',
      headline: 'Commercial Bottleneck: Inactive Distribution',
      reason: `You have ${kpis.activeProducts} products live in catalog, but zero customer orders and zero marketing campaigns logged. Launch content or campaigns to drive traffic.`,
      score: 40,
      badges: ['Distribution Bottleneck', `${kpis.activeProducts} Live Products`, '0 Orders'],
    };
  }

  // Precedence 6: Weekend Creative Neutrality Check
  if (kpis.creativePauseExcused || !isWeekendCalendarDay(now)) {
    return {
      verdict: 'ON_TRACK',
      headline: 'Weekday Operations (Creative Pause Excused)',
      reason: 'Weekday creative pause active. Creative sprint operates on weekend cadence; zero weekday design additions do not penalize momentum.',
      score: 75,
      badges: ['Weekday Operations', 'Creative Pause Excused'],
    };
  }

  // Precedence 7: Initial Uninitialized State (Only reached if active weekend with 0 data)
  if (
    kpis.totalDesigns === 0 &&
    kpis.totalProducts === 0 &&
    kpis.totalDrops === 0 &&
    kpis.totalOrders === 0
  ) {
    return {
      verdict: 'NEGLECTED',
      headline: 'Awaiting Initial Input',
      reason: 'No VOIRE creative designs or commercial activities logged yet. Weekend creative sprint is open for ideation.',
      score: 10,
      badges: ['Uninitialized'],
    };
  }

  // Precedence 8: Commercial Traction Heuristic
  if (
    (kpis.ordersThisWeek || 0) >= VOIRE_STATUS_THRESHOLDS.MIN_COMMERCIAL_TRACTION_ORDERS_WEEK &&
    kpis.contributionMarginPercent >= VOIRE_STATUS_THRESHOLDS.MIN_COMMERCIAL_TRACTION_MARGIN_PCT
  ) {
    return {
      verdict: 'EXCEEDING',
      headline: 'Strong Commercial Traction [Heuristic]',
      reason: `High sales velocity: ${kpis.ordersThisWeek} orders this week with ${kpis.contributionMarginPercent.toFixed(1)}% contribution margin and ₹${Math.round(kpis.netSales)} net sales.`,
      score: 85,
      badges: [
        `${kpis.ordersThisWeek} Orders/wk`,
        `${kpis.contributionMarginPercent.toFixed(1)}% Margin`,
        'Commercial Traction',
      ],
    };
  }

  // Precedence 9: Baseline Active Momentum Fallback
  return {
    verdict: 'ON_TRACK',
    headline: 'Active Brand Momentum [Heuristic]',
    reason: `Active D2C operations across catalog (${kpis.totalDesigns} designs, ${kpis.activeProducts} active products, ${kpis.totalOrders} total orders).`,
    score: 70,
    badges: ['Active Brand', `${kpis.totalOrders} Orders`],
  };
}

