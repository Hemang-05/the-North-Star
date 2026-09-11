import { describe, it, expect } from 'vitest';
import { evaluateVoireStatus } from '../services/statusEngine';
import { computeVoireKpiSummary } from '../services/voireKpi';
import type { VoireKpiSummary, VoireDesign, VoireProduct, VoireDrop, VoireMarketingCampaign } from '../types/pillars';
import type { Goal } from '../types';

describe('VOIRE Status Engine & Heuristics', () => {
  it('excuses creative pause during weekdays without penalizing momentum or flagging stalled status', () => {
    // Weekday: Wednesday
    const wednesday = new Date(2026, 8, 9);
    const kpis = computeVoireKpiSummary([], [], [], [], [], [], [], wednesday);
    expect(kpis.creativePauseExcused).toBe(true);

    const status = evaluateVoireStatus(kpis, []);
    expect(status.verdict).toBe('ON_TRACK');
    expect(status.score).toBeGreaterThanOrEqual(70);
    expect(status.reason).toContain('Weekday creative pause active');
  });

  it('detects sampling bottleneck when designs exist but zero have reached sampled/ready status', () => {
    const designs: VoireDesign[] = [
      {
        id: 'd1',
        name: 'Concept 1',
        status: 'DRAFT',
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      },
      {
        id: 'd2',
        name: 'Concept 2',
        status: 'DRAFT',
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      },
    ];

    const kpis = computeVoireKpiSummary(designs, [], [], [], [], [], []);
    const status = evaluateVoireStatus(kpis, []);
    expect(status.verdict).toBe('AT_RISK');
    expect(status.headline).toContain('Sampling Pipeline Bottleneck');
  });

  it('detects drop execution bottleneck when drops exist without catalog products', () => {
    const drops: VoireDrop[] = [
      {
        id: 'dr_1',
        name: 'Drop 01',
        status: 'SCHEDULED',
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      },
    ];

    const kpis = computeVoireKpiSummary([], [], drops, [], [], [], []);
    const status = evaluateVoireStatus(kpis, []);
    expect(status.verdict).toBe('AT_RISK');
    expect(status.headline).toContain('Drop Execution Bottleneck');
  });

  it('detects marketing acquisition leak when spend is committed with zero paid orders', () => {
    const campaigns: VoireMarketingCampaign[] = [
      {
        id: 'camp_1',
        name: 'Meta Ads',
        channel: 'META_ADS',
        campaignType: 'PAID_ACQUISITION',
        status: 'ACTIVE',
        spendAmount: 2500,
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      },
    ];

    const kpis = computeVoireKpiSummary([], [], [], [], [], campaigns, []);
    const status = evaluateVoireStatus(kpis, []);
    expect(status.verdict).toBe('AT_RISK');
    expect(status.headline).toContain('Marketing Acquisition Leak');
  });

  it('overrides status when critical user goals are severely lagging', () => {
    const kpis: VoireKpiSummary = {
      totalDesigns: 5,
      readyOrSampledDesigns: 3,
      activeProducts: 4,
      activeDrops: 1,
      totalOrders: 20,
      paidOrdersCount: 20,
      pendingOrdersCount: 0,
      grossSales: 50000,
      discounts: 0,
      refunds: 0,
      refundCount: 0,
      netSales: 50000,
      cogsProduction: 15000,
      cogsShipping: 2000,
      totalCogs: 17000,
      marketingSpend: 8000,
      otherExpenses: 0,
      contributionProfit: 25000,
      contributionMarginPercent: 50,
      cashReceived: 50000,
      accountsReceivablePending: 0,
      aov: 2500,
      roas: 6.25,
      cac: 400,
      campaignsCount: 1,
      totalImpressions: 50000,
      totalClicks: 2000,
      totalConversions: 20,
      overallCtr: 4,
      overallCvr: 1,
      isWeekend: false,
      creativePauseExcused: true,
    };

    // User set a high target goal of 100 paid orders, but only 20 done (20% progress)
    const goals: Goal[] = [
      {
        id: 'g_orders',
        pillarId: 'voire',
        title: '100 Paid Orders',
        cadence: 'MONTHLY',
        targetValue: 100,
        currentValue: 20,
        status: 'ACTIVE',
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      },
    ];

    const status = evaluateVoireStatus(kpis, goals);
    expect(status.verdict).toBe('BEHIND');
    expect(status.reason).toContain('Significant variance against active goals');
  });
});
