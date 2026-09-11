// ============================================================================
// PERSONAL OS — Data Quality & Integrity Engine
// Deterministic inspection of stored reality to ensure data trustworthiness.
//
// Axioms:
//   "Code calculates facts deterministically; AI interprets later."
//   "Missing data != zero. Legitimate repeated activities != duplicates."
//   "Strictly non-destructive: audits reality without mutating historical records."
// ============================================================================

import type {
  ActivityEvent,
  FocusSession,
  Goal,
  AgencyClient,
  AgencyProject,
  AgencyInvoice,
  VoireOrder,
  VoireOrderItem,
  PeriodBounds,
  TimePeriodType,
} from '../types';
import type {
  DataQualityCategory,
  DataQualityIssue,
  DataQualityReport,
} from '../types/layer5';
import { dbGetAll, STORES } from './db';
import { getPeriodBounds } from './timeAggregation';

export interface DataQualityInput {
  events: ActivityEvent[];
  sessions: FocusSession[];
  goals: Goal[];
  agencyClients?: AgencyClient[];
  agencyProjects?: AgencyProject[];
  agencyInvoices?: AgencyInvoice[];
  voireOrders?: VoireOrder[];
  voireOrderItems?: VoireOrderItem[];
  knownEntityIds?: Map<string, Set<string>>; // storeName/type -> Set of existing entity IDs
  now?: Date;
}

/**
 * Pure calculation function for Data Quality report.
 * Evaluates temporal integrity, validity, referential integrity,
 * duplication, consistency, and completeness.
 */
export function computeDataQualityReport(
  input: DataQualityInput,
  period: PeriodBounds
): DataQualityReport {
  const {
    events = [],
    sessions = [],
    goals = [],
    agencyClients = [],
    agencyProjects = [],
    agencyInvoices = [],
    voireOrders = [],
    voireOrderItems = [],
    knownEntityIds,
    now = new Date(),
  } = input;

  const issues: DataQualityIssue[] = [];
  const nowMs = now.getTime();
  const maxFutureAllowedMs = nowMs + 24 * 3600 * 1000; // Allow max 24 hours future skew for timezones

  // --------------------------------------------------------------------------
  // 1. TEMPORAL INTEGRITY
  // --------------------------------------------------------------------------
  for (const session of sessions) {
    const startTime = new Date(session.startedAt).getTime();
    if (isNaN(startTime)) {
      issues.push({
        id: `temporal:session:invalid_start:${session.id}`,
        category: 'TEMPORAL_INTEGRITY',
        severity: 'CRITICAL',
        pillarId: session.pillarId,
        entityRef: { type: 'FocusSession', id: session.id },
        title: 'Malformed Session Start Timestamp',
        description: `FocusSession ${session.id} contains unparseable startedAt "${session.startedAt}".`,
        evidence: [
          {
            sourceType: 'FOCUS_SESSION',
            sourceId: session.id,
            value: session.startedAt,
            period,
          },
        ],
      });
    }

    if (session.endedAt) {
      const endTime = new Date(session.endedAt).getTime();
      if (isNaN(endTime)) {
        issues.push({
          id: `temporal:session:invalid_end:${session.id}`,
          category: 'TEMPORAL_INTEGRITY',
          severity: 'CRITICAL',
          pillarId: session.pillarId,
          entityRef: { type: 'FocusSession', id: session.id },
          title: 'Malformed Session End Timestamp',
          description: `FocusSession ${session.id} contains unparseable endedAt "${session.endedAt}".`,
          evidence: [
            {
              sourceType: 'FOCUS_SESSION',
              sourceId: session.id,
              value: session.endedAt,
              period,
            },
          ],
        });
      } else if (endTime < startTime) {
        issues.push({
          id: `temporal:session:end_before_start:${session.id}`,
          category: 'TEMPORAL_INTEGRITY',
          severity: 'CRITICAL',
          pillarId: session.pillarId,
          entityRef: { type: 'FocusSession', id: session.id },
          title: 'Session End Precedes Start',
          description: `FocusSession ${session.id} ended before it started (${session.endedAt} < ${session.startedAt}).`,
          evidence: [
            {
              sourceType: 'FOCUS_SESSION',
              sourceId: session.id,
              value: `${session.startedAt} -> ${session.endedAt}`,
              period,
            },
          ],
        });
      }
    }

    if (session.durationSeconds < 0) {
      issues.push({
        id: `temporal:session:negative_duration:${session.id}`,
        category: 'TEMPORAL_INTEGRITY',
        severity: 'CRITICAL',
        pillarId: session.pillarId,
        entityRef: { type: 'FocusSession', id: session.id },
        title: 'Negative Focus Session Duration',
        description: `FocusSession ${session.id} has impossible negative duration (${session.durationSeconds}s).`,
        evidence: [
          {
            sourceType: 'FOCUS_SESSION',
            sourceId: session.id,
            value: session.durationSeconds,
            period,
          },
        ],
      });
    }
  }

  for (const event of events) {
    const occurredTime = new Date(event.occurredAt).getTime();
    if (isNaN(occurredTime)) {
      issues.push({
        id: `temporal:event:invalid_occurred:${event.id}`,
        category: 'TEMPORAL_INTEGRITY',
        severity: 'CRITICAL',
        pillarId: event.pillarId,
        entityRef: { type: 'ActivityEvent', id: event.id },
        title: 'Malformed Event Timestamp',
        description: `ActivityEvent ${event.id} contains unparseable occurredAt "${event.occurredAt}".`,
        evidence: [
          {
            sourceType: 'ACTIVITY_EVENT',
            sourceId: event.id,
            value: event.occurredAt,
            period,
          },
        ],
      });
    } else if (occurredTime > maxFutureAllowedMs) {
      issues.push({
        id: `temporal:event:future_dated:${event.id}`,
        category: 'TEMPORAL_INTEGRITY',
        severity: 'WARNING',
        pillarId: event.pillarId,
        entityRef: { type: 'ActivityEvent', id: event.id },
        title: 'Future-Dated Activity Event',
        description: `ActivityEvent ${event.id} occurredAt is dated more than 24h into the future (${event.occurredAt}).`,
        evidence: [
          {
            sourceType: 'ACTIVITY_EVENT',
            sourceId: event.id,
            value: event.occurredAt,
            period,
          },
        ],
      });
    }
  }

  // --------------------------------------------------------------------------
  // 2. VALIDITY
  // --------------------------------------------------------------------------
  for (const event of events) {
    if (event.quantity < 0) {
      issues.push({
        id: `validity:event:negative_qty:${event.id}`,
        category: 'VALIDITY',
        severity: 'WARNING',
        pillarId: event.pillarId,
        entityRef: { type: 'ActivityEvent', id: event.id },
        title: 'Negative Event Quantity',
        description: `ActivityEvent ${event.id} (${event.eventType}) has invalid negative quantity (${event.quantity}).`,
        evidence: [
          {
            sourceType: 'ACTIVITY_EVENT',
            sourceId: event.id,
            value: event.quantity,
            period,
          },
        ],
      });
    }
  }

  for (const goal of goals) {
    if (goal.targetValue <= 0) {
      issues.push({
        id: `validity:goal:non_positive_target:${goal.id}`,
        category: 'VALIDITY',
        severity: 'WARNING',
        pillarId: goal.pillarId || undefined,
        entityRef: { type: 'Goal', id: goal.id },
        title: 'Non-Positive Goal Target',
        description: `Goal "${goal.title}" (${goal.id}) has non-positive target value (${goal.targetValue}). Targets must be strictly positive.`,
        evidence: [
          {
            sourceType: 'GOAL',
            sourceId: goal.id,
            value: goal.targetValue,
            period,
          },
        ],
      });
    }
  }

  for (const invoice of agencyInvoices) {
    if (invoice.amount < 0) {
      issues.push({
        id: `validity:invoice:negative_amount:${invoice.id}`,
        category: 'VALIDITY',
        severity: 'CRITICAL',
        pillarId: 'agency',
        entityRef: { type: 'AgencyInvoice', id: invoice.id },
        title: 'Negative Invoice Amount',
        description: `AgencyInvoice ${invoice.invoiceNumber || invoice.id} has negative amount (${invoice.amount}).`,
        evidence: [
          {
            sourceType: 'KPI',
            sourceId: invoice.id,
            value: invoice.amount,
            period,
          },
        ],
      });
    }
  }

  // --------------------------------------------------------------------------
  // 3. REFERENTIAL INTEGRITY
  // --------------------------------------------------------------------------
  const clientIds = new Set(agencyClients.map((c) => c.id));
  const orderIds = new Set(voireOrders.map((o) => o.id));

  for (const project of agencyProjects) {
    if (project.clientId && !clientIds.has(project.clientId)) {
      issues.push({
        id: `referential:project:missing_client:${project.id}`,
        category: 'REFERENTIAL_INTEGRITY',
        severity: 'WARNING',
        pillarId: 'agency',
        entityRef: { type: 'AgencyProject', id: project.id },
        title: 'Orphaned Agency Project Client Reference',
        description: `Project "${project.name}" references non-existent clientId "${project.clientId}".`,
        evidence: [
          {
            sourceType: 'DATA_QUALITY',
            sourceId: project.id,
            value: project.clientId,
            period,
          },
        ],
      });
    }
  }

  for (const invoice of agencyInvoices) {
    if (invoice.clientId && !clientIds.has(invoice.clientId)) {
      issues.push({
        id: `referential:invoice:missing_client:${invoice.id}`,
        category: 'REFERENTIAL_INTEGRITY',
        severity: 'WARNING',
        pillarId: 'agency',
        entityRef: { type: 'AgencyInvoice', id: invoice.id },
        title: 'Orphaned Agency Invoice Client Reference',
        description: `Invoice "${invoice.invoiceNumber}" references non-existent clientId "${invoice.clientId}".`,
        evidence: [
          {
            sourceType: 'DATA_QUALITY',
            sourceId: invoice.id,
            value: invoice.clientId,
            period,
          },
        ],
      });
    }
  }

  for (const item of voireOrderItems) {
    if (item.orderId && !orderIds.has(item.orderId)) {
      issues.push({
        id: `referential:voire:orphan_order_item:${item.id}`,
        category: 'REFERENTIAL_INTEGRITY',
        severity: 'CRITICAL',
        pillarId: 'voire',
        entityRef: { type: 'VoireOrderItem', id: item.id },
        title: 'Orphaned VOIRE Order Item',
        description: `OrderItem ${item.id} references non-existent orderId "${item.orderId}".`,
        evidence: [
          {
            sourceType: 'DATA_QUALITY',
            sourceId: item.id,
            value: item.orderId,
            period,
          },
        ],
      });
    }
  }

  if (knownEntityIds) {
    for (const event of events) {
      if (event.entityRef && event.entityRef.type && event.entityRef.id) {
        const storeSet = knownEntityIds.get(event.entityRef.type);
        if (storeSet && !storeSet.has(event.entityRef.id)) {
          issues.push({
            id: `referential:event:orphan_entity:${event.id}`,
            category: 'REFERENTIAL_INTEGRITY',
            severity: 'WARNING',
            pillarId: event.pillarId,
            entityRef: { type: 'ActivityEvent', id: event.id },
            title: 'Orphaned Activity Event Entity Reference',
            description: `ActivityEvent ${event.id} (${event.eventType}) references non-existent ${event.entityRef.type} "${event.entityRef.id}".`,
            evidence: [
              {
                sourceType: 'ACTIVITY_EVENT',
                sourceId: event.id,
                value: `${event.entityRef.type}:${event.entityRef.id}`,
                period,
              },
            ],
          });
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // 4. DUPLICATION DETECTION
  // --------------------------------------------------------------------------
  // Check for exact identical FocusSessions (same pillar, category, startedAt, durationSeconds > 0)
  const sessionFingerprints = new Map<string, FocusSession>();
  for (const session of sessions) {
    if (session.durationSeconds > 0 && session.startedAt) {
      const fp = `${session.pillarId}|${session.category}|${session.startedAt}|${session.durationSeconds}`;
      const existing = sessionFingerprints.get(fp);
      if (existing && existing.id !== session.id) {
        issues.push({
          id: `duplication:session:${session.id}`,
          category: 'DUPLICATION',
          severity: 'WARNING',
          pillarId: session.pillarId,
          entityRef: { type: 'FocusSession', id: session.id },
          title: 'Duplicate Focus Session Record',
          description: `FocusSession ${session.id} is an exact duplicate of ${existing.id} (${session.pillarId}, ${session.category}, ${session.durationSeconds}s at ${session.startedAt}).`,
          evidence: [
            {
              sourceType: 'FOCUS_SESSION',
              sourceId: session.id,
              value: `${existing.id} <-> ${session.id}`,
              period,
            },
          ],
        });
      } else {
        sessionFingerprints.set(fp, session);
      }
    }
  }

  // Check for duplicate invoice numbers
  const invoiceNumberMap = new Map<string, AgencyInvoice>();
  for (const inv of agencyInvoices) {
    if (inv.invoiceNumber && inv.invoiceNumber.trim()) {
      const num = inv.invoiceNumber.trim().toUpperCase();
      const existing = invoiceNumberMap.get(num);
      if (existing && existing.id !== inv.id) {
        issues.push({
          id: `duplication:invoice:${inv.id}`,
          category: 'DUPLICATION',
          severity: 'CRITICAL',
          pillarId: 'agency',
          entityRef: { type: 'AgencyInvoice', id: inv.id },
          title: 'Duplicate Invoice Number',
          description: `Invoice ${inv.id} has duplicate invoiceNumber "${num}" matching invoice ${existing.id}.`,
          evidence: [
            {
              sourceType: 'KPI',
              sourceId: inv.id,
              value: num,
              period,
            },
          ],
        });
      } else {
        invoiceNumberMap.set(num, inv);
      }
    }
  }

  // --------------------------------------------------------------------------
  // 5. FINANCIAL & LOGICAL CONSISTENCY
  // --------------------------------------------------------------------------
  // Agency financial invariant: billedRevenue - realizedCash === accountsReceivable
  if (agencyInvoices.length > 0) {
    let billedRevenue = 0;
    let realizedCash = 0;
    let accountsReceivable = 0;

    for (const inv of agencyInvoices) {
      if (inv.status === 'PAID') {
        billedRevenue += inv.amount;
        realizedCash += inv.amount;
        if (!inv.paidAt) {
          issues.push({
            id: `consistency:agency:paid_invoice_no_date:${inv.id}`,
            category: 'CONSISTENCY',
            severity: 'WARNING',
            pillarId: 'agency',
            entityRef: { type: 'AgencyInvoice', id: inv.id },
            title: 'Paid Invoice Missing Paid Date',
            description: `Invoice ${inv.invoiceNumber || inv.id} is marked PAID but has no paidAt timestamp.`,
            evidence: [
              {
                sourceType: 'KPI',
                sourceId: inv.id,
                value: inv.status,
                period,
              },
            ],
          });
        }
      } else if (inv.status === 'SENT' || inv.status === 'OVERDUE') {
        billedRevenue += inv.amount;
        accountsReceivable += inv.amount;
      }
    }

    const calculatedAr = billedRevenue - realizedCash;
    const diff = Math.abs(calculatedAr - accountsReceivable);
    if (diff > 0.01) {
      issues.push({
        id: `consistency:agency:ar_invariant_mismatch`,
        category: 'CONSISTENCY',
        severity: 'CRITICAL',
        pillarId: 'agency',
        title: 'Agency Financial Invariant Mismatch',
        description: `Billed Revenue (${billedRevenue}) - Realized Cash (${realizedCash}) does not equal Accounts Receivable (${accountsReceivable}). Variance: ${diff.toFixed(2)}.`,
        evidence: [
          {
            sourceType: 'KPI',
            sourceId: 'agency.financials',
            value: `billed: ${billedRevenue}, realized: ${realizedCash}, ar: ${accountsReceivable}`,
            period,
          },
        ],
      });
    }
  }

  // VOIRE order consistency: check if line items match order totalAmount
  if (voireOrders.length > 0 && voireOrderItems.length > 0) {
    const itemsByOrder = new Map<string, VoireOrderItem[]>();
    for (const item of voireOrderItems) {
      const list = itemsByOrder.get(item.orderId) || [];
      list.push(item);
      itemsByOrder.set(item.orderId, list);
    }

    for (const order of voireOrders) {
      const items = itemsByOrder.get(order.id);
      if (items && items.length > 0) {
        let itemsGross = 0;
        for (const item of items) {
          const qty = item.quantity ?? item.units ?? 1;
          itemsGross += (item.unitPriceAtSale || 0) * qty;
        }

        const expectedTotal = order.totalAmount ?? order.subtotal ?? 0;
        const diff = Math.abs(itemsGross - expectedTotal);
        if (expectedTotal > 0 && diff > 1.0) {
          issues.push({
            id: `consistency:voire:order_line_item_mismatch:${order.id}`,
            category: 'CONSISTENCY',
            severity: 'WARNING',
            pillarId: 'voire',
            entityRef: { type: 'VoireOrder', id: order.id },
            title: 'VOIRE Order Items Sum Mismatch',
            description: `Order ${order.orderNumber || order.id} stated total (${expectedTotal}) differs from sum of line items (${itemsGross.toFixed(2)}).`,
            evidence: [
              {
                sourceType: 'KPI',
                sourceId: order.id,
                value: `stated: ${expectedTotal}, items: ${itemsGross}`,
                period,
              },
            ],
          });
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // 6. COMPLETENESS
  // --------------------------------------------------------------------------
  for (const goal of goals) {
    if (!goal.title || !goal.title.trim()) {
      issues.push({
        id: `completeness:goal:missing_title:${goal.id}`,
        category: 'COMPLETENESS',
        severity: 'WARNING',
        pillarId: goal.pillarId || undefined,
        entityRef: { type: 'Goal', id: goal.id },
        title: 'Goal Missing Title',
        description: `Goal ${goal.id} is missing a descriptive title.`,
        evidence: [
          {
            sourceType: 'GOAL',
            sourceId: goal.id,
            value: goal.id,
            period,
          },
        ],
      });
    }
  }

  // --------------------------------------------------------------------------
  // Summary Aggregations
  // --------------------------------------------------------------------------
  let criticalCount = 0;
  let warningCount = 0;
  let infoCount = 0;

  const byCategory: Record<DataQualityCategory, number> = {
    COMPLETENESS: 0,
    VALIDITY: 0,
    CONSISTENCY: 0,
    DUPLICATION: 0,
    REFERENTIAL_INTEGRITY: 0,
    TEMPORAL_INTEGRITY: 0,
  };

  for (const issue of issues) {
    if (issue.severity === 'CRITICAL') criticalCount++;
    else if (issue.severity === 'WARNING') warningCount++;
    else infoCount++;

    byCategory[issue.category] = (byCategory[issue.category] || 0) + 1;
  }

  return {
    period,
    issues,
    checkedAt: now.toISOString(),
    summary: {
      totalIssues: issues.length,
      criticalCount,
      warningCount,
      infoCount,
      byCategory,
    },
  };
}

/**
 * Service function to load authoritative IndexedDB records and compute
 * the current DataQualityReport.
 */
export async function runDataQualityCheck(
  periodType: TimePeriodType = 'THIS_WEEK',
  refDate: Date = new Date()
): Promise<DataQualityReport> {
  const { current: period } = getPeriodBounds(periodType, refDate);

  const [
    events,
    sessions,
    goals,
    agencyClients,
    agencyProjects,
    agencyInvoices,
    voireOrders,
    voireOrderItems,
    jobOpps,
    jobApps,
    saasFeatures,
  ] = await Promise.all([
    dbGetAll<ActivityEvent>(STORES.EVENTS),
    dbGetAll<FocusSession>(STORES.FOCUS_SESSIONS),
    dbGetAll<Goal>(STORES.GOALS),
    dbGetAll<AgencyClient>(STORES.AGENCY_CLIENTS),
    dbGetAll<AgencyProject>(STORES.AGENCY_PROJECTS),
    dbGetAll<AgencyInvoice>(STORES.AGENCY_INVOICES),
    dbGetAll<VoireOrder>(STORES.VOIRE_ORDERS),
    dbGetAll<VoireOrderItem>(STORES.VOIRE_ORDER_ITEMS),
    dbGetAll<{ id: string }>(STORES.JOB_OPPORTUNITIES),
    dbGetAll<{ id: string }>(STORES.JOB_APPLICATIONS),
    dbGetAll<{ id: string }>(STORES.SAAS_FEATURES),
  ]);

  const knownEntityIds = new Map<string, Set<string>>();
  knownEntityIds.set('AgencyClient', new Set(agencyClients.map((c) => c.id)));
  knownEntityIds.set('AgencyProject', new Set(agencyProjects.map((p) => p.id)));
  knownEntityIds.set('AgencyInvoice', new Set(agencyInvoices.map((i) => i.id)));
  knownEntityIds.set('VoireOrder', new Set(voireOrders.map((o) => o.id)));
  knownEntityIds.set('Goal', new Set(goals.map((g) => g.id)));
  knownEntityIds.set('FocusSession', new Set(sessions.map((s) => s.id)));
  knownEntityIds.set('JobOpportunity', new Set(jobOpps.map((o) => o.id)));
  knownEntityIds.set('JobApplication', new Set(jobApps.map((a) => a.id)));
  knownEntityIds.set('SaasFeature', new Set(saasFeatures.map((f) => f.id)));

  return computeDataQualityReport(
    {
      events,
      sessions,
      goals,
      agencyClients,
      agencyProjects,
      agencyInvoices,
      voireOrders,
      voireOrderItems,
      knownEntityIds,
      now: refDate,
    },
    period
  );
}
