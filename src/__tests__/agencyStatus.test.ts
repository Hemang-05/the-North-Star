import { describe, it, expect } from 'vitest';
import { evaluateAgencyStatus } from '../services/statusEngine';
import { generateOfflineAgencyAudit, AgencyAiFacts } from '../services/aiContext';
import type { AgencyKpiSummary } from '../services/agencyKpi';
import type { Goal } from '../types';

describe('Agency Status Engine & AI Facts', () => {
  const emptyAgencyKpis: AgencyKpiSummary = {
    realizedCash: 0,
    billedRevenue: 0,
    accountsReceivable: 0,
    totalPipelineValue: 0,
    weightedPipelineValue: 0,
    effectiveHourlyRate: null,
    totalClients: 0,
    activeClients: 0,
    churnedClients: 0,
    clientRetentionRate: null,
    totalProjects: 0,
    activeProjects: 0,
    completedProjects: 0,
    totalLeads: 0,
    activeLeads: 0,
    qualifiedLeads: 0,
    proposalLeads: 0,
    wonLeads: 0,
    lostLeads: 0,
    leadsThisWeek: 0,
    leadsThisMonth: 0,
    proposalsThisWeek: 0,
    leadToProposalRate: null,
    proposalToWonRate: null,
    overallLeadToWonRate: null,
    totalInvoices: 0,
    paidInvoices: 0,
    unpaidInvoices: 0,
    overdueInvoices: 0,
    invoicesThisMonth: 0,
    focusTimeTodaySeconds: 0,
    focusTimeThisWeekSeconds: 0,
    focusTimeTotalSeconds: 0,
    focusTimeByCategory: {},
    daysActiveThisWeek: 0,
    maturity: {
      tier: 'FREELANCER',
      score: 0,
      label: 'Freelancer',
      description: 'Trading time for money on ad-hoc projects',
      criteria: [],
      nextTierRequirements: [],
    },
  };

  it('evaluates completely uninitialized agency as NEGLECTED', () => {
    const evaluation = evaluateAgencyStatus(emptyAgencyKpis, []);
    expect(evaluation.verdict).toBe('NEGLECTED');
    expect(evaluation.score).toBeLessThanOrEqual(20);
    expect(evaluation.badges).toContain('Uninitialized');
  });

  it('evaluates zero weekly activity as NEGLECTED even with past data', () => {
    const dormantKpis: AgencyKpiSummary = {
      ...emptyAgencyKpis,
      totalClients: 2,
      totalLeads: 5,
      totalInvoices: 2,
      focusTimeTotalSeconds: 36000,
      daysActiveThisWeek: 0,
      leadsThisWeek: 0,
      focusTimeThisWeekSeconds: 0,
    };
    const evaluation = evaluateAgencyStatus(dormantKpis, []);
    expect(evaluation.verdict).toBe('NEGLECTED');
    expect(evaluation.headline).toContain('Zero Activity in 7 Days');
  });

  it('evaluates high goal progress as EXCEEDING with appropriate badges', () => {
    const activeKpis: AgencyKpiSummary = {
      ...emptyAgencyKpis,
      totalClients: 3,
      activeClients: 3,
      totalLeads: 8,
      activeLeads: 5,
      leadsThisWeek: 3,
      daysActiveThisWeek: 5,
      realizedCash: 150000,
      billedRevenue: 150000,
      focusTimeThisWeekSeconds: 36000,
    };

    const goal: Goal = {
      id: 'g-rev',
      pillarId: 'agency',
      title: 'Monthly Cash Collected',
      targetType: 'CURRENCY',
      targetValue: 100000,
      currentComputedValue: 150000, // 150%
      cadence: 'MONTHLY',
      weight: 100,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    const evaluation = evaluateAgencyStatus(activeKpis, [goal]);
    expect(evaluation.verdict).toBe('EXCEEDING');
    expect(evaluation.score).toBeGreaterThanOrEqual(90);
  });

  it('flags high accounts receivable as AT_RISK even when goal pace is acceptable', () => {
    const highReceivableKpis: AgencyKpiSummary = {
      ...emptyAgencyKpis,
      totalClients: 2,
      activeClients: 2,
      totalLeads: 4,
      activeLeads: 3,
      leadsThisWeek: 2,
      daysActiveThisWeek: 4,
      realizedCash: 30000,
      billedRevenue: 100000,
      accountsReceivable: 70000, // 70% of billed revenue uncollected!
      overdueInvoices: 2,
      focusTimeThisWeekSeconds: 20000,
    };

    const goal: Goal = {
      id: 'g-rev',
      pillarId: 'agency',
      title: 'Billed Target',
      targetType: 'CURRENCY',
      targetValue: 100000,
      currentComputedValue: 80000, // 80%
      cadence: 'MONTHLY',
      weight: 100,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    const evaluation = evaluateAgencyStatus(highReceivableKpis, [goal]);
    expect(evaluation.verdict).toBe('AT_RISK');
    expect(evaluation.headline).toContain('High Accounts Receivable');
    expect(evaluation.badges).toContain('Cash Collection Risk');
  });

  it('evaluates low goal progress as BEHIND', () => {
    const behindKpis: AgencyKpiSummary = {
      ...emptyAgencyKpis,
      totalClients: 1,
      activeClients: 1,
      totalLeads: 2,
      activeLeads: 1,
      leadsThisWeek: 1,
      daysActiveThisWeek: 2,
      focusTimeThisWeekSeconds: 3600,
    };

    const goal: Goal = {
      id: 'g-lead',
      pillarId: 'agency',
      title: 'Weekly Leads',
      targetType: 'COUNT',
      targetValue: 10,
      currentComputedValue: 1, // 10%
      cadence: 'WEEKLY',
      weight: 100,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    const evaluation = evaluateAgencyStatus(behindKpis, [goal]);
    expect(evaluation.verdict).toBe('BEHIND');
    expect(evaluation.score).toBeLessThanOrEqual(40);
  });

  it('evaluates healthy momentum via heuristic fallback when no goals are set', () => {
    const healthyKpis: AgencyKpiSummary = {
      ...emptyAgencyKpis,
      totalClients: 3,
      activeClients: 2,
      totalLeads: 6,
      activeLeads: 4,
      leadsThisWeek: 2,
      daysActiveThisWeek: 4,
      realizedCash: 50000,
      billedRevenue: 50000,
      focusTimeThisWeekSeconds: 15000,
    };

    const evaluation = evaluateAgencyStatus(healthyKpis, []);
    expect(evaluation.verdict).toBe('ON_TRACK');
    expect(evaluation.score).toBeGreaterThanOrEqual(75);
  });

  it('generates offline strategic agency audit with actionable warnings', () => {
    const facts: AgencyAiFacts = {
      timestamp: new Date().toISOString(),
      pillar: 'agency',
      status: {
        verdict: 'AT_RISK',
        score: 55,
        headline: 'High Accounts Receivable',
        reason: 'Uncollected invoices posing liquidity risk.',
      },
      financials: {
        realizedCash: '₹30,000',
        billedRevenue: '₹1,00,000',
        accountsReceivable: '₹70,000',
        totalPipelineValue: '₹2,50,000',
        effectiveHourlyRate: '₹1,200',
      },
      salesFunnel: {
        totalLeads: 10,
        activeLeads: 2,
        qualifiedLeads: 1,
        proposalStage: 3,
        wonClients: 0,
        lostLeads: 5,
        leadToWonRate: '0.0%',
        leadsThisWeek: 0,
        proposalsThisWeek: 1,
      },
      clientRoster: [
        { name: 'Acme Corp', status: 'ACTIVE', lifetimeRevenue: '₹30,000', billingType: 'RETAINER' }
      ],
      receivables: [
        { invoiceNumber: 'INV-001', client: 'Acme Corp', amount: '₹70,000', status: 'OVERDUE', dueDate: '2026-08-30' }
      ],
      focusTime: {
        todayFormatted: '1h 30m',
        thisWeekFormatted: '12h 00m',
        totalFormatted: '45h 00m',
        categoryBreakdown: {
          'Client Work': '12h 00m',
        },
      },
      maturity: {
        tier: 'FREELANCER',
        label: 'Freelancer',
        score: 25,
      },
      activeGoals: [
        {
          title: 'Monthly Cash',
          cadence: 'MONTHLY',
          targetValue: 100000,
          currentValue: 30000,
          unit: '₹',
          progressPercent: '30%',
        }
      ],
    };

    const audit = generateOfflineAgencyAudit(facts);
    expect(audit).toContain('Agency Pillar — Strategic Business Audit');
    expect(audit).toContain('Cash Collection Alert');
    expect(audit).toContain('Delivery Trap');
    expect(audit).toContain('Pipeline Starvation');
    expect(audit).toContain('Proposal Conversion Bottleneck');
  });
});
