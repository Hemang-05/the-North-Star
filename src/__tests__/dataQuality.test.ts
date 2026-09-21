import { describe, it, expect } from 'vitest';
import { computeDataQualityReport } from '../services/dataQuality';
import type { FocusSession, ActivityEvent, Goal, AgencyInvoice, AgencyClient, AgencyProject, VoireOrder, VoireOrderItem, PeriodBounds } from '../types';

describe('Data Quality & Integrity Engine', () => {
  const period: PeriodBounds = {
    start: '2026-09-01T00:00:00.000Z',
    end: '2026-09-07T23:59:59.999Z',
    type: 'THIS_WEEK',
    label: 'This Week',
  };

  const now = new Date('2026-09-05T12:00:00.000Z');

  it('detects temporal anomalies: end before start, negative duration, and future dates', () => {
    const sessions: FocusSession[] = [
      {
        id: 'foc_1',
        pillarId: 'job_hunt',
        category: 'Applications',
        startedAt: '2026-09-05T10:00:00.000Z',
        endedAt: '2026-09-05T09:00:00.000Z', // Ended before started!
        durationSeconds: 1800,
        pausedSeconds: 0,
        status: 'STOPPED',
      },
      {
        id: 'foc_2',
        pillarId: 'agency',
        category: 'Client Work',
        startedAt: '2026-09-05T11:00:00.000Z',
        durationSeconds: -500, // Negative duration!
        pausedSeconds: 0,
        status: 'STOPPED',
      },
    ];

    const events: ActivityEvent[] = [
      {
        id: 'evt_future',
        pillarId: 'trading_os',
        eventType: 'SAAS_FEATURE_COMPLETED',
        occurredAt: '2026-09-15T00:00:00.000Z', // Far future date!
        createdAt: '2026-09-05T12:00:00.000Z',
        source: 'USER',
        quantity: 1,
        schemaVersion: 1,
      },
    ];

    const report = computeDataQualityReport({ events, sessions, goals: [], now }, period);

    const temporalIssues = report.issues.filter((i) => i.category === 'TEMPORAL_INTEGRITY');
    expect(temporalIssues.length).toBeGreaterThanOrEqual(3);
    expect(temporalIssues.some((i) => i.id.includes('end_before_start'))).toBe(true);
    expect(temporalIssues.some((i) => i.id.includes('negative_duration'))).toBe(true);
    expect(temporalIssues.some((i) => i.id.includes('future_dated'))).toBe(true);
  });

  it('correctly permits legitimate cross-midnight sessions without flagging false temporal errors', () => {
    const sessions: FocusSession[] = [
      {
        id: 'foc_sleep_overnight',
        pillarId: 'fitness',
        category: 'Sleep',
        startedAt: '2026-09-04T23:00:00.000Z', // 11 PM
        endedAt: '2026-09-05T07:00:00.000Z',   // 7 AM next day
        durationSeconds: 28800,
        pausedSeconds: 0,
        status: 'STOPPED',
      },
    ];

    const report = computeDataQualityReport({ events: [], sessions, goals: [], now }, period);
    const temporalIssues = report.issues.filter((i) => i.category === 'TEMPORAL_INTEGRITY');
    expect(temporalIssues.length).toBe(0);
  });

  it('detects invalid negative quantities, non-positive goal targets, and negative invoice amounts', () => {
    const events: ActivityEvent[] = [
      {
        id: 'evt_neg',
        pillarId: 'job_hunt',
        eventType: 'JOB_APPLICATION_SUBMITTED',
        occurredAt: '2026-09-05T10:00:00.000Z',
        createdAt: '2026-09-05T10:00:00.000Z',
        source: 'USER',
        quantity: -2, // Invalid negative quantity
        schemaVersion: 1,
      },
    ];

    const goals: Goal[] = [
      {
        id: 'goal_neg',
        pillarId: 'agency',
        title: 'Zero Target Goal',
        targetType: 'CURRENCY',
        targetValue: 0, // Target value must be positive
        currentComputedValue: 0,
        cadence: 'MONTHLY',
        weight: 100,
        isActive: true,
        createdAt: '2026-09-01T00:00:00.000Z',
      },
    ];

    const agencyInvoices: AgencyInvoice[] = [
      {
        id: 'inv_neg',
        clientId: 'client_1',
        projectId: 'proj_1',
        invoiceNumber: 'INV-NEG-1',
        amount: -5000, // Invalid negative amount
        currency: 'INR',
        status: 'SENT',
        issuedAt: '2026-09-01T00:00:00.000Z',
        dueDate: '2026-09-15',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      },
    ];

    const report = computeDataQualityReport(
      { events, sessions: [], goals, agencyInvoices, now },
      period
    );

    const validityIssues = report.issues.filter((i) => i.category === 'VALIDITY');
    expect(validityIssues.length).toBe(3);
    expect(validityIssues.some((i) => i.id.includes('negative_qty'))).toBe(true);
    expect(validityIssues.some((i) => i.id.includes('non_positive_target'))).toBe(true);
    expect(validityIssues.some((i) => i.id.includes('negative_amount'))).toBe(true);
  });

  it('detects referential integrity issues: orphaned client references and missing entity targets', () => {
    const agencyClients: AgencyClient[] = [
      {
        id: 'client_valid',
        name: 'Valid Client Corp',
        status: 'ACTIVE',
        lifetimeRevenue: 10000,
        startDate: '2026-09-01T00:00:00.000Z',
        acquisitionChannel: 'REFERRAL',
        icpScore: 80,
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      },
    ];

    const agencyProjects: AgencyProject[] = [
      {
        id: 'proj_orphan',
        clientId: 'client_non_existent', // Orphaned!
        name: 'Website Redesign',
        status: 'IN_PROGRESS',
        agreedAmount: 50000,
        receivedAmount: 0,
        currency: 'INR',
        hoursSpent: 0,
        startDate: '2026-09-01T00:00:00.000Z',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      },
    ];

    const voireOrders: VoireOrder[] = [];
    const voireOrderItems: VoireOrderItem[] = [
      {
        id: 'item_orphan',
        orderId: 'order_non_existent', // Orphaned!
        productId: 'prod_1',
        productName: 'Tee',
        unitPriceAtSale: 1200,
        unitProductionCostAtSale: 400,
        quantity: 1,
      },
    ];

    const report = computeDataQualityReport(
      {
        events: [],
        sessions: [],
        goals: [],
        agencyClients,
        agencyProjects,
        voireOrders,
        voireOrderItems,
        now,
      },
      period
    );

    const refIssues = report.issues.filter((i) => i.category === 'REFERENTIAL_INTEGRITY');
    expect(refIssues.length).toBe(2);
    expect(refIssues.some((i) => i.id.includes('missing_client'))).toBe(true);
    expect(refIssues.some((i) => i.id.includes('orphan_order_item'))).toBe(true);
  });

  it('detects duplicate focus sessions without flagging legitimate repeated activity', () => {
    const sessions: FocusSession[] = [
      // Exact identical session duplicated
      {
        id: 'foc_orig',
        pillarId: 'job_hunt',
        category: 'Applications',
        startedAt: '2026-09-05T14:00:00.000Z',
        durationSeconds: 1500,
        pausedSeconds: 0,
        status: 'STOPPED',
      },
      {
        id: 'foc_dupe',
        pillarId: 'job_hunt',
        category: 'Applications',
        startedAt: '2026-09-05T14:00:00.000Z',
        durationSeconds: 1500,
        pausedSeconds: 0,
        status: 'STOPPED',
      },
      // Legitimate separate session at another time
      {
        id: 'foc_legit_repeat',
        pillarId: 'job_hunt',
        category: 'Applications',
        startedAt: '2026-09-05T16:00:00.000Z',
        durationSeconds: 1500,
        pausedSeconds: 0,
        status: 'STOPPED',
      },
    ];

    const report = computeDataQualityReport({ events: [], sessions, goals: [], now }, period);

    const dupeIssues = report.issues.filter((i) => i.category === 'DUPLICATION');
    expect(dupeIssues.length).toBe(1);
    expect(dupeIssues[0].entityRef?.id).toBe('foc_dupe');
  });

  it('verifies Agency financial consistency invariant and flags mismatches', () => {
    // Invariant: billedRevenue (PAID + SENT + OVERDUE) - realizedCash (PAID) === accountsReceivable (SENT + OVERDUE)
    // Here we deliberately create an inconsistent state:
    const agencyInvoices: AgencyInvoice[] = [
      {
        id: 'inv_1',
        clientId: 'c1',
        projectId: 'p1',
        invoiceNumber: 'INV-101',
        amount: 50000,
        currency: 'INR',
        status: 'PAID',
        paidAt: '2026-09-03T12:00:00.000Z',
        issuedAt: '2026-09-01T00:00:00.000Z',
        dueDate: '2026-09-10',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      },
      {
        id: 'inv_2',
        clientId: 'c1',
        projectId: 'p1',
        invoiceNumber: 'INV-102',
        amount: 25000,
        currency: 'INR',
        status: 'PAID',
        // Missing paidAt on PAID invoice!
        issuedAt: '2026-09-02T00:00:00.000Z',
        dueDate: '2026-09-12',
        createdAt: '2026-09-02T00:00:00.000Z',
        updatedAt: '2026-09-02T00:00:00.000Z',
      },
    ];

    const report = computeDataQualityReport(
      { events: [], sessions: [], goals: [], agencyInvoices, now },
      period
    );

    const consistencyIssues = report.issues.filter((i) => i.category === 'CONSISTENCY');
    expect(consistencyIssues.length).toBe(1);
    expect(consistencyIssues[0].id).toContain('paid_invoice_no_date');
  });

  it('produces structured summary metrics without arbitrary 0-100 score', () => {
    const report = computeDataQualityReport({ events: [], sessions: [], goals: [], now }, period);

    expect(report.summary).toBeDefined();
    expect(typeof report.summary.totalIssues).toBe('number');
    expect(typeof report.summary.criticalCount).toBe('number');
    expect(typeof report.summary.warningCount).toBe('number');
    expect(report.summary.byCategory).toBeDefined();
    // Verify no arbitrary "score" or "cleanEntityRatio"
    expect((report as any).score).toBeUndefined();
    expect((report as any).cleanEntityRatio).toBeUndefined();
  });
});
