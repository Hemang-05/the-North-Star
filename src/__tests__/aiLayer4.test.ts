import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  computeContextHash,
  computeUserQueryHash,
  AIService,
} from '../services/ai/aiService';
import { MockAIProvider } from '../services/ai/aiProvider';
import { buildCanonicalAIContext } from '../services/ai/aiContextBuilder';
import {
  validateAnalyzeRequest,
  sanitizeEvidenceReferences,
} from '../server/aiHandler';
import type { AIAnalysis, AIContext } from '../types/ai';
import { STORES } from '../services/db';

const mockDbStore: Record<string, any[]> = {};

vi.mock('../services/db', () => {
  return {
    STORES: {
      EVENTS: 'activityEvents',
      ACTIVITY_EVENTS: 'activityEvents',
      FOCUS_SESSIONS: 'focusSessions',
      GOALS: 'goals',
      AI_REVIEWS: 'aiReviews',
      JOB_OPPORTUNITIES: 'jobOpportunities',
      JOB_APPLICATIONS: 'jobApplications',
      JOB_OUTREACH: 'jobOutreach',
      CAREER_CAPITAL: 'careerCapital',
      AGENCY_CLIENTS: 'agencyClients',
      AGENCY_PROJECTS: 'agencyProjects',
      AGENCY_LEADS: 'agencyLeads',
      AGENCY_INVOICES: 'agencyInvoices',
      SAAS_FEATURES: 'saasFeatures',
      SAAS_TEST_RUNS: 'saasTestRuns',
      SAAS_RELEASES: 'saasReleases',
      SAAS_FEEDBACK: 'saasFeedback',
      FOREX_STUDY: 'forexStudy',
      FOREX_SETUPS: 'forexSetups',
      FOREX_BACKTESTS: 'forexBacktests',
      FOREX_PAPER_TRADES: 'forexPaperTrades',
      WORKOUTS: 'workouts',
      RUNS: 'runs',
      BIO_SNAPSHOTS: 'bioSnapshots',
      VOIRE_DESIGNS: 'voireDesigns',
      VOIRE_PRODUCTS: 'voireProducts',
      VOIRE_DROPS: 'voireDrops',
      VOIRE_ORDERS: 'voireOrders',
      VOIRE_ORDER_ITEMS: 'voireOrderItems',
      VOIRE_MARKETING: 'voireMarketing',
    },
    initDB: vi.fn().mockResolvedValue(true),
    dbGetAll: vi.fn().mockImplementation(async (store: string) => mockDbStore[store] || []),
    dbPut: vi.fn().mockImplementation(async (store: string, item: any) => {
      if (!mockDbStore[store]) mockDbStore[store] = [];
      const idx = mockDbStore[store].findIndex((x: any) => x.id === item.id);
      if (idx >= 0) {
        mockDbStore[store][idx] = item;
      } else {
        mockDbStore[store].push(item);
      }
      return item;
    }),
    dbClear: vi.fn().mockImplementation(async (store: string) => {
      mockDbStore[store] = [];
    }),
  };
});

describe('OS Layer 4 — AI Intelligence & Gemini Integration', () => {
  beforeEach(() => {
    mockDbStore[STORES.AI_REVIEWS] = [];
    mockDbStore[STORES.ACTIVITY_EVENTS] = [];
  });

  it('builds canonical AIContext with evidence catalog and zero raw DB dumps', async () => {
    const context = await buildCanonicalAIContext({ mode: 'WEEKLY' });

    expect(context.contextVersion).toBe('4.0.0');
    expect(context.period.type).toBe('THIS_WEEK');
    expect(Array.isArray(context.goals)).toBe(true);
    expect(context.time.summary).toBeDefined();
    expect(Array.isArray(context.time.pillars)).toBe(true);
    expect(Array.isArray(context.intelligence.trends)).toBe(true);
    expect(Array.isArray(context.intelligence.anomalies)).toBe(true);

    // Evidence catalog verification
    expect(Array.isArray(context.evidenceCatalog)).toBe(true);
    expect(context.evidenceCatalog.length).toBeGreaterThan(0);

    // Verify all evidence items have id, label, source
    for (const item of context.evidenceCatalog) {
      expect(item.id).toBeDefined();
      expect(item.label).toBeDefined();
      expect(item.source).toBeDefined();
    }

    // Verify no secret or internal credential leakage in context JSON
    const contextStr = JSON.stringify(context);
    expect(contextStr).not.toContain('GEMINI_API_KEY');
    expect(contextStr).not.toContain('AQ.Ab8RN');
  });

  it('generates distinct cache hashes for distinct user queries', () => {
    const query1 = 'Why am I behind this week?';
    const query2 = 'Where did my time go this week?';

    const hash1 = computeUserQueryHash(query1);
    const hash2 = computeUserQueryHash(query2);

    expect(hash1).toBeDefined();
    expect(hash2).toBeDefined();
    expect(hash1).not.toBe(hash2);
  });

  it('invalidates context hash when analytical data changes', async () => {
    const context1 = await buildCanonicalAIContext({ mode: 'WEEKLY' });
    const hash1 = computeContextHash(context1);

    // Clone context and mutate an authoritative metric
    const context2: AIContext = JSON.parse(JSON.stringify(context1));
    context2.time.summary.totalMinutes += 60;
    const hash2 = computeContextHash(context2);

    expect(hash1).not.toBe(hash2);
  });

  it('validates incoming server request schemas strictly', () => {
    // Missing body
    expect(validateAnalyzeRequest(null).valid).toBe(false);

    // Invalid mode
    expect(validateAnalyzeRequest({ mode: 'INVALID_MODE', context: {} }).valid).toBe(false);

    // Invalid context version
    expect(
      validateAnalyzeRequest({
        mode: 'WEEKLY',
        context: { contextVersion: '1.0.0' },
      }).valid
    ).toBe(false);

    // Valid mock context
    const validPayload = {
      mode: 'WEEKLY',
      context: {
        contextVersion: '4.0.0',
        period: { start: '2026-09-01', end: '2026-09-07', type: 'THIS_WEEK', label: 'This Week' },
        goals: [],
        time: { summary: {}, pillars: [] },
        intelligence: { comparisons: [], trends: [], anomalies: [], pillarFacts: [] },
        pillars: [],
        evidenceCatalog: [],
      },
    };

    expect(validateAnalyzeRequest(validPayload).valid).toBe(true);
  });

  it('sanitizes model responses by stripping unknown evidence IDs', () => {
    const validIds = new Set(['goal.job_hunt.applications', 'time.total_hours']);

    const rawAnalysis: AIAnalysis = {
      headline: 'Test Headline',
      summary: 'Test Summary',
      confidence: 'HIGH',
      observations: [
        {
          id: 'obs_1',
          type: 'FACT',
          category: 'GOAL',
          statement: 'Applications submitted',
          evidenceRefs: ['goal.job_hunt.applications', 'fabricated.fake_id_123'],
        },
      ],
      patterns: [],
      contradictions: [
        {
          id: 'con_1',
          statedIntent: 'Focus on Job Hunt',
          observedReality: 'Time was spent on SaaS',
          severity: 'WARNING',
          evidenceRefs: ['time.total_hours', 'fabricated.fake_id_456'],
        },
      ],
      risks: [],
      opportunities: [],
      priorities: [],
      goalAnalysis: [],
    };

    const sanitized = sanitizeEvidenceReferences(rawAnalysis, validIds);

    expect(sanitized.observations[0].evidenceRefs).toEqual(['goal.job_hunt.applications']);
    expect(sanitized.contradictions[0].evidenceRefs).toEqual(['time.total_hours']);
  });

  it('executes AIService with MockAIProvider, caches result, and supports forceRegenerate', async () => {
    const service = new AIService(new MockAIProvider());

    // 1. Initial execution
    const res1 = await service.runAnalysis({ mode: 'WEEKLY' });
    expect(res1.provider).toBe('mock');
    expect(res1.analysis.headline).toContain('WEEKLY Analysis');
    expect(res1.analysis.observations.length).toBeGreaterThan(0);

    // 2. Cached execution (latency 0ms, provider 'cached')
    const res2 = await service.runAnalysis({ mode: 'WEEKLY' });
    expect(res2.provider).toBe('cached');
    expect(res2.latencyMs).toBe(0);
    expect(res2.analysis.headline).toBe(res1.analysis.headline);

    // 3. Force regenerate execution
    const res3 = await service.runAnalysis({ mode: 'WEEKLY', forceRegenerate: true });
    expect(res3.provider).toBe('mock');

    // 4. Verify AIReview was persisted to IndexedDB
    const storedReviews = mockDbStore[STORES.AI_REVIEWS] || [];
    expect(storedReviews.length).toBeGreaterThan(0);
  });

  it('isolates user queries so distinct questions never collide in cache', async () => {
    const service = new AIService(new MockAIProvider());

    const resQ1 = await service.runAnalysis({
      mode: 'USER_QUERY',
      userQuery: 'Why am I behind on applications this week?',
    });

    const resQ2 = await service.runAnalysis({
      mode: 'USER_QUERY',
      userQuery: 'Where did most of my focus hours go this week?',
    });

    expect(resQ1.userQueryHash).toBeDefined();
    expect(resQ2.userQueryHash).toBeDefined();
    expect(resQ1.userQueryHash).not.toBe(resQ2.userQueryHash);

    // Neither should have served from the other's cache
    expect(resQ2.provider).toBe('mock');
  });

  it('supports all eight required analysis modes cleanly', async () => {
    const service = new AIService(new MockAIProvider());
    const modes = ['DAILY', 'WEEKLY', 'MONTHLY', 'NORTH_STAR', 'PILLAR', 'GOAL', 'BRUTAL', 'USER_QUERY'] as const;

    for (const mode of modes) {
      const res = await service.runAnalysis({ mode, forceRegenerate: true });
      expect(res.analysis.headline).toContain(mode);
      expect(res.analysis.confidence).toBe('HIGH');
    }
  });
});
