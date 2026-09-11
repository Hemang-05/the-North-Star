// ============================================================================
// PERSONAL OS — VOIRE Deterministic KPI Calculation Engine
// Single source of financial and creative truth for Pillar 6 (D2C / POD Brand).
// 
// Axioms:
//   "I record reality. The system compares reality with my goals. AI interprets the gap."
//   "Code calculates. AI judges and explains."
// ============================================================================

import type {
  VoireDesign,
  VoireProduct,
  VoireDrop,
  VoireOrder,
  VoireOrderItem,
  VoireMarketingCampaign,
  VoireFinancialPeriod,
  VoireKpiSummary,
  FocusSession,
} from '../types';
import { dbGetAll, STORES } from './db';

/**
 * Authoritative check if a date is a Saturday or Sunday in the user's local timezone.
 * Calendar day is the sole authority; arbitrary flags cannot override reality.
 */
export function isWeekendCalendarDay(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return false;
  const day = d.getDay(); // 0 = Sunday, 6 = Saturday
  return day === 0 || day === 6;
}

export interface VoireKpiInput {
  designs: VoireDesign[];
  products: VoireProduct[];
  drops: VoireDrop[];
  orders: VoireOrder[];
  orderItems: VoireOrderItem[];
  campaigns: VoireMarketingCampaign[];
  financialPeriods?: VoireFinancialPeriod[];
  focusSessions?: FocusSession[];
  otherExpenses?: number;
  now?: Date;
}

/**
 * Deterministically compute all VOIRE KPIs from authoritative underlying transactional records.
 */
export function computeVoireKpis(input: VoireKpiInput): VoireKpiSummary {
  const {
    designs,
    products,
    drops,
    orders,
    orderItems,
    campaigns,
    financialPeriods = [],
    focusSessions = [],
    otherExpenses: explicitOtherExpenses,
    now = new Date(),
  } = input;

  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  // Weekend Creative Rule
  const isWeekend = isWeekendCalendarDay(now);
  const creativePauseExcused = !isWeekend;

  // --------------------------------------------------------------------------
  // 1. Creative / Production Metrics
  // --------------------------------------------------------------------------
  const totalDesigns = designs.length;
  const totalIdeas = designs.filter((d) => d.stage === 'IDEA' || d.stage === 'CONCEPT').length;
  const approvedDesigns = designs.filter(
    (d) => d.stage === 'APPROVED' || d.status === 'SAMPLE_APPROVED' || d.status === 'READY_FOR_DROP' || d.status === 'READY'
  ).length;
  const readyOrSampledDesigns = approvedDesigns;
  const designsInProgress = designs.filter(
    (d) => d.stage === 'DESIGNING' || d.stage === 'MOCKUP' || d.stage === 'SAMPLE' || d.status === 'SAMPLING'
  ).length;

  let weekendCreativeSessionsCount = 0;
  let weekendCreativeSeconds = 0;
  let weekendOutputLast14Days = 0;

  for (const d of designs) {
    const dDate = new Date(d.createdAt);
    if (isWeekendCalendarDay(dDate)) {
      if (dDate >= fourteenDaysAgo && dDate <= now) {
        weekendOutputLast14Days++;
      }
    }
  }

  for (const s of focusSessions) {
    if (s.pillarId === 'voire') {
      const sDate = new Date(s.startedAt);
      if (isWeekendCalendarDay(sDate) && sDate >= fourteenDaysAgo && sDate <= now) {
        weekendCreativeSessionsCount++;
        weekendCreativeSeconds += s.durationSeconds || 0;
      }
    }
  }
  const weekendCreativeMinutes = Math.round(weekendCreativeSeconds / 60);

  // --------------------------------------------------------------------------
  // 2. Products & Drops
  // --------------------------------------------------------------------------
  const totalProducts = products.length;
  const activeProducts = products.filter((p) => p.status === 'ACTIVE' || p.status === 'LIVE' || p.status === 'READY').length;
  const liveProducts = activeProducts;

  const totalDrops = drops.length;
  const activeDrops = drops.filter((d) => d.status === 'LIVE' || d.status === 'SCHEDULED').length;
  const liveDrops = drops.filter((d) => d.status === 'LIVE').length;
  const completedDrops = drops.filter((d) => d.status === 'ENDED').length;

  // --------------------------------------------------------------------------
  // 3. Commercial Orders & Authoritative P&L Calculations
  // --------------------------------------------------------------------------
  const itemsByOrder = new Map<string, VoireOrderItem[]>();
  for (const item of orderItems) {
    const existing = itemsByOrder.get(item.orderId) || [];
    existing.push(item);
    itemsByOrder.set(item.orderId, existing);
  }

  const totalOrders = orders.length;

  let ordersThisWeek = 0;
  let totalUnitsSold = 0;
  let grossSales = 0;
  let discounts = 0;
  let refunds = 0;
  let refundCount = 0;
  let cogsProduction = 0;
  let cogsShipping = 0;
  let cashReceived = 0;
  let accountsReceivablePending = 0;
  let paidOrdersCount = 0;
  let pendingOrdersCount = 0;

  for (const order of orders) {
    const oDate = new Date(order.orderedAt || order.orderDate || order.createdAt);
    if (oDate >= startOfWeek && oDate <= now) {
      ordersThisWeek++;
    }

    const items = itemsByOrder.get(order.id) || [];
    let orderItemsGross = 0;
    let orderItemsCogs = 0;
    let orderItemDiscounts = 0;
    let orderItemRefunds = 0;

    for (const item of items) {
      const units = item.quantity ?? item.units ?? 1;
      totalUnitsSold += units;

      const itemGross = (item.unitPriceAtSale || 0) * units;
      orderItemsGross += itemGross;

      // MANDATORY HISTORICAL INVARIANCE: Uses unitProductionCostAtSale snapshot
      const itemCogs = (item.unitProductionCostAtSale || 0) * units;
      orderItemsCogs += itemCogs;

      orderItemDiscounts += item.lineDiscount || 0;
      orderItemRefunds += item.lineRefund || 0;
    }

    // Order gross: items gross or order subtotal/totalAmount
    const orderGross = items.length > 0 ? orderItemsGross : (order.subtotal || order.totalAmount || 0);
    grossSales += orderGross;

    const ordDisc = (order.discountAmount || order.orderDiscount || 0) + orderItemDiscounts;
    const ordRef = (order.refundAmount || order.orderRefund || 0) + orderItemRefunds;
    discounts += ordDisc;

    if (order.paymentStatus === 'REFUNDED') {
      const effectiveRef = ordRef > 0 ? ordRef : (order.totalAmount || orderGross);
      refunds += effectiveRef;
      refundCount++;
    } else {
      refunds += ordRef;
      if (ordRef > 0) refundCount++;
    }

    // Only non-cancelled, non-refunded orders contribute to active COGS
    if (order.status !== 'CANCELLED' && order.fulfillmentStatus !== 'CANCELLED' && order.paymentStatus !== 'REFUNDED') {
      cogsProduction += orderItemsCogs;
      cogsShipping += (order.shippingCostActual || 0);
    }

    // Cash Accounting breakdown based on paymentStatus
    if (order.paymentStatus === 'PAID') {
      paidOrdersCount++;
      const netPaid = Math.max(0, (order.totalAmount || orderGross) - ordRef);
      cashReceived += netPaid;
    } else if (order.paymentStatus === 'PENDING') {
      pendingOrdersCount++;
      accountsReceivablePending += (order.totalAmount || orderGross);
    } else if (order.paymentStatus === 'PARTIALLY_REFUNDED') {
      paidOrdersCount++;
      const netPaid = Math.max(0, (order.totalAmount || orderGross) - ordRef);
      cashReceived += netPaid;
    }
  }

  const netSales = Math.max(0, grossSales - discounts - refunds);
  const totalCogs = cogsProduction + cogsShipping;

  // Single source of truth for marketing spend
  const marketingSpend = campaigns.reduce((acc, c) => acc + (c.spendAmount || 0), 0);

  // Other expenses from periods or input
  const periodsExpense = financialPeriods.reduce((acc, p) => acc + (p.otherExpenses || 0), 0);
  const otherExpenses = explicitOtherExpenses !== undefined ? explicitOtherExpenses : periodsExpense;

  // Contribution profit = Net Sales - Total COGS - Marketing Spend - Other Expenses
  const contributionProfit = netSales - totalCogs - marketingSpend - otherExpenses;
  const contributionMarginPercent = netSales > 0 ? (contributionProfit / netSales) * 100 : 0;

  const aov = paidOrdersCount > 0 ? Number((netSales / paidOrdersCount).toFixed(2)) : (totalOrders > 0 ? Number((netSales / totalOrders).toFixed(2)) : 0);
  const roas = marketingSpend > 0 ? Number((netSales / marketingSpend).toFixed(2)) : 0;
  const cac = paidOrdersCount > 0 ? Number((marketingSpend / paidOrdersCount).toFixed(2)) : 0;

  // Marketing metrics
  const campaignsCount = campaigns.length;
  const totalImpressions = campaigns.reduce((acc, c) => acc + (c.impressions || 0), 0);
  const totalClicks = campaigns.reduce((acc, c) => acc + (c.clicks || 0), 0);
  const totalConversions = campaigns.reduce((acc, c) => acc + (c.conversions || 0), 0);
  const overallCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const overallCvr = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;

  return {
    totalDesigns,
    readyOrSampledDesigns,
    totalIdeas,
    approvedDesigns,
    designsInProgress,
    weekendCreativeSessionsCount,
    weekendCreativeMinutes,
    weekendOutputLast14Days,

    activeProducts,
    totalProducts,
    liveProducts,
    activeDrops,
    totalDrops,
    liveDrops,
    completedDrops,

    totalOrders,
    paidOrdersCount,
    pendingOrdersCount,
    ordersThisWeek,
    totalUnitsSold,
    grossSales,
    discounts,
    refunds,
    refundCount,
    netSales,
    cogsProduction,
    cogsShipping,
    totalCogs,
    marketingSpend,
    otherExpenses,
    contributionProfit,
    contributionMarginPercent,
    cashReceived,
    accountsReceivablePending,
    aov,
    roas,
    cac,

    campaignsCount,
    totalImpressions,
    totalClicks,
    totalConversions,
    overallCtr,
    overallCvr,

    isWeekend,
    creativePauseExcused,

    // Backward compatibility aliases
    merchandiseGrossSales: grossSales,
    totalDiscounts: discounts,
    totalRefunds: refunds,
    netMerchandiseSales: netSales,
    shippingRevenueTotal: orders.reduce((sum, o) => sum + (o.shippingFee || o.shippingCharged || 0), 0),
    netCustomerRevenue: netSales,
    cashReceivedTotal: cashReceived,
    cashRefundOutflowTotal: refunds,
    accountsReceivableTotal: accountsReceivablePending,
    productionCogsTotal: cogsProduction,
    grossProfitTotal: netSales - totalCogs,
    fulfillmentExpenseTotal: cogsShipping,
    platformFeesTotal: orders.reduce((sum, o) => sum + (o.platformFee || 0), 0),
    marketingSpendTotal: marketingSpend,
    netContributionProfit: contributionProfit,
    averageOrderValue: aov,
    overallGrossMarginPct: contributionMarginPercent,
  };
}

/**
 * Universal functional wrapper supporting positional arguments for tests and scripts.
 */
export function computeVoireKpiSummary(
  designs: VoireDesign[],
  products: VoireProduct[],
  drops: VoireDrop[],
  orders: VoireOrder[],
  orderItems: VoireOrderItem[],
  campaigns: VoireMarketingCampaign[],
  financialPeriods?: VoireFinancialPeriod[],
  now?: Date
): VoireKpiSummary {
  return computeVoireKpis({
    designs,
    products,
    drops,
    orders,
    orderItems,
    campaigns,
    financialPeriods,
    now,
  });
}

/**
 * Load all VOIRE stores from IndexedDB and compute the authoritative KPI summary.
 */
export async function loadVoireKpiSummary(now = new Date()): Promise<VoireKpiSummary> {
  const [designs, products, drops, orders, orderItems, campaigns, financialPeriods, focusSessions] =
    await Promise.all([
      dbGetAll<VoireDesign>(STORES.VOIRE_DESIGNS),
      dbGetAll<VoireProduct>(STORES.VOIRE_PRODUCTS),
      dbGetAll<VoireDrop>(STORES.VOIRE_DROPS),
      dbGetAll<VoireOrder>(STORES.VOIRE_ORDERS),
      dbGetAll<VoireOrderItem>(STORES.VOIRE_ORDER_ITEMS),
      dbGetAll<VoireMarketingCampaign>(STORES.VOIRE_MARKETING),
      dbGetAll<VoireFinancialPeriod>(STORES.VOIRE_FINANCIAL_PERIODS),
      dbGetAll<FocusSession>(STORES.FOCUS_SESSIONS),
    ]);

  return computeVoireKpis({
    designs,
    products,
    drops,
    orders,
    orderItems,
    campaigns,
    financialPeriods,
    focusSessions,
    now,
  });
}
