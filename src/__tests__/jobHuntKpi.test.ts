import { describe, it, expect } from 'vitest';
import { calculateJobHuntKpis } from '../services/jobHuntKpi';
import type {
  JobOpportunity,
  JobApplication,
  JobOutreach,
  CareerCapital,
  FocusSession,
  ActivityEvent,
} from '../types';

describe('Job Hunt KPI Engine', () => {
  it('calculates KPIs correctly with empty data without division by zero', () => {
    const kpis = calculateJobHuntKpis({
      opportunities: [],
      applications: [],
      outreaches: [],
      assets: [],
      focusSessions: [],
      events: [],
    });

    expect(kpis.totalOpportunities).toBe(0);
    expect(kpis.activeOpportunities).toBe(0);
    expect(kpis.archivedOpportunities).toBe(0);
    expect(kpis.totalApplications).toBe(0);
    expect(kpis.totalOutreach).toBe(0);
    expect(kpis.responseRate).toBeNull(); // Not 0%, but null (N/A)
    expect(kpis.interviewConversionRate).toBeNull();
    expect(kpis.offerConversionRate).toBeNull();
    expect(kpis.focusTimeTotalSeconds).toBe(0);
    expect(kpis.daysActiveThisWeek).toBe(0);
  });

  it('correctly calculates pipeline distribution, conversion rates, and response rates', () => {
    const nowIso = new Date().toISOString();

    const opportunities: JobOpportunity[] = [
      {
        id: 'opp-1',
        company: 'Stripe',
        role: 'Staff Engineer',
        source: 'Referral',
        discoveredAt: nowIso,
        workMode: 'REMOTE',
        stage: 'INTERVIEW',
        currency: 'INR',
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'opp-2',
        company: 'Razorpay',
        role: 'Tech Lead',
        source: 'LinkedIn',
        discoveredAt: nowIso,
        workMode: 'HYBRID',
        stage: 'OFFER',
        currency: 'INR',
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'opp-3',
        company: 'OldCo',
        role: 'Dev',
        source: 'Indeed',
        discoveredAt: nowIso,
        workMode: 'ONSITE',
        stage: 'REJECTED',
        currency: 'INR',
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ];

    const applications: JobApplication[] = [
      {
        id: 'app-1',
        opportunityId: 'opp-1',
        company: 'Stripe',
        role: 'Staff Engineer',
        appliedAt: nowIso,
        method: 'Referral',
        customizationLevel: 'DEEP',
      },
      {
        id: 'app-2',
        opportunityId: 'opp-2',
        company: 'Razorpay',
        role: 'Tech Lead',
        appliedAt: nowIso,
        method: 'LinkedIn',
        customizationLevel: 'TAILORED',
      },
      {
        id: 'app-3',
        opportunityId: 'opp-3',
        company: 'OldCo',
        role: 'Dev',
        appliedAt: nowIso,
        method: 'Indeed',
        customizationLevel: 'QUICK',
      },
      {
        id: 'app-4',
        opportunityId: 'opp-4',
        company: 'OtherCo',
        role: 'Dev',
        appliedAt: nowIso,
        method: 'Site',
        customizationLevel: 'QUICK',
      },
    ];

    const outreaches: JobOutreach[] = [
      {
        id: 'out-1',
        contactName: 'Jane Doe',
        contactType: 'FOUNDER',
        channel: 'LINKEDIN',
        sentAt: nowIso,
        repliedAt: nowIso,
        followUpCount: 0,
      },
      {
        id: 'out-2',
        contactName: 'John Smith',
        contactType: 'RECRUITER',
        channel: 'EMAIL',
        sentAt: nowIso,
        followUpCount: 1,
      },
    ];

    const focusSessions: FocusSession[] = [
      {
        id: 'foc-1',
        pillarId: 'job_hunt',
        category: 'Applications',
        startedAt: nowIso,
        durationSeconds: 3600,
        pausedSeconds: 0,
        status: 'STOPPED',
      },
      {
        id: 'foc-2',
        pillarId: 'agency', // Different pillar, must be ignored
        category: 'Client Work',
        startedAt: nowIso,
        durationSeconds: 1800,
        pausedSeconds: 0,
        status: 'STOPPED',
      },
    ];

    const assets: CareerCapital[] = [
      {
        id: 'ast-1',
        assetType: 'PORTFOLIO_PROJECT',
        title: 'Distributed KV Store',
        status: 'ACTIVE',
        lastUpdatedAt: nowIso,
      },
      {
        id: 'ast-2',
        assetType: 'RESUME_VERSION',
        title: 'Senior Systems Resume',
        status: 'IN_PROGRESS',
        lastUpdatedAt: nowIso,
      },
    ];

    const kpis = calculateJobHuntKpis({
      opportunities,
      applications,
      outreaches,
      assets,
      focusSessions,
      events: [],
    });

    expect(kpis.totalOpportunities).toBe(3);
    expect(kpis.activeOpportunities).toBe(2); // Stripe + Razorpay
    expect(kpis.archivedOpportunities).toBe(1); // OldCo (REJECTED)
    expect(kpis.totalApplications).toBe(4);
    expect(kpis.applicationsThisWeek).toBe(4);
    expect(kpis.customizationBreakdown.deep).toBe(1);
    expect(kpis.customizationBreakdown.tailored).toBe(1);
    expect(kpis.customizationBreakdown.quick).toBe(2);

    expect(kpis.totalOutreach).toBe(2);
    expect(kpis.totalReplied).toBe(1);
    expect(kpis.responseRate).toBe(50); // 1 / 2 = 50%

    // Funnel conversions
    // 2 opportunities reached interview/offer stages out of 4 total applications = 50%
    expect(kpis.interviewsReached).toBe(2);
    expect(kpis.interviewConversionRate).toBe(50);
    // 1 offer out of 4 applications = 25%
    expect(kpis.offersReceived).toBe(1);
    expect(kpis.offerConversionRate).toBe(25);

    // Intermediate funnel metrics
    // Total replied = 1, Interviews = 2 -> replyToInterviewRate = (2/1)*100 = 200%
    expect(kpis.replyToInterviewRate).toBe(200);
    // Offers = 1, Interviews = 2 -> interviewToOfferRate = (1/2)*100 = 50%
    expect(kpis.interviewToOfferRate).toBe(50);
    expect(kpis.applicationToOfferRate).toBe(25);

    // Focus time: only job_hunt session included
    expect(kpis.focusTimeTotalSeconds).toBe(3600);
    expect(kpis.focusTimeByCategory.Applications).toBe(3600);

    // Assets
    expect(kpis.totalAssets).toBe(2);
    expect(kpis.activeAssets).toBe(1);
    expect(kpis.inProgressAssets).toBe(1);
  });
});
