// ============================================================================
// PERSONAL OS — Agency KPI Engine Tests
// Financial calculations, conversion rates, maturity tier derivation.
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  calculateAgencyKpis,
  calculateMaturityTier,
} from '../services/agencyKpi';
import type {
  AgencyClient,
  AgencyProject,
  AgencyLead,
  AgencyInvoice,
  FocusSession,
  ActivityEvent,
} from '../types';

// Helper to make minimal entities
function makeInvoice(overrides: Partial<AgencyInvoice> = {}): AgencyInvoice {
  return {
    id: `inv_${Math.random().toString(36).slice(2)}`,
    invoiceNumber: 'INV-001',
    projectId: 'proj_1',
    clientId: 'client_1',
    amount: 100000,
    currency: 'INR',
    status: 'PAID',
    issuedAt: new Date().toISOString(),
    dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeLead(overrides: Partial<AgencyLead> = {}): AgencyLead {
  return {
    id: `lead_${Math.random().toString(36).slice(2)}`,
    companyName: 'Acme Corp',
    source: 'LinkedIn',
    stage: 'LEAD_FOUND',
    discoveredAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeClient(overrides: Partial<AgencyClient> = {}): AgencyClient {
  return {
    id: `client_${Math.random().toString(36).slice(2)}`,
    name: 'Test Client',
    acquisitionChannel: 'Referral',
    icpScore: 70,
    status: 'ACTIVE',
    lifetimeRevenue: 0,
    startDate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeProject(overrides: Partial<AgencyProject> = {}): AgencyProject {
  return {
    id: `proj_${Math.random().toString(36).slice(2)}`,
    clientId: 'client_1',
    name: 'Test Project',
    startDate: new Date().toISOString(),
    status: 'ACTIVE',
    agreedAmount: 150000,
    receivedAmount: 0,
    currency: 'INR',
    hoursSpent: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeFocus(overrides: Partial<FocusSession> = {}): FocusSession {
  return {
    id: `foc_${Math.random().toString(36).slice(2)}`,
    pillarId: 'agency',
    category: 'Client Work',
    startedAt: new Date().toISOString(),
    durationSeconds: 3600,
    pausedSeconds: 0,
    status: 'STOPPED',
    ...overrides,
  };
}

describe('Agency KPI Engine', () => {
  const emptyParams = {
    clients: [] as AgencyClient[],
    projects: [] as AgencyProject[],
    leads: [] as AgencyLead[],
    invoices: [] as AgencyInvoice[],
    focusSessions: [] as FocusSession[],
    events: [] as ActivityEvent[],
  };

  // ========================================================================
  // FINANCIAL CALCULATIONS
  // ========================================================================

  describe('Financial Separation (Cash vs Billed vs Receivables)', () => {
    it('should compute zero financials when no invoices', () => {
      const kpis = calculateAgencyKpis(emptyParams);
      expect(kpis.realizedCash).toBe(0);
      expect(kpis.billedRevenue).toBe(0);
      expect(kpis.accountsReceivable).toBe(0);
    });

    it('should correctly separate PAID invoices as Realized Cash', () => {
      const kpis = calculateAgencyKpis({
        ...emptyParams,
        invoices: [
          makeInvoice({ amount: 75000, status: 'PAID' }),
          makeInvoice({ amount: 50000, status: 'PAID' }),
        ],
      });
      expect(kpis.realizedCash).toBe(125000);
      expect(kpis.billedRevenue).toBe(125000);
      expect(kpis.accountsReceivable).toBe(0);
    });

    it('should correctly compute Accounts Receivable from SENT + OVERDUE', () => {
      const kpis = calculateAgencyKpis({
        ...emptyParams,
        invoices: [
          makeInvoice({ amount: 75000, status: 'SENT' }),
          makeInvoice({ amount: 30000, status: 'OVERDUE' }),
          makeInvoice({ amount: 50000, status: 'PAID' }),
        ],
      });
      expect(kpis.realizedCash).toBe(50000);
      expect(kpis.billedRevenue).toBe(155000); // 75k + 30k + 50k
      expect(kpis.accountsReceivable).toBe(105000); // 75k + 30k
    });

    it('should not count DRAFT invoices in any financial total', () => {
      const kpis = calculateAgencyKpis({
        ...emptyParams,
        invoices: [
          makeInvoice({ amount: 100000, status: 'DRAFT' }),
        ],
      });
      expect(kpis.realizedCash).toBe(0);
      expect(kpis.billedRevenue).toBe(0);
      expect(kpis.accountsReceivable).toBe(0);
      expect(kpis.draftInvoices).toBe(1);
    });

    it('should count invoice statuses correctly', () => {
      const kpis = calculateAgencyKpis({
        ...emptyParams,
        invoices: [
          makeInvoice({ status: 'DRAFT' }),
          makeInvoice({ status: 'SENT' }),
          makeInvoice({ status: 'SENT' }),
          makeInvoice({ status: 'OVERDUE' }),
          makeInvoice({ status: 'PAID' }),
          makeInvoice({ status: 'PAID' }),
          makeInvoice({ status: 'PAID' }),
        ],
      });
      expect(kpis.draftInvoices).toBe(1);
      expect(kpis.sentInvoices).toBe(2);
      expect(kpis.overdueInvoices).toBe(1);
      expect(kpis.paidInvoices).toBe(3);
      expect(kpis.totalInvoices).toBe(7);
    });
  });

  // ========================================================================
  // CONVERSION RATES
  // ========================================================================

  describe('Conversion Rates', () => {
    it('should handle zero denominator safely (no leads)', () => {
      const kpis = calculateAgencyKpis(emptyParams);
      expect(kpis.overallLeadToWonRate).toBeNull();
      expect(kpis.leadToQualifiedRate).toBeNull();
    });

    it('should calculate overall lead to won rate', () => {
      const kpis = calculateAgencyKpis({
        ...emptyParams,
        leads: [
          makeLead({ stage: 'LEAD_FOUND' }),
          makeLead({ stage: 'QUALIFIED' }),
          makeLead({ stage: 'PROPOSAL' }),
          makeLead({ stage: 'WON' }),
          makeLead({ stage: 'LOST' }),
        ],
      });
      // 1 WON out of 5 total = 20%
      expect(kpis.overallLeadToWonRate).toBeCloseTo(20, 0);
      expect(kpis.totalLeads).toBe(5);
      expect(kpis.wonLeads).toBe(1);
    });

    it('should calculate qualified to proposal conversion', () => {
      const kpis = calculateAgencyKpis({
        ...emptyParams,
        leads: [
          makeLead({ stage: 'QUALIFIED' }),
          makeLead({ stage: 'QUALIFIED' }),
          makeLead({ stage: 'PROPOSAL' }),
          makeLead({ stage: 'WON' }),
        ],
      });
      // Qualified includes: QUALIFIED, CONTACTED, REPLIED, CALL, PROPOSAL, NEGOTIATION, WON
      // Here: 2 QUALIFIED + 1 PROPOSAL + 1 WON = 4 qualified
      // Proposal includes: PROPOSAL, NEGOTIATION, WON
      // Here: 1 PROPOSAL + 1 WON = 2 proposal
      expect(kpis.qualifiedLeads).toBe(4);
      expect(kpis.proposalLeads).toBe(2);
      expect(kpis.qualifiedToProposalRate).toBeCloseTo(50, 0);
    });
  });

  // ========================================================================
  // EFFECTIVE HOURLY RATE
  // ========================================================================

  describe('Effective Hourly Rate', () => {
    it('should return null when no focus hours', () => {
      const kpis = calculateAgencyKpis({
        ...emptyParams,
        invoices: [makeInvoice({ amount: 100000, status: 'PAID' })],
      });
      expect(kpis.effectiveHourlyRate).toBeNull();
    });

    it('should calculate rate = realizedCash / totalFocusHours', () => {
      const kpis = calculateAgencyKpis({
        ...emptyParams,
        invoices: [makeInvoice({ amount: 100000, status: 'PAID' })],
        focusSessions: [
          makeFocus({ durationSeconds: 7200 }), // 2 hours
          makeFocus({ durationSeconds: 3600 }), // 1 hour
        ],
      });
      // 100000 / 3 hours = 33333.33
      expect(kpis.effectiveHourlyRate).toBeCloseTo(33333.33, 0);
    });

    it('should not include RUNNING sessions in focus time', () => {
      const kpis = calculateAgencyKpis({
        ...emptyParams,
        focusSessions: [
          makeFocus({ durationSeconds: 3600, status: 'STOPPED' }),
          makeFocus({ durationSeconds: 9999, status: 'RUNNING' }), // should be excluded
        ],
      });
      expect(kpis.focusTimeTotalSeconds).toBe(3600);
    });
  });

  // ========================================================================
  // PIPELINE VALUE
  // ========================================================================

  describe('Pipeline Value', () => {
    it('should sum estimated deal values of active leads only', () => {
      const kpis = calculateAgencyKpis({
        ...emptyParams,
        leads: [
          makeLead({ stage: 'LEAD_FOUND', estimatedDealValue: 100000 }),
          makeLead({ stage: 'PROPOSAL', estimatedDealValue: 200000 }),
          makeLead({ stage: 'WON', estimatedDealValue: 150000 }), // WON is NOT active
          makeLead({ stage: 'LOST', estimatedDealValue: 300000 }), // LOST is NOT active
        ],
      });
      // Active stages: LEAD_FOUND (100k) + PROPOSAL (200k) = 300k
      expect(kpis.totalPipelineValue).toBe(300000);
    });
  });

  // ========================================================================
  // CLIENT & PROJECT OPERATIONS
  // ========================================================================

  describe('Client & Project Operations', () => {
    it('should count active clients', () => {
      const kpis = calculateAgencyKpis({
        ...emptyParams,
        clients: [
          makeClient({ status: 'ACTIVE' }),
          makeClient({ status: 'ACTIVE' }),
          makeClient({ status: 'CHURNED' }),
          makeClient({ status: 'PAST' }),
        ],
      });
      expect(kpis.totalClients).toBe(4);
      expect(kpis.activeClients).toBe(2);
    });

    it('should count project statuses', () => {
      const kpis = calculateAgencyKpis({
        ...emptyParams,
        projects: [
          makeProject({ status: 'ACTIVE' }),
          makeProject({ status: 'ACTIVE' }),
          makeProject({ status: 'DELIVERED' }),
          makeProject({ status: 'PAID' }),
          makeProject({ status: 'ON_HOLD' }),
        ],
      });
      expect(kpis.totalProjects).toBe(5);
      expect(kpis.activeProjects).toBe(2);
      expect(kpis.completedProjects).toBe(2); // DELIVERED + PAID
    });
  });

  // ========================================================================
  // MATURITY TIER DERIVATION
  // ========================================================================

  describe('Maturity Tier Derivation', () => {
    it('should default to FREELANCER tier', () => {
      const maturity = calculateMaturityTier({
        activeClients: 0,
        realizedCash: 0,
        totalDeliveryHours: 0,
        activeLeads: 0,
        qualifiedLeads: 0,
        hasRecurringBilling: false,
        monthlyRevenue: 0,
      });
      expect(maturity.tier).toBe('FREELANCER');
    });

    it('should reach SOLO_OPERATOR with 2+ clients and delivery hours', () => {
      const maturity = calculateMaturityTier({
        activeClients: 2,
        realizedCash: 200000,
        totalDeliveryHours: 50,
        activeLeads: 1,
        qualifiedLeads: 1,
        hasRecurringBilling: true,
        monthlyRevenue: 160000,
      });
      expect(maturity.tier).toBe('SOLO_OPERATOR');
    });

    it('should reach REPEATABLE_AGENCY with pipeline and retainers', () => {
      const maturity = calculateMaturityTier({
        activeClients: 3,
        realizedCash: 400000,
        totalDeliveryHours: 100,
        activeLeads: 5,
        qualifiedLeads: 4,
        hasRecurringBilling: true,
        monthlyRevenue: 350000,
      });
      expect(maturity.tier).toBe('REPEATABLE_AGENCY');
    });

    it('should reach SCALING_AGENCY at full maturity', () => {
      const maturity = calculateMaturityTier({
        activeClients: 5,
        realizedCash: 700000,
        totalDeliveryHours: 200,
        activeLeads: 8,
        qualifiedLeads: 6,
        hasRecurringBilling: true,
        monthlyRevenue: 600000,
      });
      expect(maturity.tier).toBe('SCALING_AGENCY');
    });

    it('should include next tier requirements for non-max tiers', () => {
      const maturity = calculateMaturityTier({
        activeClients: 0,
        realizedCash: 0,
        totalDeliveryHours: 0,
        activeLeads: 0,
        qualifiedLeads: 0,
        hasRecurringBilling: false,
        monthlyRevenue: 0,
      });
      expect(maturity.nextTier).toBeDefined();
      expect(maturity.nextTier!.tier).toBe('SOLO_OPERATOR');
      expect(maturity.nextTier!.requirements.length).toBeGreaterThan(0);
    });
  });
});
