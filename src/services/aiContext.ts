// ============================================================================
// PERSONAL OS — AI Context Builder
// Deterministic facts extractor. Assembles structured, verifiable data packets
// for AI analysis without hallucination risk.
// ============================================================================

import { loadJobHuntKpiSummary } from './jobHuntKpi';
import { loadAgencyKpiSummary, type AgencyKpiSummary } from './agencyKpi';
import { loadSaasKpiSummary, type SaasKpiSummary } from './saasKpi';
import { loadForexKpiSummary, type ForexKpiSummary } from './forexKpi';
import { loadFitnessKpiSummary } from './fitnessKpi';
import { loadVoireKpiSummary } from './voireKpi';
import {
  evaluateJobHuntStatus,
  evaluateAgencyStatus,
  evaluateSaasStatus,
  evaluateForexStatus,
  evaluateFitnessStatus,
  evaluateVoireStatus,
} from './statusEngine';
import { dbGetAll, STORES } from './db';
import type {
  Goal,
  JobOpportunity,
  JobOutreach,
  ActivityEvent,
  AgencyClient,
  AgencyLead,
  AgencyInvoice,
  SaasFeature,
  SaasFeedback,
  SaasRelease,
  FitnessKpiSummary,
  VoireKpiSummary,
  VoireDesign,
  VoireProduct,
  VoireDrop,
  VoireOrder,
  VoireOrderItem,
  VoireMarketingCampaign,
} from '../types';
import { formatDuration, formatSafePercent, formatINR } from '../utils/helpers';

export interface JobHuntAiFacts {
  timestamp: string;
  pillar: 'job_hunt';
  status: {
    verdict: string;
    score: number;
    headline: string;
    reason: string;
  };
  funnel: {
    totalOpportunities: number;
    activePipeline: number;
    applied: number;
    screeningsOrInterviews: number;
    offers: number;
    rejectedOrArchived: number;
    interviewConversionRate: string;
    offerConversionRate: string;
  };
  velocity: {
    applicationsToday: number;
    applicationsThisWeek: number;
    outreachToday: number;
    outreachThisWeek: number;
    outreachResponseRate: string;
    daysActivePastWeek: number;
  };
  focusTime: {
    todayFormatted: string;
    thisWeekFormatted: string;
    totalFormatted: string;
    categoryBreakdown: Record<string, string>;
  };
  activeGoals: Array<{
    title: string;
    cadence: string;
    targetValue: number;
    currentValue: number;
    unit?: string;
    progressPercent: string;
  }>;
  recentOpportunities: Array<{
    company: string;
    role: string;
    stage: string;
    workMode: string;
    discoveredAt: string;
  }>;
  recentOutreach: Array<{
    contactName: string;
    company?: string;
    channel: string;
    replied: boolean;
    sentAt: string;
  }>;
}

/**
 * Deterministically assemble Job Hunt facts.
 */
export async function buildJobHuntAiFacts(): Promise<JobHuntAiFacts> {
  const [kpis, allGoals, opps, outreaches] = await Promise.all([
    loadJobHuntKpiSummary(),
    dbGetAll<Goal>(STORES.GOALS),
    dbGetAll<JobOpportunity>(STORES.JOB_OPPORTUNITIES),
    dbGetAll<JobOutreach>(STORES.JOB_OUTREACH),
  ]);

  const jobGoals = allGoals.filter((g) => g.pillarId === 'job_hunt' && g.isActive);
  const statusEval = evaluateJobHuntStatus(kpis, jobGoals);

  // Focus category breakdown formatted
  const categoryBreakdown: Record<string, string> = {};
  for (const [cat, secs] of Object.entries(kpis.focusTimeByCategory)) {
    categoryBreakdown[cat] = formatDuration(secs);
  }

  // Sort recent opportunities
  const sortedOpps = [...opps].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);
  // Sort recent outreach
  const sortedOutreach = [...outreaches].sort((a, b) => b.sentAt.localeCompare(a.sentAt)).slice(0, 5);

  return {
    timestamp: new Date().toISOString(),
    pillar: 'job_hunt',
    status: {
      verdict: statusEval.verdict,
      score: statusEval.score,
      headline: statusEval.headline,
      reason: statusEval.reason,
    },
    funnel: {
      totalOpportunities: kpis.totalOpportunities,
      activePipeline: kpis.activeOpportunities,
      applied: kpis.totalApplications,
      screeningsOrInterviews: kpis.interviewsReached,
      offers: kpis.offersReceived,
      rejectedOrArchived: kpis.archivedOpportunities,
      interviewConversionRate: formatSafePercent(kpis.interviewConversionRate),
      offerConversionRate: formatSafePercent(kpis.offerConversionRate),
    },
    velocity: {
      applicationsToday: kpis.applicationsToday,
      applicationsThisWeek: kpis.applicationsThisWeek,
      outreachToday: kpis.outreachToday,
      outreachThisWeek: kpis.outreachThisWeek,
      outreachResponseRate: formatSafePercent(kpis.responseRate),
      daysActivePastWeek: kpis.daysActiveThisWeek,
    },
    focusTime: {
      todayFormatted: formatDuration(kpis.focusTimeTodaySeconds),
      thisWeekFormatted: formatDuration(kpis.focusTimeThisWeekSeconds),
      totalFormatted: formatDuration(kpis.focusTimeTotalSeconds),
      categoryBreakdown,
    },
    activeGoals: jobGoals.map((g) => {
      const pct = g.targetValue > 0 ? (g.currentComputedValue / g.targetValue) * 100 : 0;
      return {
        title: g.title,
        cadence: g.cadence,
        targetValue: g.targetValue,
        currentValue: g.currentComputedValue,
        unit: g.unit,
        progressPercent: `${Math.round(pct)}%`,
      };
    }),
    recentOpportunities: sortedOpps.map((o) => ({
      company: o.company,
      role: o.role,
      stage: o.stage,
      workMode: o.workMode,
      discoveredAt: o.discoveredAt,
    })),
    recentOutreach: sortedOutreach.map((r) => ({
      contactName: r.contactName,
      company: r.company,
      channel: r.channel,
      replied: Boolean(r.repliedAt),
      sentAt: r.sentAt,
    })),
  };
}

/**
 * Generate an offline deterministic strategic review or prompt payload.
 */
export function generateOfflineStrategicAudit(facts: JobHuntAiFacts): string {
  const { status, funnel, velocity, focusTime, activeGoals } = facts;

  let advice = '';
  if (velocity.applicationsThisWeek < 5 && velocity.outreachThisWeek < 5) {
    advice += `- **Pipeline Volume Warning**: You have only logged ${velocity.applicationsThisWeek} applications and ${velocity.outreachThisWeek} outreaches in the past 7 days. At this velocity, finding high-quality matches will take significantly longer. Aim for at least 2 tailored applications or 3 recruiter/founder outreaches daily.\n`;
  }
  if (funnel.applied > 10 && (funnel.screeningsOrInterviews === 0)) {
    advice += `- **Conversion Bottleneck**: You have submitted ${funnel.applied} applications but have 0 screenings or interviews. Your resume or targeting strategy is likely not passing initial screening. Shift toward warm outreach to founders and engineering managers rather than cold web applications.\n`;
  }
  if (funnel.screeningsOrInterviews > 0 && funnel.offers === 0) {
    advice += `- **Interview Preparation**: You have converted ${funnel.screeningsOrInterviews} opportunities into interviews. Allocate dedicated Focus Timer blocks for System Design and Behavioral prep.\n`;
  }
  if (velocity.outreachThisWeek > 0 && velocity.outreachResponseRate === '0.0%') {
    advice += `- **Outreach Iteration**: Zero responses recorded on outreach. Experiment with shorter opening hooks (under 75 words), highlighting a specific portfolio project or insight into their tech stack.\n`;
  }

  if (!advice) {
    advice = '- **Execution Steady**: Pipeline velocity and activity are aligned. Continue maintaining outreach cadence and follow-up discipline.\n';
  }

  return `### Job Hunt Pillar — Strategic Operating Audit

**Verdict**: **${status.verdict}** (Health Score: ${status.score}/100)  
*${status.headline}* — ${status.reason}

#### 1. Core Reality (Deterministic Metrics)
- **Active Pipeline**: ${funnel.activePipeline} roles across stages (${funnel.applied} applied, ${funnel.screeningsOrInterviews} interviews, ${funnel.offers} offers)
- **Weekly Run-Rate**: ${velocity.applicationsThisWeek} applications / ${velocity.outreachThisWeek} outreaches across ${velocity.daysActivePastWeek} active days
- **Outreach Response Rate**: ${velocity.outreachResponseRate}
- **Interview Conversion Rate**: ${funnel.interviewConversionRate}
- **Focus Investment**: ${focusTime.thisWeekFormatted} this week (${focusTime.todayFormatted} today)

#### 2. Strategic Insights & Next Actions
${advice}
#### 3. Goal Alignment
${
  activeGoals.length > 0
    ? activeGoals
        .map(
          (g) =>
            `- **${g.title}** (${g.cadence}): ${g.currentValue} / ${g.targetValue} ${g.unit || ''} (${g.progressPercent})`
        )
        .join('\n')
    : '- No explicit Job Hunt goals configured yet. Define a weekly application and outreach target to track variance.'
}
`;
}

// ============================================================================
// AGENCY AI FACTS
// ============================================================================

export interface AgencyAiFacts {
  timestamp: string;
  pillar: 'agency';
  status: {
    verdict: string;
    score: number;
    headline: string;
    reason: string;
  };
  financials: {
    realizedCash: string;
    billedRevenue: string;
    accountsReceivable: string;
    totalPipelineValue: string;
    effectiveHourlyRate: string;
  };
  salesFunnel: {
    totalLeads: number;
    activeLeads: number;
    qualifiedLeads: number;
    proposalStage: number;
    wonClients: number;
    lostLeads: number;
    leadToWonRate: string;
    leadsThisWeek: number;
    proposalsThisWeek: number;
  };
  clientRoster: Array<{
    name: string;
    status: string;
    lifetimeRevenue: string;
    billingType?: string;
  }>;
  receivables: Array<{
    invoiceNumber: string;
    client: string;
    amount: string;
    status: string;
    dueDate: string;
  }>;
  focusTime: {
    todayFormatted: string;
    thisWeekFormatted: string;
    totalFormatted: string;
    categoryBreakdown: Record<string, string>;
  };
  maturity: {
    tier: string;
    label: string;
    score: number;
  };
  activeGoals: Array<{
    title: string;
    cadence: string;
    targetValue: number;
    currentValue: number;
    unit?: string;
    progressPercent: string;
  }>;
}

/**
 * Deterministically assemble Agency facts.
 */
export async function buildAgencyAiFacts(): Promise<AgencyAiFacts> {
  const [kpis, allGoals, clients, leads, invoices] = await Promise.all([
    loadAgencyKpiSummary(),
    dbGetAll<Goal>(STORES.GOALS),
    dbGetAll<AgencyClient>(STORES.AGENCY_CLIENTS),
    dbGetAll<AgencyLead>(STORES.AGENCY_LEADS),
    dbGetAll<AgencyInvoice>(STORES.AGENCY_INVOICES),
  ]);

  const agencyGoals = allGoals.filter(g => g.pillarId === 'agency' && g.isActive);
  const statusEval = evaluateAgencyStatus(kpis, agencyGoals);

  // Focus category breakdown
  const categoryBreakdown: Record<string, string> = {};
  for (const [cat, secs] of Object.entries(kpis.focusTimeByCategory)) {
    categoryBreakdown[cat] = formatDuration(secs);
  }

  // Recent clients
  const sortedClients = [...clients].sort((a, b) =>
    (b.updatedAt || b.startDate).localeCompare(a.updatedAt || a.startDate)
  ).slice(0, 8);

  // Outstanding invoices
  const outstandingInvoices = invoices
    .filter(inv => inv.status === 'SENT' || inv.status === 'OVERDUE')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5);

  return {
    timestamp: new Date().toISOString(),
    pillar: 'agency',
    status: {
      verdict: statusEval.verdict,
      score: statusEval.score,
      headline: statusEval.headline,
      reason: statusEval.reason,
    },
    financials: {
      realizedCash: formatINR(kpis.realizedCash),
      billedRevenue: formatINR(kpis.billedRevenue),
      accountsReceivable: formatINR(kpis.accountsReceivable),
      totalPipelineValue: formatINR(kpis.totalPipelineValue),
      effectiveHourlyRate: kpis.effectiveHourlyRate !== null ? formatINR(kpis.effectiveHourlyRate) : '—',
    },
    salesFunnel: {
      totalLeads: kpis.totalLeads,
      activeLeads: kpis.activeLeads,
      qualifiedLeads: kpis.qualifiedLeads,
      proposalStage: kpis.proposalLeads,
      wonClients: kpis.wonLeads,
      lostLeads: kpis.lostLeads,
      leadToWonRate: formatSafePercent(kpis.overallLeadToWonRate),
      leadsThisWeek: kpis.leadsThisWeek,
      proposalsThisWeek: kpis.proposalsThisWeek,
    },
    clientRoster: sortedClients.map(c => ({
      name: c.name,
      status: c.status,
      lifetimeRevenue: formatINR(c.lifetimeRevenue),
      billingType: c.billingType,
    })),
    receivables: outstandingInvoices.map(inv => ({
      invoiceNumber: inv.invoiceNumber,
      client: clients.find(c => c.id === inv.clientId)?.name || 'Unknown',
      amount: formatINR(inv.amount),
      status: inv.status,
      dueDate: inv.dueDate,
    })),
    focusTime: {
      todayFormatted: formatDuration(kpis.focusTimeTodaySeconds),
      thisWeekFormatted: formatDuration(kpis.focusTimeThisWeekSeconds),
      totalFormatted: formatDuration(kpis.focusTimeTotalSeconds),
      categoryBreakdown,
    },
    maturity: {
      tier: kpis.maturity.tier,
      label: kpis.maturity.label,
      score: kpis.maturity.score,
    },
    activeGoals: agencyGoals.map(g => {
      const pct = g.targetValue > 0 ? (g.currentComputedValue / g.targetValue) * 100 : 0;
      return {
        title: g.title,
        cadence: g.cadence,
        targetValue: g.targetValue,
        currentValue: g.currentComputedValue,
        unit: g.unit,
        progressPercent: `${Math.round(pct)}%`,
      };
    }),
  };
}

/**
 * Generate an offline deterministic Agency strategic audit.
 */
export function generateOfflineAgencyAudit(facts: AgencyAiFacts): string {
  const { status, financials, salesFunnel, focusTime, activeGoals, receivables, maturity } = facts;

  let advice = '';

  // Uncollected cash warning
  if (receivables.length > 0) {
    advice += `- **Cash Collection Alert**: You have ${receivables.length} outstanding invoice(s) totaling ${financials.accountsReceivable}. Follow up on overdue payments immediately. Cash in bank is what matters, not billed revenue.\n`;
  }

  // Sales drought
  if (salesFunnel.leadsThisWeek === 0 && salesFunnel.activeLeads < 3) {
    advice += `- **Pipeline Starvation**: Zero new leads generated this week and only ${salesFunnel.activeLeads} active in pipeline. Without consistent top-of-funnel activity, revenue will dry up in 30-60 days. Allocate focused time blocks to outreach and lead generation.\n`;
  }

  // Delivery vs Sales imbalance
  const clientWorkHours = facts.focusTime.categoryBreakdown['Client Work'] || '0m 00s';
  const outreachHours = facts.focusTime.categoryBreakdown['Outreach'] || '0m 00s';
  const salesHours = facts.focusTime.categoryBreakdown['Sales'] || '0m 00s';
  if (clientWorkHours !== '0m 00s' && outreachHours === '0m 00s' && salesHours === '0m 00s') {
    advice += `- **Delivery Trap**: All tracked focus time is on Client Work with zero time on Outreach or Sales. You are 100% executing and 0% building your next month's pipeline. This is the most common freelancer failure mode.\n`;
  }

  // Proposal conversion bottleneck
  if (salesFunnel.proposalStage > 2 && salesFunnel.wonClients === 0) {
    advice += `- **Proposal Conversion Bottleneck**: ${salesFunnel.proposalStage} leads are at Proposal/Negotiation stage but 0 have converted. Review your pricing, proposal format, and follow-up cadence.\n`;
  }

  // Low conversion rate
  if (salesFunnel.totalLeads > 5 && salesFunnel.wonClients === 0) {
    advice += `- **Zero Wins Despite Pipeline**: ${salesFunnel.totalLeads} total leads tracked but no client conversions. Evaluate whether you're targeting the right ICP, and whether your outreach messaging addresses specific pain points.\n`;
  }

  if (!advice) {
    advice = '- **Execution Steady**: Pipeline, cash collection, and delivery balance look aligned. Continue maintaining outreach cadence.\n';
  }

  return `### Agency Pillar — Strategic Business Audit

**Verdict**: **${status.verdict}** (Health Score: ${status.score}/100)  
*${status.headline}* — ${status.reason}

#### 1. Financial Reality (Deterministic)
- **Realized Cash (In Bank)**: ${financials.realizedCash}
- **Billed Revenue**: ${financials.billedRevenue}
- **Accounts Receivable**: ${financials.accountsReceivable}
- **Pipeline Value**: ${financials.totalPipelineValue}
- **Effective Hourly Rate**: ${financials.effectiveHourlyRate}/hr

#### 2. Sales Pipeline
- **Active Leads**: ${salesFunnel.activeLeads} (${salesFunnel.leadsThisWeek} new this week)
- **Proposals In Progress**: ${salesFunnel.proposalStage}
- **Won Clients**: ${salesFunnel.wonClients}
- **Lead → Won Rate**: ${salesFunnel.leadToWonRate}

#### 3. Agency Maturity: ${maturity.label} (Score: ${maturity.score}/100)

#### 4. Focus Investment
- This Week: ${focusTime.thisWeekFormatted} | Today: ${focusTime.todayFormatted}

#### 5. Strategic Insights & Next Actions
${advice}
#### 6. Goal Alignment
${
  activeGoals.length > 0
    ? activeGoals
        .map(g => `- **${g.title}** (${g.cadence}): ${g.currentValue} / ${g.targetValue} ${g.unit || ''} (${g.progressPercent})`)
        .join('\n')
    : '- No explicit Agency goals configured yet. Define monthly revenue and weekly lead targets.'
}
`;
}

// ============================================================================
// SAAS AI FACTS
// ============================================================================

export interface SaasAiFacts {
  timestamp: string;
  pillar: 'trading_os';
  status: {
    verdict: string;
    score: number;
    headline: string;
    reason: string;
  };
  product: {
    totalFeatures: number;
    inProgress: number;
    completed: number;
    blocked: number;
    completionRate: string;
    testPassRate: string;
    totalReleases: number;
    latestReleaseVersion: string;
    developmentFocusFormatted: string;
    testingFocusFormatted: string;
  };
  distribution: {
    totalActivities: number;
    activitiesThisWeek: number;
    channelBreakdown: Record<string, number>;
    distributionFocusFormatted: string;
  };
  business: {
    totalUsers: number;
    activeUsers: number;
    payingUsers: number;
    payingConversionRate: string;
    recurringRevenueFormatted: string;
    revenueFormatted: string;
  };
  balance: {
    buildRatio: string;
    distributionRatio: string;
    observedMeasurement: string;
  };
  feedback: {
    totalFeedback: number;
    openCount: number;
    criticalOrHighCount: number;
    topIssues: Array<{
      content: string;
      severity: string;
      status: string;
      relatedFeature?: string;
    }>;
  };
  focusTime: {
    todayFormatted: string;
    thisWeekFormatted: string;
    totalFormatted: string;
    categoryBreakdown: Record<string, string>;
  };
  activeGoals: Array<{
    title: string;
    cadence: string;
    targetValue: number;
    currentValue: number;
    unit?: string;
    progressPercent: string;
  }>;
}

/**
 * Deterministically assemble SaaS facts from verified IndexedDB state.
 */
export async function buildSaasAiFacts(): Promise<SaasAiFacts> {
  const [kpis, allGoals, features, feedback] = await Promise.all([
    loadSaasKpiSummary(),
    dbGetAll<Goal>(STORES.GOALS),
    dbGetAll<SaasFeature>(STORES.SAAS_FEATURES),
    dbGetAll<SaasFeedback>(STORES.SAAS_FEEDBACK),
  ]);

  const saasGoals = allGoals.filter(
    (g) => g.pillarId === 'trading_os' && g.isActive
  );
  const statusEval = evaluateSaasStatus(kpis, saasGoals);

  // Focus breakdown
  const categoryBreakdown: Record<string, string> = {};
  for (const [cat, secs] of Object.entries(kpis.focusTimeByCategory)) {
    categoryBreakdown[cat] = formatDuration(secs);
  }

  // Channel breakdown
  const channelBreakdown: Record<string, number> = {};
  for (const [ch, cnt] of Object.entries(kpis.distributionByChannel)) {
    if (cnt > 0) channelBreakdown[ch] = cnt;
  }

  // Top open feedback issues
  const openIssues = feedback
    .filter((fb) => fb.status !== 'RESOLVED')
    .sort((a, b) => {
      const sevOrder: Record<string, number> = {
        CRITICAL: 4,
        HIGH: 3,
        MEDIUM: 2,
        LOW: 1,
      };
      return (sevOrder[b.severity] || 0) - (sevOrder[a.severity] || 0);
    })
    .slice(0, 5)
    .map((fb) => {
      const featName = features.find((f) => f.id === fb.relatedFeatureId)?.name;
      return {
        content: fb.content,
        severity: fb.severity,
        status: fb.status,
        relatedFeature: featName,
      };
    });

  return {
    timestamp: new Date().toISOString(),
    pillar: 'trading_os',
    status: {
      verdict: statusEval.verdict,
      score: statusEval.score,
      headline: statusEval.headline,
      reason: statusEval.reason,
    },
    product: {
      totalFeatures: kpis.totalFeatures,
      inProgress: kpis.featuresInProgress,
      completed: kpis.featuresDone,
      blocked: kpis.featuresBlocked,
      completionRate: formatSafePercent(kpis.featureCompletionRate),
      testPassRate: formatSafePercent(kpis.testPassRate),
      totalReleases: kpis.totalReleases,
      latestReleaseVersion: kpis.latestRelease ? kpis.latestRelease.version : 'None',
      developmentFocusFormatted: formatDuration(kpis.developmentFocusSeconds),
      testingFocusFormatted: formatDuration(kpis.testingFocusSeconds),
    },
    distribution: {
      totalActivities: kpis.totalDistributionActivities,
      activitiesThisWeek: kpis.distributionThisWeek,
      channelBreakdown,
      distributionFocusFormatted: formatDuration(kpis.distributionFocusSeconds),
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
      totalFeedback: kpis.totalFeedback,
      openCount: kpis.openFeedback,
      criticalOrHighCount: kpis.criticalOrHighFeedback,
      topIssues: openIssues,
    },
    focusTime: {
      todayFormatted: formatDuration(kpis.focusTimeTodaySeconds),
      thisWeekFormatted: formatDuration(kpis.focusTimeThisWeekSeconds),
      totalFormatted: formatDuration(kpis.focusTimeTotalSeconds),
      categoryBreakdown,
    },
    activeGoals: saasGoals.map((g) => {
      const pct =
        g.targetValue > 0 ? (g.currentComputedValue / g.targetValue) * 100 : 0;
      return {
        title: g.title,
        cadence: g.cadence,
        targetValue: g.targetValue,
        currentValue: g.currentComputedValue,
        unit: g.unit,
        progressPercent: `${Math.round(pct)}%`,
      };
    }),
  };
}

/**
 * Generate an offline deterministic SaaS strategic audit.
 * Explains and interprets the gap without inventing numbers.
 */
export function generateOfflineSaasAudit(facts: SaasAiFacts): string {
  const {
    status,
    product,
    distribution,
    business,
    balance,
    feedback,
    focusTime,
    activeGoals,
  } = facts;

  let advice = '';

  // 1. Build vs Distribution analysis
  if (product.totalFeatures > 0 && distribution.totalActivities === 0) {
    advice += `- **Distribution Starvation**: You have created ${product.totalFeatures} feature(s) but 0 distribution activities. Building without distribution creates an echo chamber. Allocate dedicated distribution blocks (LinkedIn, community, direct outreach) every week.\n`;
  } else if (distribution.totalActivities > 5 && product.completed === 0 && product.inProgress === 0) {
    advice += `- **Distribution Without Delivery**: You have logged ${distribution.totalActivities} distribution activities but have 0 features in progress or completed. Ensure your product delivers the value you are marketing.\n`;
  }

  // 2. Testing pass rate / quality
  if (product.testPassRate !== '—' && product.testPassRate !== '100.0%') {
    advice += `- **Quality & Test Stability**: Test pass rate is ${product.testPassRate}. Resolve failing test suites before shipping new releases to prevent customer churn.\n`;
  }

  // 3. Critical feedback
  if (feedback.criticalOrHighCount > 0) {
    advice += `- **High-Severity Feedback Alert**: You have ${feedback.criticalOrHighCount} critical or high-severity user issue(s) unresolved. Triage these bugs before working on new feature backlogs.\n`;
  }

  // 4. Conversion & Monetization
  if (business.totalUsers > 10 && business.payingUsers === 0) {
    advice += `- **Zero Paying Conversion**: You have ${business.totalUsers} users but 0 paying customers (0.0% conversion). Re-evaluate value proposition, gating, or activation milestones to drive initial conversions.\n`;
  } else if (business.payingUsers > 0) {
    advice += `- **Monetization Active**: ${business.payingUsers} paying user(s) generating ${business.recurringRevenueFormatted} recurring revenue. Focus on retention and reducing user churn.\n`;
  }

  // 5. Release Cadence
  if (product.totalReleases === 0 && product.completed >= 3) {
    advice += `- **Unreleased Value**: You have completed ${product.completed} features but have not published a release yet. Package these features into a semver release and announce it to your users.\n`;
  }

  if (!advice) {
    advice = '- **Execution Steady**: Product build velocity and distribution activities are functioning. Continue executing weekly release and distribution cycles.\n';
  }

  return `### Trading OS → SaaS — Strategic Product & Business Audit

**Verdict**: **${status.verdict}** (Health Score: ${status.score}/100)  
*${status.headline}* — ${status.reason}

#### 1. Core Reality (Deterministic Metrics)
- **Product Delivery**: ${product.completed} completed, ${product.inProgress} in dev, ${product.blocked} blocked (Completion Rate: ${product.completionRate})
- **Testing & Quality**: Pass Rate: ${product.testPassRate} | Published Releases: ${product.totalReleases} (Latest: ${product.latestReleaseVersion})
- **Distribution Footprint**: ${distribution.totalActivities} total activities (${distribution.activitiesThisWeek} this week)
- **User Traction**: ${business.totalUsers} total users (${business.activeUsers} active, ${business.payingUsers} paying)
- **Monetization**: ${business.recurringRevenueFormatted} MRR (${business.revenueFormatted} total revenue, ${business.payingConversionRate} paying conversion)
- **Observed Effort Balance**: ${balance.observedMeasurement} (Build Effort vs Distribution Effort)

#### 2. Strategic Bottleneck & Next Actions
${advice}
#### 3. Goal Alignment
${
  activeGoals.length > 0
    ? activeGoals
        .map(
          (g) =>
            `- **${g.title}** (${g.cadence}): ${g.currentValue} / ${g.targetValue} ${g.unit || ''} (${g.progressPercent})`
        )
        .join('\n')
    : '- No explicit SaaS goals configured yet. Select optional templates in the Goals tab to track variance.'
}
`;
}

// ============================================================================
// PILLAR 4: FOREX LEARNING AI CONTEXT
// ============================================================================

export interface ForexAiFacts {
  timestamp: string;
  pillar: 'forex';
  status: {
    verdict: string;
    score: number;
    headline: string;
    reason: string;
  };
  study: {
    totalHoursFormatted: string;
    totalSessions: number;
    sessionsThisWeek: number;
    minutesThisWeek: number;
    phaseBreakdown: Record<string, number>;
  };
  setups: {
    total: number;
    validated: number;
    inTesting: number;
    inPaperTrading: number;
    draft: number;
    rejected: number;
  };
  backtesting: {
    totalBatches: number;
    totalSampleTrades: number;
    weightedWinRate: string;
    averageRecordedExpectancy: string;
    ruleAdherenceRate: string;
    violationsCount: number;
  };
  paperTrading: {
    totalTrades: number;
    tradesThisWeek: number;
    winRate: string;
    averageR: string;
    totalR: string;
    openTrades: number;
  };
  discipline: {
    ruleAdherenceRate: string;
    cleanStreak: number;
    totalMistakes: number;
    severeMistakes: number;
    fomoCount: number;
    revengeCount: number;
    topMistakes: Array<{ mistake: string; count: number; percentage: string }>;
  };
  focusTime: {
    todayFormatted: string;
    thisWeekFormatted: string;
    totalFormatted: string;
  };
  activeGoals: Array<{
    title: string;
    cadence: string;
    targetValue: number;
    currentValue: number;
    unit?: string;
    progressPercent: string;
  }>;
}

/**
 * Builds deterministic facts packet for Pillar 4: Forex Learning.
 */
export async function buildForexAiFacts(): Promise<ForexAiFacts> {
  const [kpis, allGoals] = await Promise.all([
    loadForexKpiSummary(),
    dbGetAll<Goal>(STORES.GOALS),
  ]);

  const activeGoals = allGoals.filter((g) => g.pillarId === 'forex' && g.isActive);
  const statusEval = evaluateForexStatus(kpis, activeGoals);

  return {
    timestamp: new Date().toISOString(),
    pillar: 'forex',
    status: {
      verdict: statusEval.verdict,
      score: statusEval.score,
      headline: statusEval.headline,
      reason: statusEval.reason,
    },
    study: {
      totalHoursFormatted: kpis.totalStudyHoursFormatted,
      totalSessions: kpis.totalStudySessions,
      sessionsThisWeek: kpis.studySessionsThisWeek,
      minutesThisWeek: kpis.studyMinutesThisWeek,
      phaseBreakdown: kpis.sessionsByPhase,
    },
    setups: {
      total: kpis.totalSetups,
      validated: kpis.setupsValidated,
      inTesting: kpis.setupsBacktesting,
      inPaperTrading: kpis.setupsPaperTrading,
      draft: kpis.setupsDraft,
      rejected: kpis.setupsRejected,
    },
    backtesting: {
      totalBatches: kpis.totalBacktestBatches,
      totalSampleTrades: kpis.totalBacktestedTrades,
      weightedWinRate: formatSafePercent(kpis.weightedBacktestWinRate),
      averageRecordedExpectancy:
        kpis.averageRecordedExpectancyR !== null
          ? `${kpis.averageRecordedExpectancyR > 0 ? '+' : ''}${kpis.averageRecordedExpectancyR}R (recorded)`
          : '—',
      ruleAdherenceRate: formatSafePercent(kpis.backtestRuleAdherenceRate),
      violationsCount: kpis.totalBacktestRuleViolations,
    },
    paperTrading: {
      totalTrades: kpis.totalPaperTrades,
      tradesThisWeek: kpis.tradesThisWeek,
      winRate: formatSafePercent(kpis.paperWinRate),
      averageR:
        kpis.averageRMultiple !== null
          ? `${kpis.averageRMultiple > 0 ? '+' : ''}${kpis.averageRMultiple}R`
          : '—',
      totalR: `${kpis.totalRRealized > 0 ? '+' : ''}${kpis.totalRRealized}R`,
      openTrades: kpis.tradesOpen,
    },
    discipline: {
      ruleAdherenceRate: formatSafePercent(kpis.ruleAdherenceRate),
      cleanStreak: kpis.cleanTradeStreak,
      totalMistakes: kpis.totalMistakesRecorded,
      severeMistakes: kpis.severeMistakeCount,
      fomoCount: kpis.fomoCount,
      revengeCount: kpis.revengeCount,
      topMistakes: kpis.topMistakes.map((m) => ({
        mistake: m.mistake,
        count: m.count,
        percentage: `${m.percentage}%`,
      })),
    },
    focusTime: {
      todayFormatted: formatDuration(kpis.focusTimeTodaySeconds),
      thisWeekFormatted: formatDuration(kpis.focusTimeThisWeekSeconds),
      totalFormatted: formatDuration(kpis.focusTimeTotalSeconds),
    },
    activeGoals: activeGoals.map((g) => {
      const target = g.targetValue || 1;
      const current = g.currentComputedValue || 0;
      return {
        title: g.title,
        cadence: g.cadence,
        targetValue: g.targetValue,
        currentValue: current,
        unit: g.unit,
        progressPercent: `${Math.round((current / target) * 100)}%`,
      };
    }),
  };
}

/**
 * Deterministic offline AI audit for Forex Learning.
 * Evaluates the core learning loop:
 * Study → Understanding → Setup Development → Backtesting → Paper Trading → Review → Discipline
 * Code calculates. AI judges and explains.
 */
export function generateOfflineForexAudit(facts: ForexAiFacts): string {
  const { status, study, setups, backtesting, paperTrading, discipline, activeGoals } = facts;

  let advice = '';

  // 1. Discipline & Emotional Leaks (Primary Focus)
  if (discipline.fomoCount + discipline.revengeCount >= 2) {
    advice += `- **Critical Discipline Breach (>= 2 severe mistakes)**: ${discipline.fomoCount} FOMO and ${discipline.revengeCount} Revenge trades detected. Emotional trades negate technical edge. Enforce a mandatory 30-minute cooling-off window after any loss before re-engaging charts.\n`;
  } else if (discipline.severeMistakes > 0) {
    advice += `- **Emotional Mistake Alert**: ${discipline.severeMistakes} severe mistake(s) logged (${discipline.topMistakes.map((m) => `${m.mistake}: ${m.count}`).join(', ')}). Review entry triggers in your trading rules before placing paper trades.\n`;
  }

  // 2. Rule Adherence
  if (discipline.ruleAdherenceRate !== '—' && discipline.ruleAdherenceRate !== '100.0%') {
    const rateNum = parseFloat(discipline.ruleAdherenceRate);
    if (!isNaN(rateNum) && rateNum < 70) {
      advice += `- **Process Breakdown**: Process adherence is currently ${discipline.ruleAdherenceRate} (below the 70% threshold). In trading, process discipline precedes profitability. Focus exclusively on executing setups 100% to plan regardless of trade outcome.\n`;
    }
  }

  // 3. Statistical Sample Sizing
  if (paperTrading.totalTrades >= 5 && backtesting.totalSampleTrades < 20) {
    advice += `- **Backtesting Sample Deficit**: You have logged ${paperTrading.totalTrades} paper trades but only ${backtesting.totalSampleTrades} backtested trades. A minimum of 20-50 historical sample trades is needed to verify setup expectancy before trusting execution in paper trading.\n`;
  }

  // 4. Setup Progression
  if (setups.total === 0) {
    advice += `- **No Documented Setup**: Define at least one explicit trading setup with entry, stop-loss, and take-profit rules in the Setups tab to anchor your backtesting.\n`;
  } else if (setups.validated === 0 && setups.inTesting > 0 && backtesting.totalSampleTrades >= 50) {
    advice += `- **Candidate for Validation**: You have ${backtesting.totalSampleTrades} backtested trades. If win rate and expectancy criteria are satisfied, promote the strategy to VALIDATED.\n`;
  }

  // 5. Study Volume
  if (study.totalSessions === 0) {
    advice += `- **Curriculum Inactivity**: Log study sessions covering Market Structure, Liquidity, or Risk Management to ground your trade mechanics in theory.\n`;
  }

  if (!advice) {
    advice =
      '- **Consistent Process Execution**: Steady study pace, documented setups, and disciplined paper trading. Maintain strict adherence to entry criteria and risk management parameters.\n';
  }

  return `### Forex Learning — Strategic Skill & Discipline Audit

**Verdict**: **${status.verdict}** (Health Score: ${status.score}/100)  
*${status.headline}* — ${status.reason}

#### 1. Core Reality (Deterministic Metrics)
- **Study & Curriculum**: ${study.totalHoursFormatted} studied across ${study.totalSessions} sessions (${study.sessionsThisWeek} this week)
- **Strategy & Setups**: ${setups.total} total (${setups.validated} validated, ${setups.inTesting} in testing, ${setups.inPaperTrading} in paper trading)
- **Backtesting Rigor**: ${backtesting.totalSampleTrades} historical sample trades across ${backtesting.totalBatches} batches (Win Rate: ${backtesting.weightedWinRate} | Avg Expectancy: ${backtesting.averageRecordedExpectancy})
- **Paper Execution**: ${paperTrading.totalTrades} paper trades (${paperTrading.winRate} win rate, Avg: ${paperTrading.averageR}, Total: ${paperTrading.totalR})
- **Process Discipline (Primary KPI)**: ${discipline.ruleAdherenceRate} rule adherence | Clean Streak: ${discipline.cleanStreak} trades | Severe Mistakes: ${discipline.severeMistakes}

#### 2. Strategic Insights & Discipline Gaps
${advice}
#### 3. Goal Alignment
${
  activeGoals.length > 0
    ? activeGoals
        .map(
          (g) =>
            `- **${g.title}** (${g.cadence}): ${g.currentValue} / ${g.targetValue} ${g.unit || ''} (${g.progressPercent})`
        )
        .join('\n')
    : '- No explicit Forex goals configured yet. Select optional templates in the Goals tab to track variance.'
}
`;
}

// ============================================================================
// PILLAR 5: FITNESS AI FACTS & AUDIT
// Strictly non-medical habit & consistency analysis.
// ============================================================================

export interface FitnessAiFacts {
  timestamp: string;
  pillar: 'fitness';
  status: {
    verdict: string;
    score: number;
    headline: string;
    reason: string;
  };
  durations: {
    gymDurationMinutes: number;
    runningDurationMinutes: number;
    footballDurationMinutes: number;
    mobilityDurationMinutes: number;
    cognitiveDurationMinutes: number;
    totalActiveMinutes: number;
  };
  workouts: {
    count: number;
    thisWeek: number;
    benchPressMaxKg: number;
    benchPressMaxPerSideKg: number;
    benchPressBarWeightKg: number | null;
  };
  running: {
    totalDistanceKm: number;
    distanceThisWeekKm: number;
    fiveKmRunsCount: number;
    fiveKmRunsThisWeek: number;
    avgPaceMinKm: string;
  };
  football: {
    totalSessions: number;
    sessionsThisWeek: number;
  };
  nutrition: {
    daysWithMealsLogged: number;
    avgDailyCaloriesWeek: string;
    avgDailyProteinWeek: string;
    todayCalories: number;
    todayProteinG: number;
    supplementsTakenToday: number;
    totalSupplementsTracked: number;
  };
  recoveryAndBio: {
    latestWeightKg: string;
    weightDeltaMonthKg: string;
    avgSleepHoursWeek: string;
    avgSleepQualityWeek: string;
    sleepDeficitFlag: boolean;
  };
  cognitive: {
    chessSudokuMinutesWeek: number;
  };
  adherence: {
    fitnessAdherenceScore: number;
    breakdown: {
      trainingConsistency: number;
      cardioAndSports: number;
      recoveryAndSleep: number;
      nutritionAndHabits: number;
    };
  };
  activeGoals: Array<{
    title: string;
    cadence: string;
    currentValue: number;
    targetValue: number;
    unit?: string;
    progressPercent: string;
  }>;
}

/**
 * Builds structured, verifiable Fitness AI facts strictly from deterministic KPIs and goals.
 */
export async function buildFitnessAiFacts(): Promise<FitnessAiFacts> {
  const [kpis, allGoals] = await Promise.all([
    loadFitnessKpiSummary(),
    dbGetAll<Goal>(STORES.GOALS),
  ]);

  const activeGoals = allGoals.filter((g) => g.pillarId === 'fitness');
  const status = evaluateFitnessStatus(kpis, activeGoals);

  return {
    timestamp: new Date().toISOString(),
    pillar: 'fitness',
    status: {
      verdict: status.verdict,
      score: status.score,
      headline: status.headline,
      reason: status.reason,
    },
    durations: {
      gymDurationMinutes: kpis.gymDurationMinutes,
      runningDurationMinutes: kpis.runningDurationMinutes,
      footballDurationMinutes: kpis.footballDurationMinutes,
      mobilityDurationMinutes: kpis.mobilityDurationMinutes,
      cognitiveDurationMinutes: kpis.cognitiveDurationMinutes,
      totalActiveMinutes: kpis.totalActiveMinutes,
    },
    workouts: {
      count: kpis.workoutsCount,
      thisWeek: kpis.workoutsThisWeek,
      benchPressMaxKg: kpis.benchPressMaxKg,
      benchPressMaxPerSideKg: kpis.benchPressMaxPerSideKg,
      benchPressBarWeightKg: kpis.benchPressBarWeightKg,
    },
    running: {
      totalDistanceKm: kpis.totalDistanceKm,
      distanceThisWeekKm: kpis.distanceThisWeekKm,
      fiveKmRunsCount: kpis.fiveKmRunsCount,
      fiveKmRunsThisWeek: kpis.fiveKmRunsThisWeek,
      avgPaceMinKm: kpis.avgPaceMinKm !== null ? `${kpis.avgPaceMinKm} min/km` : '—',
    },
    football: {
      totalSessions: kpis.footballSessionsCount,
      sessionsThisWeek: kpis.footballSessionsThisWeek,
    },
    nutrition: {
      daysWithMealsLogged: kpis.daysWithMealsLogged,
      avgDailyCaloriesWeek: kpis.avgDailyCaloriesWeek !== null ? `${kpis.avgDailyCaloriesWeek} kcal` : '—',
      avgDailyProteinWeek: kpis.avgDailyProteinWeek !== null ? `${kpis.avgDailyProteinWeek} g` : '—',
      todayCalories: kpis.todayCalories,
      todayProteinG: kpis.todayProteinG,
      supplementsTakenToday: kpis.supplementsTakenToday,
      totalSupplementsTracked: kpis.totalSupplementsTracked,
    },
    recoveryAndBio: {
      latestWeightKg: kpis.latestWeightKg !== null ? `${kpis.latestWeightKg} kg` : '—',
      weightDeltaMonthKg: kpis.weightDeltaMonthKg !== null ? `${kpis.weightDeltaMonthKg > 0 ? '+' : ''}${kpis.weightDeltaMonthKg} kg` : '—',
      avgSleepHoursWeek: kpis.avgSleepHoursWeek !== null ? `${kpis.avgSleepHoursWeek} h` : '—',
      avgSleepQualityWeek: kpis.avgSleepQualityWeek !== null ? `${kpis.avgSleepQualityWeek}/10` : '—',
      sleepDeficitFlag: kpis.sleepDeficitFlag,
    },
    cognitive: {
      chessSudokuMinutesWeek: kpis.chessSudokuMinutesWeek,
    },
    adherence: {
      fitnessAdherenceScore: kpis.fitnessAdherenceScore,
      breakdown: kpis.adherenceScoreBreakdown,
    },
    activeGoals: activeGoals.map((g) => ({
      title: g.title,
      cadence: g.cadence,
      currentValue: g.currentValue ?? 0,
      targetValue: g.targetValue || 1,
      unit: g.unit,
      progressPercent: `${Math.round(((g.currentValue ?? 0) / (g.targetValue || 1)) * 100)}%`,
    })),
  };
}

/**
 * Deterministic offline AI audit for Fitness / Health.
 * Evaluates recorded habit adherence, routines, and training variance without clinical or medical speculation.
 */
export function generateOfflineFitnessAudit(facts: FitnessAiFacts): string {
  const { status, durations, workouts, running, football, nutrition, recoveryAndBio, adherence, activeGoals } = facts;

  let advice = '';

  // 1. Sleep & Recovery (Safety first)
  if (recoveryAndBio.sleepDeficitFlag) {
    advice += `- **Critical Recovery Deficit**: Average sleep is ${recoveryAndBio.avgSleepHoursWeek} (below 6.0h). Adequate rest is required for muscular repair and cognitive function. Prioritize sleep hygiene over intense training sessions until recovery stabilizes.\n`;
  }

  // 2. Training Consistency
  if (workouts.thisWeek === 0 && durations.totalActiveMinutes === 0) {
    advice += `- **Physical Inactivity**: No workouts or physical sessions logged this week. Schedule a 30-45 minute workout or brisk run to reactivate habit momentum.\n`;
  } else if (workouts.thisWeek < 3) {
    advice += `- **Training Frequency**: ${workouts.thisWeek} workout session(s) this week. Increasing to 3-4 sessions per week optimizes progressive overload and adherence.\n`;
  }

  // 3. Bench Press Progress
  if (workouts.benchPressMaxPerSideKg > 0) {
    if (workouts.benchPressMaxPerSideKg >= 30) {
      advice += `- **Strength Milestone Achieved**: Bench press recorded at ${workouts.benchPressMaxPerSideKg} kg/side (${workouts.benchPressMaxKg} kg total load), meeting or exceeding the 30 kg/side milestone.\n`;
    } else {
      const gap = 30 - workouts.benchPressMaxPerSideKg;
      advice += `- **Bench Press Trajectory**: Current max is ${workouts.benchPressMaxPerSideKg} kg/side (${workouts.benchPressMaxKg} kg total load). Gap to 30 kg/side target is ${gap.toFixed(1)} kg/side.\n`;
    }
  }

  // 4. Cardio & Running
  if (running.fiveKmRunsCount > 0) {
    advice += `- **Running Baseline**: Completed ${running.fiveKmRunsCount} 5K run(s) all-time (${running.fiveKmRunsThisWeek} this week). Total weekly distance: ${running.distanceThisWeekKm} km.\n`;
  } else if (running.totalDistanceKm > 0) {
    advice += `- **Cardio Progress**: ${running.totalDistanceKm} km total logged. Build weekly volume toward the continuous 5.0 km mark.\n`;
  }

  // 5. Nutrition & Protein
  if (nutrition.daysWithMealsLogged === 0) {
    advice += `- **Nutrition Tracking**: No meals logged yet. Tracking meals provides visibility into daily protein and caloric support for training.\n`;
  } else if (nutrition.avgDailyProteinWeek !== '—') {
    const protNum = parseFloat(nutrition.avgDailyProteinWeek);
    if (!isNaN(protNum) && protNum < 120) {
      advice += `- **Protein Intake Variance**: Weekly average is ${nutrition.avgDailyProteinWeek} across logged days. Target 120-140g daily to adequately support recovery and hypertrophy.\n`;
    }
  }

  // 6. Weekend Football
  if (football.totalSessions > 0) {
    advice += `- **Sport & Agility**: ${football.totalSessions} football session(s) logged (${durations.footballDurationMinutes}m total). Football provides high-intensity anaerobic conditioning.\n`;
  }

  if (!advice) {
    advice = '- **Balanced Execution**: Workouts, running, nutrition, and recovery routines are consistently tracked and maintained.\n';
  }

  return `### Fitness & Health — Strategic Habit & Adherence Audit

> *Note: This audit evaluates recorded habit adherence and training consistency. It does not provide medical diagnosis, clinical evaluation, or treatment prescriptions.*

**Verdict**: **${status.verdict}** (Adherence Score: ${adherence.fitnessAdherenceScore}/100)  
*${status.headline}* — ${status.reason}

#### 1. Activity & Durations (Strictly Segregated)
- **Resistance / Gym Training**: ${durations.gymDurationMinutes} min across ${workouts.count} session(s) (${workouts.thisWeek} this week)
- **Running & Cardio**: ${durations.runningDurationMinutes} min (${running.totalDistanceKm} km total | ${running.distanceThisWeekKm} km this week | 5K Runs: ${running.fiveKmRunsCount})
- **Weekend Football**: ${durations.footballDurationMinutes} min across ${football.totalSessions} session(s)
- **Mobility & Walking**: ${durations.mobilityDurationMinutes} min
- **Cognitive Habit (Chess / Sudoku)**: ${durations.cognitiveDurationMinutes} min (segregated from physical training)
- **Total Physical Active Time**: ${durations.totalActiveMinutes} min

#### 2. Strength & Recovery Reality
- **Bench Press Peak**: ${workouts.benchPressMaxKg > 0 ? `${workouts.benchPressMaxKg} kg total` : 'Not logged'} ${workouts.benchPressMaxPerSideKg > 0 ? `(${workouts.benchPressMaxPerSideKg} kg/side${workouts.benchPressBarWeightKg !== null ? `, ${workouts.benchPressBarWeightKg}kg bar` : ''})` : ''}
- **Body Weight**: ${recoveryAndBio.latestWeightKg} (30d change: ${recoveryAndBio.weightDeltaMonthKg})
- **Sleep & Recovery**: ${recoveryAndBio.avgSleepHoursWeek} avg sleep (${recoveryAndBio.avgSleepQualityWeek} quality) | Deficit Alert: ${recoveryAndBio.sleepDeficitFlag ? 'ACTIVE' : 'Normal'}
- **Nutrition Trailing Averages**: ${nutrition.avgDailyCaloriesWeek} calories/day | ${nutrition.avgDailyProteinWeek} protein/day (${nutrition.daysWithMealsLogged} active logged days)

#### 3. Strategic Observations & Habit Gaps
${advice}
#### 4. Goal Alignment
${
  activeGoals.length > 0
    ? activeGoals
        .map(
          (g) =>
            `- **${g.title}** (${g.cadence}): ${g.currentValue} / ${g.targetValue} ${g.unit || ''} (${g.progressPercent})`
        )
        .join('\n')
    : '- No explicit Fitness goals configured yet. Select optional templates in the Goals tab to track variance.'
}
`;
}

// ============================================================================
// VOIRE (PILLAR 6) — AI FACT EXTRACTION & OFFLINE AUDIT
// ============================================================================

export interface VoireAiFacts {
  timestamp: string;
  pillar: 'voire';
  isWeekend: boolean;
  creativePauseExcused: boolean;
  status: {
    verdict: string;
    score: number;
    headline: string;
    reason: string;
  };
  creativeEngine: {
    totalDesigns: number;
    readyOrSampledDesigns: number;
    activeProducts: number;
    activeDrops: number;
  };
  financialReality: {
    grossSales: number;
    discounts: number;
    refunds: number;
    netSales: number;
    cogsProduction: number;
    cogsShipping: number;
    totalCogs: number;
    marketingSpend: number;
    otherExpenses: number;
    contributionProfit: number;
    contributionMarginPercent: string;
    cashReceived: number;
    accountsReceivablePending: number;
    aov: number;
    roas: number;
    cac: number;
    paidOrdersCount: number;
    pendingOrdersCount: number;
    refundCount: number;
  };
  marketing: {
    campaignsCount: number;
    totalImpressions: number;
    totalClicks: number;
    totalConversions: number;
    overallCtr: string;
    overallCvr: string;
    blendedRoas: number;
  };
  bottlenecks: string[];
  activeGoals: {
    title: string;
    cadence: string;
    currentValue: number;
    targetValue: number;
    unit?: string;
    progressPercent: string;
  }[];
}

export async function buildVoireAiFacts(): Promise<VoireAiFacts> {
  const kpis = await loadVoireKpiSummary();
  const allGoals = await dbGetAll<Goal>(STORES.GOALS);
  const activeGoals = allGoals.filter((g) => g.pillarId === 'voire' && g.status === 'ACTIVE');
  const status = evaluateVoireStatus(kpis, activeGoals);

  // Derive explicit operational bottlenecks
  const bottlenecks: string[] = [];
  if (kpis.totalDesigns > 0 && kpis.readyOrSampledDesigns === 0) {
    bottlenecks.push('Creative pipeline stalled: designs exist but none have completed sampling or reached production-ready status.');
  }
  if (kpis.activeDrops > 0 && kpis.activeProducts === 0) {
    bottlenecks.push('Drop execution bottleneck: live or planned drops exist without assigned active products.');
  }
  if (kpis.marketingSpend > 0 && kpis.paidOrdersCount === 0) {
    bottlenecks.push(`Customer acquisition leak: ₹${kpis.marketingSpend.toLocaleString('en-IN')} spent on marketing with 0 paid orders.`);
  }
  if (kpis.netSales > 0 && kpis.contributionProfit < 0) {
    bottlenecks.push(`Negative contribution profit: Net sales ₹${kpis.netSales.toLocaleString('en-IN')} is outpaced by COGS & marketing spend (Contribution: ₹${kpis.contributionProfit.toLocaleString('en-IN')}).`);
  }
  if (kpis.accountsReceivablePending > 0) {
    bottlenecks.push(`Uncollected cash: ₹${kpis.accountsReceivablePending.toLocaleString('en-IN')} in pending orders has not converted to cash received.`);
  }

  return {
    timestamp: new Date().toISOString(),
    pillar: 'voire',
    isWeekend: kpis.isWeekend,
    creativePauseExcused: kpis.creativePauseExcused,
    status: {
      verdict: status.verdict,
      score: status.score,
      headline: status.headline,
      reason: status.reason,
    },
    creativeEngine: {
      totalDesigns: kpis.totalDesigns,
      readyOrSampledDesigns: kpis.readyOrSampledDesigns,
      activeProducts: kpis.activeProducts,
      activeDrops: kpis.activeDrops,
    },
    financialReality: {
      grossSales: kpis.grossSales,
      discounts: kpis.discounts,
      refunds: kpis.refunds,
      netSales: kpis.netSales,
      cogsProduction: kpis.cogsProduction,
      cogsShipping: kpis.cogsShipping,
      totalCogs: kpis.totalCogs,
      marketingSpend: kpis.marketingSpend,
      otherExpenses: kpis.otherExpenses,
      contributionProfit: kpis.contributionProfit,
      contributionMarginPercent: formatSafePercent(kpis.contributionMarginPercent),
      cashReceived: kpis.cashReceived,
      accountsReceivablePending: kpis.accountsReceivablePending,
      aov: kpis.aov,
      roas: kpis.roas,
      cac: kpis.cac,
      paidOrdersCount: kpis.paidOrdersCount,
      pendingOrdersCount: kpis.pendingOrdersCount,
      refundCount: kpis.refundCount,
    },
    marketing: {
      campaignsCount: kpis.campaignsCount,
      totalImpressions: kpis.totalImpressions,
      totalClicks: kpis.totalClicks,
      totalConversions: kpis.totalConversions,
      overallCtr: formatSafePercent(kpis.overallCtr),
      overallCvr: formatSafePercent(kpis.overallCvr),
      blendedRoas: kpis.roas,
    },
    bottlenecks,
    activeGoals: activeGoals.map((g) => ({
      title: g.title,
      cadence: g.cadence,
      currentValue: g.currentValue ?? 0,
      targetValue: g.targetValue || 1,
      unit: g.unit,
      progressPercent: `${Math.round(((g.currentValue ?? 0) / (g.targetValue || 1)) * 100)}%`,
    })),
  };
}

/**
 * Deterministic offline AI audit for VOIRE (D2C / Print-on-Demand Brand).
 * Strictly interprets recorded commercial and creative reality without fabricating numbers.
 */
export function generateOfflineVoireAudit(facts: VoireAiFacts): string {
  const { status, creativeEngine, financialReality, marketing, bottlenecks, activeGoals, isWeekend, creativePauseExcused } = facts;

  let advice = '';

  // 1. Creative Cadence & Weekend Rule Assessment
  if (creativePauseExcused) {
    advice += `- **Creative Operating Rhythm**: Currently weekday pause. Creative sprint operates on weekend cadence; zero weekday design additions do not penalize momentum.\n`;
  } else if (isWeekend) {
    if (creativeEngine.totalDesigns === 0) {
      advice += `- **Weekend Creative Sprint Active**: It is the weekend, but 0 designs are logged. Prioritize ideation and mockup creation during this sprint.\n`;
    } else {
      advice += `- **Weekend Creative Cadence**: Active creative window. ${creativeEngine.totalDesigns} total design concept(s) recorded in studio.\n`;
    }
  }

  // 2. Supply Chain & Sampling Velocity
  if (creativeEngine.totalDesigns > 0 && creativeEngine.readyOrSampledDesigns === 0) {
    advice += `- **Sampling Pipeline Gap**: ${creativeEngine.totalDesigns} design(s) created, but 0 have completed sampling or sample review. Order physical samples or finalize tech packs before scheduling drops.\n`;
  } else if (creativeEngine.readyOrSampledDesigns > 0 && creativeEngine.activeProducts === 0) {
    advice += `- **Product Catalog Readiness**: ${creativeEngine.readyOrSampledDesigns} design(s) sampled, but 0 active products configured in catalog. Generate SKU mappings and unit economics.\n`;
  }

  // 3. Commercial Realization & Cash Conversion
  if (financialReality.paidOrdersCount === 0 && financialReality.marketingSpend > 0) {
    advice += `- **Acquisition Leak**: ₹${financialReality.marketingSpend.toLocaleString('en-IN')} committed to campaigns with 0 paid conversions. Pause underperforming ad sets and inspect product landing pages.\n`;
  } else if (financialReality.paidOrdersCount > 0) {
    if (financialReality.contributionProfit > 0) {
      advice += `- **Positive Unit Economics**: Brand is generating ₹${financialReality.contributionProfit.toLocaleString('en-IN')} contribution profit (${financialReality.contributionMarginPercent} margin) across ${financialReality.paidOrdersCount} paid order(s).\n`;
    } else {
      advice += `- **Contribution Profit Deficit**: Brand is operating at negative contribution profit (-₹${Math.abs(financialReality.contributionProfit).toLocaleString('en-IN')}). Review COGS production (₹${financialReality.cogsProduction.toLocaleString('en-IN')}) and marketing efficiency.\n`;
    }
  }

  // 4. Marketing ROAS & Conversion Health
  if (marketing.campaignsCount > 0) {
    if (financialReality.roas >= 2.5) {
      advice += `- **Strong Ad Efficiency**: Blended ROAS is ${financialReality.roas.toFixed(2)}x (exceeds 2.5x benchmark). Consider scaling budget on top-performing creative.\n`;
    } else if (financialReality.roas > 0) {
      advice += `- **Sub-Optimal ROAS**: Blended ROAS is ${financialReality.roas.toFixed(2)}x. Optimize creative hooks and click-to-purchase conversion (current CVR: ${marketing.overallCvr}).\n`;
    }
  }

  // 5. Receivables
  if (financialReality.accountsReceivablePending > 0) {
    advice += `- **Cash Flow Timing**: ₹${financialReality.accountsReceivablePending.toLocaleString('en-IN')} in pending orders awaiting settlement or payment fulfillment.\n`;
  }

  if (!advice) {
    advice = '- **System Steady**: Creative catalog, sampling pipeline, and unit economics are aligned with brand baseline.\n';
  }

  const bottlenecksList = bottlenecks.length > 0
    ? bottlenecks.map((b) => `- ⚠️ ${b}`).join('\n')
    : '- No critical operational bottlenecks detected.';

  return `### VOIRE — Brand Performance & Commercial Audit

> *Note: This audit evaluates recorded operational, creative, and financial reality. Financial metrics are deterministic sums of orders and ad spend.*

**Verdict**: **${status.verdict}** (Operational Score: ${status.score}/100)  
*${status.headline}* — ${status.reason}

#### 1. Creative Studio & Product Catalog
- **Design Concepts**: ${creativeEngine.totalDesigns} total (${creativeEngine.readyOrSampledDesigns} sampled/ready)
- **Active SKUs / Products**: ${creativeEngine.activeProducts} live in catalog
- **Drop Campaigns**: ${creativeEngine.activeDrops} drop(s) active or scheduled
- **Operating Mode**: ${isWeekend ? 'Weekend Creative Sprint (Active)' : 'Weekday Operations (Creative Pause Excused)'}

#### 2. Financial Reality & Cash Conversion
- **Gross Sales**: ${formatINR(financialReality.grossSales)} (Discounts: ${formatINR(financialReality.discounts)} | Refunds: ${formatINR(financialReality.refunds)})
- **Net Sales**: ${formatINR(financialReality.netSales)}
- **COGS (Historical Snapshot)**: ${formatINR(financialReality.totalCogs)} (Production: ${formatINR(financialReality.cogsProduction)} | Shipping: ${formatINR(financialReality.cogsShipping)})
- **Marketing Spend**: ${formatINR(financialReality.marketingSpend)} (Blended ROAS: ${financialReality.roas.toFixed(2)}x | CAC: ${financialReality.cac > 0 ? formatINR(financialReality.cac) : '—'})
- **Contribution Profit**: ${formatINR(financialReality.contributionProfit)} (${financialReality.contributionMarginPercent} Margin)
- **Cash in Bank vs AR**: ${formatINR(financialReality.cashReceived)} collected | ${formatINR(financialReality.accountsReceivablePending)} pending
- **Order Volume**: ${financialReality.paidOrdersCount} paid, ${financialReality.pendingOrdersCount} pending, ${financialReality.refundCount} refunded (AOV: ${formatINR(financialReality.aov)})

#### 3. Operational Bottlenecks
${bottlenecksList}

#### 4. Strategic Observations & Executive Directives
${advice}
#### 5. Goal Alignment
${
  activeGoals.length > 0
    ? activeGoals
        .map(
          (g) =>
            `- **${g.title}** (${g.cadence}): ${g.currentValue} / ${g.targetValue} ${g.unit || ''} (${g.progressPercent})`
        )
        .join('\n')
    : '- No explicit VOIRE goals configured yet. Select optional templates in the Goals tab to track variance.'
}
`;
}

