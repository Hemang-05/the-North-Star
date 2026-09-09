import { describe, it, expect } from 'vitest';
import { computeVoireKpiSummary } from '../services/voireKpi';
import type {
  VoireDesign,
  VoireProduct,
  VoireDrop,
  VoireOrder,
  VoireOrderItem,
  VoireMarketingCampaign,
  VoireFinancialPeriod,
} from '../types/pillars';

describe('VOIRE KPI & Financial Engine', () => {
  it('handles zero-data gracefully with zero division safety', () => {
    const kpis = computeVoireKpiSummary([], [], [], [], [], [], []);
    expect(kpis.grossSales).toBe(0);
    expect(kpis.netSales).toBe(0);
    expect(kpis.contributionProfit).toBe(0);
    expect(kpis.contributionMarginPercent).toBe(0);
    expect(kpis.aov).toBe(0);
    expect(kpis.roas).toBe(0);
    expect(kpis.cac).toBe(0);
    expect(kpis.totalDesigns).toBe(0);
    expect(kpis.activeProducts).toBe(0);
    expect(isNaN(kpis.roas)).toBe(false);
    expect(isNaN(kpis.contributionMarginPercent)).toBe(false);
  });

  it('guarantees historical cost snapshot invariance when product base cost changes later', () => {
    const products: VoireProduct[] = [
      {
        id: 'prod_hoodie',
        name: 'Voidwalker Hoodie',
        sku: 'VW-HD-01',
        category: 'HOODIE',
        status: 'ACTIVE',
        retailPrice: 2500,
        baseCost: 1200, // Current base cost updated by manufacturer later
        createdAt: '2026-09-01T10:00:00Z',
        updatedAt: '2026-09-07T10:00:00Z',
      },
    ];

    const orders: VoireOrder[] = [
      {
        id: 'ord_1',
        orderNumber: 'VR-000001',
        orderDate: '2026-09-02T12:00:00Z',
        fulfillmentStatus: 'DELIVERED',
        paymentStatus: 'PAID',
        paidAt: '2026-09-02T12:05:00Z',
        subtotal: 2500,
        discountAmount: 0,
        shippingFee: 0,
        shippingCostActual: 100,
        totalAmount: 2500,
        createdAt: '2026-09-02T12:00:00Z',
        updatedAt: '2026-09-02T12:00:00Z',
      },
    ];

    // Order item was snapshotted at earlier unit cost of 800
    const orderItems: VoireOrderItem[] = [
      {
        id: 'item_1',
        orderId: 'ord_1',
        productId: 'prod_hoodie',
        productName: 'Voidwalker Hoodie',
        productSku: 'VW-HD-01',
        quantity: 1,
        unitPriceAtSale: 2500,
        unitProductionCostAtSale: 800, // Historic snapshot
        totalPrice: 2500,
      },
    ];

    const kpis = computeVoireKpiSummary([], products, [], orders, orderItems, [], []);

    // Crucial check: COGS production must equal snapshotted cost (800), NOT current base cost (1200)
    expect(kpis.cogsProduction).toBe(800);
    expect(kpis.cogsShipping).toBe(100);
    expect(kpis.totalCogs).toBe(900);
    expect(kpis.netSales).toBe(2500);
    expect(kpis.contributionProfit).toBe(1600); // 2500 - 900
    expect(kpis.cashReceived).toBe(2500);
    expect(kpis.accountsReceivablePending).toBe(0);
  });

  it('correctly calculates multi-product order totals, discounts, refunds, and contribution profit', () => {
    const orders: VoireOrder[] = [
      {
        id: 'ord_multi',
        orderNumber: 'VR-000002',
        orderDate: '2026-09-03T10:00:00Z',
        fulfillmentStatus: 'SHIPPED',
        paymentStatus: 'PAID',
        paidAt: '2026-09-03T10:00:00Z',
        subtotal: 4000,
        discountAmount: 500,
        shippingFee: 150,
        shippingCostActual: 120,
        totalAmount: 3650, // 4000 - 500 + 150
        refundAmount: 0,
        createdAt: '2026-09-03T10:00:00Z',
        updatedAt: '2026-09-03T10:00:00Z',
      },
      {
        id: 'ord_refunded',
        orderNumber: 'VR-000003',
        orderDate: '2026-09-04T10:00:00Z',
        fulfillmentStatus: 'CANCELLED',
        paymentStatus: 'REFUNDED',
        paidAt: '2026-09-04T10:00:00Z',
        subtotal: 1000,
        discountAmount: 0,
        shippingFee: 0,
        totalAmount: 1000,
        refundAmount: 1000,
        createdAt: '2026-09-04T10:00:00Z',
        updatedAt: '2026-09-04T12:00:00Z',
      },
    ];

    const orderItems: VoireOrderItem[] = [
      {
        id: 'item_m1',
        orderId: 'ord_multi',
        productId: 'prod_1',
        productName: 'Hoodie',
        productSku: 'HD-01',
        quantity: 1,
        unitPriceAtSale: 2500,
        unitProductionCostAtSale: 900,
        totalPrice: 2500,
      },
      {
        id: 'item_m2',
        orderId: 'ord_multi',
        productId: 'prod_2',
        productName: 'Tee',
        productSku: 'TE-01',
        quantity: 1,
        unitPriceAtSale: 1500,
        unitProductionCostAtSale: 400,
        totalPrice: 1500,
      },
      {
        id: 'item_ref',
        orderId: 'ord_refunded',
        productId: 'prod_2',
        productName: 'Tee',
        productSku: 'TE-01',
        quantity: 1,
        unitPriceAtSale: 1000,
        unitProductionCostAtSale: 400,
        totalPrice: 1000,
      },
    ];

    const campaigns: VoireMarketingCampaign[] = [
      {
        id: 'camp_meta',
        name: 'Meta IG Reels Drop 01',
        channel: 'META_ADS',
        campaignType: 'PAID_ACQUISITION',
        status: 'ACTIVE',
        spendAmount: 1200,
        impressions: 10000,
        clicks: 400,
        conversions: 1,
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      },
    ];

    const periods: VoireFinancialPeriod[] = [
      {
        id: 'per_1',
        periodName: 'Sept 2026',
        startDate: '2026-09-01T00:00:00Z',
        endDate: '2026-09-30T00:00:00Z',
        otherExpenses: 300,
        isClosed: false,
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      },
    ];

    const kpis = computeVoireKpiSummary([], [], [], orders, orderItems, campaigns, periods);

    expect(kpis.grossSales).toBe(5000); // 4000 + 1000
    expect(kpis.discounts).toBe(500);
    expect(kpis.refunds).toBe(1000);
    expect(kpis.netSales).toBe(3500); // 5000 - 500 - 1000
    expect(kpis.cogsProduction).toBe(1300); // 900 + 400 (ord_multi only, ord_refunded items excluded from COGS)
    expect(kpis.cogsShipping).toBe(120);
    expect(kpis.marketingSpend).toBe(1200);
    expect(kpis.otherExpenses).toBe(300);

    // Contribution profit = 3500 (net sales) - 1420 (cogs) - 1200 (marketing) - 300 (other) = 580
    expect(kpis.contributionProfit).toBe(580);
    expect(kpis.paidOrdersCount).toBe(1);
    expect(kpis.cashReceived).toBe(3650); // ord_multi paidAmount (net of refund on ord_refunded)
  });

  it('properly distinguishes cash received vs accounts receivable pending', () => {
    const orders: VoireOrder[] = [
      {
        id: 'ord_paid',
        orderNumber: 'VR-P',
        orderDate: '2026-09-05T10:00:00Z',
        fulfillmentStatus: 'DELIVERED',
        paymentStatus: 'PAID',
        paidAt: '2026-09-05T10:00:00Z',
        subtotal: 2000,
        discountAmount: 0,
        shippingFee: 0,
        totalAmount: 2000,
        createdAt: '2026-09-05T10:00:00Z',
        updatedAt: '2026-09-05T10:00:00Z',
      },
      {
        id: 'ord_pending',
        orderNumber: 'VR-A',
        orderDate: '2026-09-05T11:00:00Z',
        fulfillmentStatus: 'UNFULFILLED',
        paymentStatus: 'PENDING',
        subtotal: 1500,
        discountAmount: 0,
        shippingFee: 0,
        totalAmount: 1500,
        createdAt: '2026-09-05T11:00:00Z',
        updatedAt: '2026-09-05T11:00:00Z',
      },
    ];

    const kpis = computeVoireKpiSummary([], [], [], orders, [], [], []);
    expect(kpis.cashReceived).toBe(2000);
    expect(kpis.accountsReceivablePending).toBe(1500);
    expect(kpis.paidOrdersCount).toBe(1);
    expect(kpis.pendingOrdersCount).toBe(1);
  });

  it('determines the Weekend Creative Rule status correctly based on date parameter', () => {
    // Sunday: 2026-09-06
    const sundayDate = new Date(2026, 8, 6);
    const sundayKpis = computeVoireKpiSummary([], [], [], [], [], [], [], sundayDate);
    expect(sundayKpis.isWeekend).toBe(true);
    expect(sundayKpis.creativePauseExcused).toBe(false);

    // Wednesday: 2026-09-09
    const wednesdayDate = new Date(2026, 8, 9);
    const wednesdayKpis = computeVoireKpiSummary([], [], [], [], [], [], [], wednesdayDate);
    expect(wednesdayKpis.isWeekend).toBe(false);
    expect(wednesdayKpis.creativePauseExcused).toBe(true);
  });
});
