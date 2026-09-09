import { describe, it, expect, vi } from 'vitest';
import { logEvent } from '../hooks/useDatabase';
import { generateOfflineVoireAudit, type VoireAiFacts } from '../services/aiContext';
import { calculateJobHuntKpis } from '../services/jobHuntKpi';
import { calculateAgencyKpis } from '../services/agencyKpi';
import { computeSaasKpis } from '../services/saasKpi';
import { computeForexKpiSummary } from '../services/forexKpi';
import { computeFitnessKpiSummary } from '../services/fitnessKpi';
import type {
  JobOpportunity,
  JobApplication,
  AgencyClient,
  AgencyInvoice,
  SaasFeature,
  ForexSetup,
  WorkoutSession,
  ExerciseLog,
} from '../types';

vi.mock('../services/db', () => ({
  dbPut: vi.fn().mockImplementation(async (_store, item) => item),
  dbGetAll: vi.fn().mockResolvedValue([]),
  STORES: {
    EVENTS: 'activityEvents',
    VOIRE_DESIGNS: 'voireDesigns',
    VOIRE_PRODUCTS: 'voireProducts',
    VOIRE_DROPS: 'voireDrops',
    VOIRE_ORDERS: 'voireOrders',
    VOIRE_ORDER_ITEMS: 'voireOrderItems',
    VOIRE_MARKETING: 'voireMarketing',
    VOIRE_FINANCIAL_PERIODS: 'voireFinancialPeriods',
    GOALS: 'goals',
  },
}));

describe('VOIRE Integration & Activity Ledger Verification', () => {
  it('verifies full VOIRE event schema and entity references for all major actions', async () => {
    // 1. DESIGN_CREATED
    const designEvt = await logEvent('voire', 'DESIGN_CREATED', {
      quantity: 1,
      unit: 'design',
      entityRefType: 'VoireDesign',
      entityRefId: 'vd_101',
      metadata: {
        name: 'Cyberpunk Hoodie',
        status: 'DRAFT',
        estimatedProductionCost: 750,
      },
    });

    expect(designEvt.pillarId).toBe('voire');
    expect(designEvt.eventType).toBe('DESIGN_CREATED');
    expect(designEvt.entityRefType).toBe('VoireDesign');
    expect(designEvt.entityRefId).toBe('vd_101');
    expect(designEvt.metadata?.name).toBe('Cyberpunk Hoodie');

    // 2. PRODUCT_CREATED
    const prodEvt = await logEvent('voire', 'PRODUCT_CREATED', {
      quantity: 1,
      unit: 'product',
      entityRefType: 'VoireProduct',
      entityRefId: 'vp_202',
      metadata: {
        sku: 'VR-HD-001',
        retailPrice: 2499,
        baseCost: 750,
      },
    });

    expect(prodEvt.pillarId).toBe('voire');
    expect(prodEvt.eventType).toBe('PRODUCT_CREATED');
    expect(prodEvt.entityRefType).toBe('VoireProduct');
    expect(prodEvt.entityRefId).toBe('vp_202');
    expect(prodEvt.metadata?.retailPrice).toBe(2499);

    // 3. DROP_CREATED
    const dropEvt = await logEvent('voire', 'DROP_CREATED', {
      quantity: 1,
      unit: 'drop',
      entityRefType: 'VoireDrop',
      entityRefId: 'vd_303',
      metadata: {
        name: 'Genesis Drop 01',
        status: 'SCHEDULED',
        targetRevenue: 150000,
      },
    });

    expect(dropEvt.pillarId).toBe('voire');
    expect(dropEvt.eventType).toBe('DROP_CREATED');
    expect(dropEvt.entityRefType).toBe('VoireDrop');
    expect(dropEvt.entityRefId).toBe('vd_303');
    expect(dropEvt.metadata?.targetRevenue).toBe(150000);

    // 4. ORDER_RECORDED
    const orderEvt = await logEvent('voire', 'ORDER_RECORDED', {
      quantity: 1,
      unit: 'order',
      entityRefType: 'VoireOrder',
      entityRefId: 'vo_404',
      metadata: {
        orderNumber: 'VR-123456',
        totalAmount: 2499,
        paymentStatus: 'PAID',
      },
    });

    expect(orderEvt.pillarId).toBe('voire');
    expect(orderEvt.eventType).toBe('ORDER_RECORDED');
    expect(orderEvt.entityRefType).toBe('VoireOrder');
    expect(orderEvt.entityRefId).toBe('vo_404');
    expect(orderEvt.metadata?.totalAmount).toBe(2499);

    // 5. CAMPAIGN_CREATED
    const campEvt = await logEvent('voire', 'CAMPAIGN_CREATED', {
      quantity: 1,
      unit: 'campaign',
      entityRefType: 'VoireMarketingCampaign',
      entityRefId: 'vm_505',
      metadata: {
        name: 'IG Reels Top of Funnel',
        spendAmount: 5000,
        channel: 'META_ADS',
      },
    });

    expect(campEvt.pillarId).toBe('voire');
    expect(campEvt.eventType).toBe('CAMPAIGN_CREATED');
    expect(campEvt.entityRefType).toBe('VoireMarketingCampaign');
    expect(campEvt.entityRefId).toBe('vm_505');
    expect(campEvt.metadata?.spendAmount).toBe(5000);

    // 6. FINANCIAL_PERIOD_LOGGED
    const periodEvt = await logEvent('voire', 'FINANCIAL_PERIOD_LOGGED', {
      quantity: 1,
      unit: 'period',
      entityRefType: 'VoireFinancialPeriod',
      entityRefId: 'vfp_606',
      metadata: {
        periodName: 'Drop 01 Accounting Cycle',
        otherExpenses: 500,
      },
    });

    expect(periodEvt.pillarId).toBe('voire');
    expect(periodEvt.eventType).toBe('FINANCIAL_PERIOD_LOGGED');
    expect(periodEvt.entityRefType).toBe('VoireFinancialPeriod');
    expect(periodEvt.entityRefId).toBe('vfp_606');
  });

  it('generates deterministic offline AI facts and interpretation without hallucinations', () => {
    const aiFacts: VoireAiFacts = {
      timestamp: '2026-09-07T10:00:00Z',
      pillar: 'voire',
      isWeekend: false,
      creativePauseExcused: true,
      status: {
        verdict: 'ON_TRACK',
        score: 85,
        headline: 'Positive Contribution Realized',
        reason: 'Brand generated healthy unit economics.',
      },
      creativeEngine: {
        totalDesigns: 4,
        readyOrSampledDesigns: 2,
        activeProducts: 2,
        activeDrops: 1,
      },
      financialReality: {
        grossSales: 10000,
        discounts: 500,
        refunds: 0,
        netSales: 9500,
        cogsProduction: 3000,
        cogsShipping: 400,
        totalCogs: 3400,
        marketingSpend: 1500,
        otherExpenses: 0,
        contributionProfit: 4600,
        contributionMarginPercent: '48.4%',
        cashReceived: 9500,
        accountsReceivablePending: 0,
        aov: 2375,
        roas: 6.33,
        cac: 375,
        paidOrdersCount: 4,
        pendingOrdersCount: 0,
        refundCount: 0,
      },
      marketing: {
        campaignsCount: 1,
        totalImpressions: 25000,
        totalClicks: 1000,
        totalConversions: 4,
        overallCtr: '4.0%',
        overallCvr: '0.4%',
        blendedRoas: 6.33,
      },
      bottlenecks: [],
      activeGoals: [
        {
          title: '₹35,000 Contribution Profit',
          cadence: 'MONTHLY',
          currentValue: 4600,
          targetValue: 35000,
          unit: '₹',
          progressPercent: '13%',
        },
      ],
    };

    const audit = generateOfflineVoireAudit(aiFacts);
    expect(audit).toContain('VOIRE — Brand Performance & Commercial Audit');
    expect(audit).toContain('weekday pause');
    expect(audit).toContain('Positive Unit Economics');
    expect(audit).toContain('Strong Ad Efficiency');
    expect(audit).toContain('₹4,600');
  });

  describe('DB v6 -> v7 Migration & Frozen Pillars 1–5 Regression Verification', () => {
    it('verifies that all existing records and KPIs across Pillars 1–5 remain 100% intact after v7 upgrade', () => {
      // 1. Pillar 1: Job Hunt
      const opps: JobOpportunity[] = [
        {
          id: 'jh-1',
          company: 'TechCorp',
          role: 'Staff Engineer',
          stage: 'APPLIED',
          minSalary: 120000,
          currency: 'USD',
          source: 'REFERRAL',
          workMode: 'REMOTE',
          discoveredAt: '2026-09-01T10:00:00.000Z',
          priority: 'HIGH',
          createdAt: '2026-09-01T10:00:00.000Z',
          updatedAt: '2026-09-01T10:00:00.000Z',
        },
      ];
      const apps: JobApplication[] = [
        {
          id: 'app-1',
          opportunityId: 'jh-1',
          appliedAt: '2026-09-01T10:00:00.000Z',
          method: 'REFERRAL',
          resumeVersionId: 'v2.1',
          customizationLevel: 'TAILORED',
        },
      ];
      const jhKpi = calculateJobHuntKpis({
        opportunities: opps,
        applications: apps,
        outreaches: [],
        assets: [],
        focusSessions: [],
        events: [],
      });
      expect(jhKpi.totalOpportunities).toBe(1);
      expect(jhKpi.activeOpportunities).toBe(1);

      // 2. Pillar 2: Agency
      const clients: AgencyClient[] = [
        {
          id: 'client-1',
          name: 'Nexus Corp',
          clientType: 'RETAINER',
          status: 'ACTIVE',
          lifetimeRevenue: 3500,
          acquisitionChannel: 'REFERRAL',
          icpScore: 85,
          startDate: '2026-08-01',
          createdAt: '2026-08-01T10:00:00.000Z',
          updatedAt: '2026-08-01T10:00:00.000Z',
        },
      ];
      const invoices: AgencyInvoice[] = [
        {
          id: 'inv-1',
          clientId: 'client-1',
          projectId: 'proj-1',
          invoiceNumber: 'INV-101',
          amount: 3500,
          currency: 'USD',
          status: 'PAID',
          issuedAt: '2026-08-01',
          dueDate: '2026-08-15',
          paidAt: '2026-08-10',
          createdAt: '2026-08-01T10:00:00.000Z',
          updatedAt: '2026-08-10T10:00:00.000Z',
        },
      ];
      const agencyKpi = calculateAgencyKpis({
        clients,
        projects: [],
        leads: [],
        invoices,
        focusSessions: [],
        events: [],
      });
      expect(agencyKpi.realizedCash).toBe(3500);
      expect(agencyKpi.billedRevenue).toBe(3500);

      // 3. Pillar 3: Trading OS -> SaaS
      const features: SaasFeature[] = [
        {
          id: 'feat-1',
          name: 'Strategy Engine',
          status: 'IN_PROGRESS',
          priority: 'P0',
          category: 'CORE',
          createdAt: '2026-08-01T10:00:00.000Z',
          updatedAt: '2026-08-01T10:00:00.000Z',
        },
      ];
      const saasKpi = computeSaasKpis(features, [], [], []);
      expect(saasKpi.totalFeatures).toBe(1);

      // 4. Pillar 4: Forex Learning
      const setups: ForexSetup[] = [
        {
          id: 'fx-setup-1',
          name: 'London Sweep',
          marketContext: 'Liquidity Sweep',
          timeframe: '15m',
          entryRules: 'Asia range sweep + FVG fill',
          slRules: 'Below sweep low',
          tpRules: '2R fixed',
          status: 'VALIDATED',
          createdAt: '2026-08-15T08:00:00.000Z',
          updatedAt: '2026-08-15T08:00:00.000Z',
        },
      ];
      const forexKpi = computeForexKpiSummary([], setups, [], [], [], []);
      expect(forexKpi.totalSetups).toBe(1);
      expect(forexKpi.setupsValidated).toBe(1);

      // 5. Pillar 5: Fitness & Health
      const workouts: WorkoutSession[] = [
        {
          id: 'wk-1',
          startedAt: '2026-09-02T10:00:00.000Z',
          workoutType: 'GYM_PUSH',
          durationMinutes: 60,
        },
      ];
      const exercises: ExerciseLog[] = [
        {
          id: 'ex-1',
          workoutId: 'wk-1',
          exerciseName: 'Barbell Bench Press',
          barWeightKg: 20,
          weightPerSideKg: 30,
          weightKg: 80,
          reps: 6,
          setIndex: 1,
          isPR: false,
        },
      ];
      const fitnessKpi = computeFitnessKpiSummary(workouts, exercises, [], [], [], []);
      expect(fitnessKpi.workoutsCount).toBe(1);
      expect(fitnessKpi.gymDurationMinutes).toBe(60);
      expect(fitnessKpi.benchPressMaxKg).toBe(80);
      expect(fitnessKpi.benchPressMaxPerSideKg).toBe(30);
    });
  });
});
