// ============================================================================
// PERSONAL OS — Agency KPI Engine
// Deterministic computation of all Agency business metrics.
// Pure calculation functions. No side effects. Fully testable.
// Financial architecture: Realized Cash | Billed Revenue | Accounts Receivable
// ============================================================================

import type {
  AgencyClient,
  AgencyProject,
  AgencyLead,
  AgencyInvoice,
  AgencyMaturitySnapshot,
  LeadStage,
  FocusSession,
  ActivityEvent,
  Goal,
} from '../types';
import { safePct, startOfToday, startOfWeeksAgo } from '../utils/helpers';
import { dbGetAll, dbPut, STORES } from './db';

// ============================================================================
// Lead Stage Groups
// ============================================================================
export const ACTIVE_LEAD_STAGES: Set<LeadStage> = new Set([
  'LEAD_FOUND', 'QUALIFIED', 'CONTACTED', 'REPLIED', 'CALL', 'PROPOSAL', 'NEGOTIATION',
]);

export const QUALIFIED_STAGES: Set<LeadStage> = new Set([
  'QUALIFIED', 'CONTACTED', 'REPLIED', 'CALL', 'PROPOSAL', 'NEGOTIATION', 'WON',
]);

export const PROPOSAL_STAGES: Set<LeadStage> = new Set([
  'PROPOSAL', 'NEGOTIATION', 'WON',
]);

export const TERMINAL_LEAD_STAGES: Set<LeadStage> = new Set([
  'LOST', 'NOT_INTERESTED', 'NO_RESPONSE',
]);

export const ALL_LEAD_STAGES: { stage: LeadStage; label: string; color: string }[] = [
  { stage: 'LEAD_FOUND', label: 'Lead Found', color: '#64748b' },
  { stage: 'QUALIFIED', label: 'Qualified', color: '#3b82f6' },
  { stage: 'CONTACTED', label: 'Contacted', color: '#06b6d4' },
  { stage: 'REPLIED', label: 'Replied', color: '#8b5cf6' },
  { stage: 'CALL', label: 'Call', color: '#f59e0b' },
  { stage: 'PROPOSAL', label: 'Proposal', color: '#ec4899' },
  { stage: 'NEGOTIATION', label: 'Negotiation', color: '#6366f1' },
  { stage: 'WON', label: 'Won', color: '#22c55e' },
  { stage: 'LOST', label: 'Lost', color: '#ef4444' },
  { stage: 'NOT_INTERESTED', label: 'Not Interested', color: '#71717a' },
  { stage: 'NO_RESPONSE', label: 'No Response', color: '#a1a1aa' },
];

// ============================================================================
// KPI Summary Interface
// ============================================================================
export interface AgencyKpiSummary {
  // === FINANCIALS (strict separation) ===
  realizedCash: number;         // Sum of PAID invoices (money in bank)
  billedRevenue: number;        // Sum of SENT + OVERDUE + PAID invoices
  accountsReceivable: number;   // Sum of SENT + OVERDUE invoices (owed but not collected)
  totalPipelineValue: number;   // Sum of estimatedDealValue on active leads
  currency: string;

  // === SALES FUNNEL ===
  totalLeads: number;
  activeLeads: number;
  qualifiedLeads: number;
  proposalLeads: number;
  wonLeads: number;
  lostLeads: number;
  leadToQualifiedRate: number | null;
  qualifiedToProposalRate: number | null;
  proposalToWonRate: number | null;
  overallLeadToWonRate: number | null;

  // === LEAD VELOCITY ===
  leadsThisWeek: number;
  leadsToday: number;
  proposalsThisWeek: number;

  // === CLIENT & PROJECT OPERATIONS ===
  totalClients: number;
  activeClients: number;
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalDeliveryHours: number;

  // === INVOICE METRICS ===
  totalInvoices: number;
  draftInvoices: number;
  sentInvoices: number;
  overdueInvoices: number;
  paidInvoices: number;

  // === FOCUS TIME & HOURLY ECONOMICS ===
  focusTimeTodaySeconds: number;
  focusTimeThisWeekSeconds: number;
  focusTimeTotalSeconds: number;
  focusTimeByCategory: Record<string, number>;
  effectiveHourlyRate: number | null; // realizedCash / total focus hours

  // === VELOCITY & CONSISTENCY ===
  daysActiveThisWeek: number;

  // === MATURITY ===
  maturity: AgencyMaturitySnapshot;
}

// ============================================================================
// Pure KPI Calculation
// ============================================================================
export function calculateAgencyKpis(params: {
  clients: AgencyClient[];
  projects: AgencyProject[];
  leads: AgencyLead[];
  invoices: AgencyInvoice[];
  focusSessions: FocusSession[];
  events: ActivityEvent[];
}): AgencyKpiSummary {
  const { clients, projects, leads, invoices, focusSessions, events } = params;

  const todayIso = startOfToday();
  const weekAgoIso = startOfWeeksAgo(1);

  // === FINANCIALS ===
  let realizedCash = 0;
  let billedRevenue = 0;
  let accountsReceivable = 0;
  let draftInvoices = 0;
  let sentInvoices = 0;
  let overdueInvoices = 0;
  let paidInvoices = 0;

  for (const inv of invoices) {
    const amt = inv.amount || 0;
    if (inv.status === 'PAID') {
      realizedCash += amt;
      billedRevenue += amt;
      paidInvoices++;
    } else if (inv.status === 'SENT') {
      billedRevenue += amt;
      accountsReceivable += amt;
      sentInvoices++;
    } else if (inv.status === 'OVERDUE') {
      billedRevenue += amt;
      accountsReceivable += amt;
      overdueInvoices++;
    } else if (inv.status === 'DRAFT') {
      draftInvoices++;
    }
  }

  // === SALES FUNNEL ===
  let activeLeads = 0;
  let qualifiedLeads = 0;
  let proposalLeads = 0;
  let wonLeads = 0;
  let lostLeads = 0;
  let totalPipelineValue = 0;
  let leadsThisWeek = 0;
  let leadsToday = 0;
  let proposalsThisWeek = 0;

  for (const lead of leads) {
    if (ACTIVE_LEAD_STAGES.has(lead.stage)) {
      activeLeads++;
      totalPipelineValue += lead.estimatedDealValue || 0;
    }
    if (QUALIFIED_STAGES.has(lead.stage)) qualifiedLeads++;
    if (PROPOSAL_STAGES.has(lead.stage)) proposalLeads++;
    if (lead.stage === 'WON') wonLeads++;
    if (TERMINAL_LEAD_STAGES.has(lead.stage)) lostLeads++;

    // Velocity: leads discovered this week/today
    const disc = lead.discoveredAt || lead.createdAt || '';
    if (disc >= weekAgoIso) leadsThisWeek++;
    if (disc >= todayIso) leadsToday++;

    // Proposals sent this week (using events or stage timestamps)
    if (PROPOSAL_STAGES.has(lead.stage) && lead.updatedAt && lead.updatedAt >= weekAgoIso) {
      proposalsThisWeek++;
    }
  }

  const totalLeads = leads.length;
  const leadToQualifiedRate = safePct(qualifiedLeads, totalLeads);
  const qualifiedToProposalRate = safePct(proposalLeads, qualifiedLeads);
  const proposalToWonRate = safePct(wonLeads, proposalLeads);
  const overallLeadToWonRate = safePct(wonLeads, totalLeads);

  // === CLIENTS & PROJECTS ===
  const totalClients = clients.length;
  const activeClients = clients.filter(c => c.status === 'ACTIVE').length;
  const totalProjects = projects.length;
  let activeProjects = 0;
  let completedProjects = 0;
  let totalDeliveryHours = 0;

  for (const proj of projects) {
    if (proj.status === 'ACTIVE') activeProjects++;
    if (proj.status === 'DELIVERED' || proj.status === 'PAID') completedProjects++;
    totalDeliveryHours += proj.hoursSpent || 0;
  }

  // === FOCUS TIME ===
  let focusTimeTodaySeconds = 0;
  let focusTimeThisWeekSeconds = 0;
  let focusTimeTotalSeconds = 0;
  const focusTimeByCategory: Record<string, number> = {};

  for (const s of focusSessions) {
    if (s.pillarId !== 'agency' || s.status !== 'STOPPED') continue;
    const dur = s.durationSeconds || 0;
    focusTimeTotalSeconds += dur;
    if (s.startedAt >= todayIso) focusTimeTodaySeconds += dur;
    if (s.startedAt >= weekAgoIso) focusTimeThisWeekSeconds += dur;
    const cat = s.category || 'General';
    focusTimeByCategory[cat] = (focusTimeByCategory[cat] || 0) + dur;
  }

  // Effective Hourly Rate = Realized Cash / Total Focus Hours
  const totalFocusHours = focusTimeTotalSeconds / 3600;
  const effectiveHourlyRate = totalFocusHours > 0
    ? Math.round((realizedCash / totalFocusHours) * 100) / 100
    : null;

  // === CONSISTENCY ===
  const activeDaysSet = new Set<string>();
  for (const s of focusSessions) {
    if (s.pillarId === 'agency' && s.startedAt >= weekAgoIso) {
      activeDaysSet.add(s.startedAt.slice(0, 10));
    }
  }
  for (const ev of events) {
    if (ev.pillarId === 'agency' && ev.occurredAt >= weekAgoIso) {
      activeDaysSet.add(ev.occurredAt.slice(0, 10));
    }
  }

  // === MATURITY TIER ===
  const maturity = calculateMaturityTier({
    activeClients,
    realizedCash,
    totalDeliveryHours: focusTimeTotalSeconds / 3600,
    activeLeads,
    qualifiedLeads: leads.filter(l => QUALIFIED_STAGES.has(l.stage) && l.stage !== 'WON').length,
    hasRecurringBilling: clients.some(c => c.billingType === 'RETAINER'),
    monthlyRevenue: realizedCash, // simplified: using total for now
  });

  return {
    realizedCash,
    billedRevenue,
    accountsReceivable,
    totalPipelineValue,
    currency: 'INR',
    totalLeads,
    activeLeads,
    qualifiedLeads,
    proposalLeads,
    wonLeads,
    lostLeads,
    leadToQualifiedRate,
    qualifiedToProposalRate,
    proposalToWonRate,
    overallLeadToWonRate,
    leadsThisWeek,
    leadsToday,
    proposalsThisWeek,
    totalClients,
    activeClients,
    totalProjects,
    activeProjects,
    completedProjects,
    totalDeliveryHours,
    totalInvoices: invoices.length,
    draftInvoices,
    sentInvoices,
    overdueInvoices,
    paidInvoices,
    focusTimeTodaySeconds,
    focusTimeThisWeekSeconds,
    focusTimeTotalSeconds,
    focusTimeByCategory,
    effectiveHourlyRate,
    daysActiveThisWeek: activeDaysSet.size,
    maturity,
  };
}

// ============================================================================
// Maturity Tier Derivation (Deterministic)
// ============================================================================
export function calculateMaturityTier(data: {
  activeClients: number;
  realizedCash: number;
  totalDeliveryHours: number;
  activeLeads: number;
  qualifiedLeads: number;
  hasRecurringBilling: boolean;
  monthlyRevenue: number;
}): AgencyMaturitySnapshot {
  const {
    activeClients, totalDeliveryHours,
    activeLeads, qualifiedLeads, hasRecurringBilling, monthlyRevenue,
  } = data;

  // Tier 4: Scaling Agency
  const t4criteria = [
    { name: 'Multi-client portfolio (3+)', met: activeClients >= 3, detail: `${activeClients} active clients` },
    { name: 'Revenue > ₹5L/month', met: monthlyRevenue > 500000, detail: `₹${Math.round(monthlyRevenue / 1000)}K revenue` },
    { name: 'Balanced sales + delivery focus', met: totalDeliveryHours > 50 && activeLeads >= 3, detail: `${Math.round(totalDeliveryHours)}h delivered, ${activeLeads} active leads` },
  ];
  if (t4criteria.every(c => c.met)) {
    return {
      tier: 'SCALING_AGENCY',
      label: 'Scaling Agency',
      score: 90,
      criteria: t4criteria,
    };
  }

  // Tier 3: Repeatable Agency
  const t3criteria = [
    { name: 'Active sales pipeline (≥3 qualified leads)', met: qualifiedLeads >= 3, detail: `${qualifiedLeads} qualified leads` },
    { name: 'Recurring retainers', met: hasRecurringBilling, detail: hasRecurringBilling ? 'Has retainer clients' : 'No retainer billing' },
    { name: 'Revenue > ₹3L/month', met: monthlyRevenue > 300000, detail: `₹${Math.round(monthlyRevenue / 1000)}K revenue` },
  ];
  if (t3criteria.every(c => c.met)) {
    return {
      tier: 'REPEATABLE_AGENCY',
      label: 'Repeatable Agency',
      score: 70,
      criteria: t3criteria,
      nextTier: {
        tier: 'SCALING_AGENCY',
        label: 'Scaling Agency',
        requirements: t4criteria.filter(c => !c.met).map(c => c.name),
      },
    };
  }

  // Tier 2: Solo Operator
  const t2criteria = [
    { name: '2+ active clients', met: activeClients >= 2, detail: `${activeClients} active clients` },
    { name: 'Recurring billing or retainers', met: hasRecurringBilling, detail: hasRecurringBilling ? 'Has retainer billing' : 'Project-based only' },
    { name: 'Revenue > ₹1.5L/month', met: monthlyRevenue > 150000, detail: `₹${Math.round(monthlyRevenue / 1000)}K revenue` },
    { name: 'Tracked delivery hours', met: totalDeliveryHours > 10, detail: `${Math.round(totalDeliveryHours)}h tracked` },
  ];
  if (t2criteria.filter(c => c.met).length >= 3) {
    return {
      tier: 'SOLO_OPERATOR',
      label: 'Solo Operator',
      score: 50,
      criteria: t2criteria,
      nextTier: {
        tier: 'REPEATABLE_AGENCY',
        label: 'Repeatable Agency',
        requirements: t3criteria.filter(c => !c.met).map(c => c.name),
      },
    };
  }

  // Tier 1: Freelancer (default)
  const t1criteria = [
    { name: 'Has clients', met: activeClients >= 1, detail: `${activeClients} active clients` },
    { name: 'Project-based work', met: true, detail: 'Early stage freelancer' },
    { name: 'Revenue < ₹1L/month', met: monthlyRevenue < 100000, detail: `₹${Math.round(monthlyRevenue / 1000)}K revenue` },
  ];

  return {
    tier: 'FREELANCER',
    label: 'Freelancer',
    score: 20,
    criteria: t1criteria,
    nextTier: {
      tier: 'SOLO_OPERATOR',
      label: 'Solo Operator',
      requirements: t2criteria.filter(c => !c.met).map(c => c.name),
    },
  };
}

// ============================================================================
// Goal Synchronizer
// ============================================================================
export async function syncAgencyGoalValues(kpis: AgencyKpiSummary): Promise<void> {
  try {
    const allGoals = await dbGetAll<Goal>(STORES.GOALS);
    const agencyGoals = allGoals.filter(g => g.pillarId === 'agency');

    for (const goal of agencyGoals) {
      const title = (goal.title || '').toLowerCase();
      const unit = (goal.unit || '').toLowerCase();
      let newVal = goal.currentComputedValue;

      if (title.includes('cash') || title.includes('revenue') || title.includes('realized')) {
        newVal = kpis.realizedCash;
      } else if (title.includes('retainer') || title.includes('active client')) {
        newVal = kpis.activeClients;
      } else if (title.includes('lead') && !title.includes('qualified')) {
        if (goal.cadence === 'WEEKLY') newVal = kpis.leadsThisWeek;
        else newVal = kpis.totalLeads;
      } else if (title.includes('proposal')) {
        if (goal.cadence === 'MONTHLY' || goal.cadence === 'WEEKLY') newVal = kpis.proposalsThisWeek;
        else newVal = kpis.proposalLeads;
      } else if (title.includes('focus') || title.includes('hour') || unit.includes('hour')) {
        if (goal.cadence === 'WEEKLY') {
          newVal = Math.round((kpis.focusTimeThisWeekSeconds / 3600) * 10) / 10;
        } else {
          newVal = Math.round((kpis.focusTimeTotalSeconds / 3600) * 10) / 10;
        }
      } else if (title.includes('project')) {
        newVal = kpis.activeProjects;
      }

      if (newVal !== goal.currentComputedValue) {
        await dbPut(STORES.GOALS, { ...goal, currentComputedValue: newVal });
      }
    }
  } catch (err) {
    console.warn('Agency goal sync deferred:', err);
  }
}

// ============================================================================
// Data Loader (fetches from IndexedDB and calculates)
// ============================================================================
export async function loadAgencyKpiSummary(): Promise<AgencyKpiSummary> {
  const [
    clients,
    projects,
    leads,
    invoices,
    allSessions,
    allEvents,
  ] = await Promise.all([
    dbGetAll<AgencyClient>(STORES.AGENCY_CLIENTS),
    dbGetAll<AgencyProject>(STORES.AGENCY_PROJECTS),
    dbGetAll<AgencyLead>(STORES.AGENCY_LEADS),
    dbGetAll<AgencyInvoice>(STORES.AGENCY_INVOICES),
    dbGetAll<FocusSession>(STORES.FOCUS_SESSIONS),
    dbGetAll<ActivityEvent>(STORES.EVENTS),
  ]);

  const agencySessions = allSessions.filter(s => s.pillarId === 'agency');
  const agencyEvents = allEvents.filter(e => e.pillarId === 'agency');

  const summary = calculateAgencyKpis({
    clients,
    projects,
    leads,
    invoices,
    focusSessions: agencySessions,
    events: agencyEvents,
  });

  // Sync computed values back to Goal entities
  await syncAgencyGoalValues(summary);

  return summary;
}
