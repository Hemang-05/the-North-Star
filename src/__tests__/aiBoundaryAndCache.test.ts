import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AIService,
  computeContextHash,
  computeUserQueryHash,
} from '../services/ai/aiService';
import { MockAIProvider } from '../services/ai/aiProvider';
import { buildCanonicalAIContext } from '../services/ai/aiContextBuilder';
import { handleAiAnalyzeRequest, handleAiHealthRequest } from '../server/aiHandler';
import {
  InMemorySlidingWindowRateLimiter,
  type RateLimiter,
} from '../server/rateLimiter';
import { STORES } from '../services/db';
import type { AIContext } from '../types/ai';

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

describe('Layer 4 — Rate Limiter Abstraction', () => {
  it('enforces sliding window limits (30 req/min) per client key', () => {
    const limiter = new InMemorySlidingWindowRateLimiter({
      windowMs: 60_000,
      maxRequests: 5, // small limit for fast deterministic test
    });

    const clientA = '192.168.1.10';
    const clientB = '192.168.1.20';

    // 5 allowed requests for Client A
    for (let i = 1; i <= 5; i++) {
      const res = limiter.check(clientA);
      expect(res.allowed).toBe(true);
      expect(res.remaining).toBe(5 - i);
    }

    // 6th request for Client A is blocked
    const blockedA = limiter.check(clientA);
    expect(blockedA.allowed).toBe(false);
    expect(blockedA.remaining).toBe(0);
    expect(blockedA.retryAfterSeconds).toBeGreaterThanOrEqual(1);

    // Client B is unblocked and has full quota
    const resB = limiter.check(clientB);
    expect(resB.allowed).toBe(true);
    expect(resB.remaining).toBe(4);

    // Reset clears records
    limiter.reset(clientA);
    const unblockedA = limiter.check(clientA);
    expect(unblockedA.allowed).toBe(true);
  });

  it('handleAiAnalyzeRequest returns HTTP 429 when rate limited', async () => {
    const mockLimiter: RateLimiter = {
      check: vi.fn().mockReturnValue({
        allowed: false,
        limit: 30,
        remaining: 0,
        resetMs: 45000,
        retryAfterSeconds: 45,
      }),
    };

    const req: any = {
      method: 'POST',
      headers: { 'x-forwarded-for': '10.0.0.1' },
      socket: { remoteAddress: '10.0.0.1' },
    };

    let statusCode = 200;
    const headers: Record<string, string> = {};
    let responseBody = '';

    const res: any = {
      setHeader: (k: string, v: string) => { headers[k] = v; },
      end: (b: string) => { responseBody = b; },
      set statusCode(val: number) { statusCode = val; },
      get statusCode() { return statusCode; },
    };

    await handleAiAnalyzeRequest(req, res, mockLimiter);

    expect(statusCode).toBe(429);
    expect(headers['Retry-After']).toBe('45');
    const parsed = JSON.parse(responseBody);
    expect(parsed.success).toBe(false);
    expect(parsed.category).toBe('RATE_LIMITED');
  });
});

describe('Layer 4 — Public Health Endpoint Security Contract', () => {
  it('returns strictly status and model without exposing hasApiKey or secrets', () => {
    let statusCode = 0;
    const headers: Record<string, string> = {};
    let responseBody = '';

    const req: any = { method: 'GET' };
    const res: any = {
      setHeader: (k: string, v: string) => { headers[k] = v; },
      end: (b: string) => { responseBody = b; },
      set statusCode(val: number) { statusCode = val; },
      get statusCode() { return statusCode; },
    };

    handleAiHealthRequest(req, res);

    expect(statusCode).toBe(200);
    expect(headers['Content-Type']).toBe('application/json');

    const parsed = JSON.parse(responseBody);
    expect(parsed).toEqual({
      status: 'ok',
      model: 'gemini-3.7-flash',
    });

    // Explicit security assertions against leakages
    expect(parsed).not.toHaveProperty('hasApiKey');
    expect(parsed).not.toHaveProperty('apiKey');
    expect(parsed).not.toHaveProperty('GEMINI_API_KEY');
    expect(responseBody).not.toMatch(/api[-_]?key/i);
    expect(responseBody).not.toMatch(/secret/i);
    expect(responseBody).not.toMatch(/password/i);
    expect(responseBody).not.toMatch(/env/i);
  });
});

describe('Layer 4 — Explicit AI Data-Boundary Test', () => {
  beforeEach(() => {
    // Populate rich representative records across all 6 pillars
    mockDbStore[STORES.AGENCY_CLIENTS] = [
      { id: 'c1', name: 'Acme Corp', status: 'ACTIVE', monthlyRetainer: 5000 },
    ];
    mockDbStore[STORES.AGENCY_INVOICES] = [
      { id: 'inv1', clientId: 'c1', amount: 5000, status: 'PAID', paidDate: '2026-09-02' },
    ];
    mockDbStore[STORES.SAAS_FEATURES] = [
      { id: 'feat1', name: 'Webhooks Engine', status: 'COMPLETED' },
    ];
    mockDbStore[STORES.VOIRE_PRODUCTS] = [
      { id: 'vp1', title: 'Oversized Trench Coat', price: 290, status: 'PUBLISHED' },
    ];
    mockDbStore[STORES.VOIRE_ORDERS] = [
      { id: 'ord1', orderNumber: 'VR-1001', totalAmount: 580, paymentStatus: 'PAID', createdAt: '2026-09-03' },
    ];
    mockDbStore[STORES.FOREX_SETUPS] = [
      { id: 'fx1', pair: 'EURUSD', status: 'EXECUTED', rMultiple: 2.5 },
    ];
    mockDbStore[STORES.JOB_APPLICATIONS] = [
      { id: 'job1', company: 'DeepMind', role: 'Staff Engineer', status: 'INTERVIEWING' },
    ];
    mockDbStore[STORES.WORKOUTS] = [
      { id: 'w1', type: 'HYBRID', durationMinutes: 60, rpe: 8, completedAt: '2026-09-04' },
    ];
    mockDbStore[STORES.FOCUS_SESSIONS] = [
      { id: 'fs1', pillarId: 'trading_os', durationMinutes: 90, type: 'DEEP_WORK', startedAt: '2026-09-02' },
    ];
  });

  it('validates outbound AI payload contains ONLY approved AIContext schema without raw dumps or secrets', async () => {
    const context = await buildCanonicalAIContext({
      mode: 'WEEKLY',
      refDate: new Date('2026-09-08'),
    });

    const approvedContextKeys = new Set([
      'contextVersion',
      'generatedAt',
      'period',
      'pillarScope',
      'goalScope',
      'northStar',
      'goals',
      'time',
      'intelligence',
      'pillars',
      'evidenceCatalog',
      'analysisMode',
      'userQuery',
    ]);

    // Top-level contract validation
    for (const key of Object.keys(context)) {
      expect(approvedContextKeys.has(key)).toBe(true);
    }

    const rawJson = JSON.stringify(context);

    // 1. Assert no API keys, tokens, or authentication secrets
    expect(rawJson).not.toMatch(/api[-_]?key/i);
    expect(rawJson).not.toMatch(/bearer\s+/i);
    expect(rawJson).not.toMatch(/password/i);
    expect(rawJson).not.toMatch(/client[-_]?secret/i);
    expect(rawJson).not.toMatch(/private[-_]?key/i);
    expect(rawJson).not.toContain('GEMINI_API_KEY');
    expect(rawJson).not.toContain('AQ.Ab8RN');

    // 2. Assert no raw unparsed DB dumps or raw notes
    expect(rawJson).not.toContain('rawNotes');
    expect(rawJson).not.toContain('contactNotes');
    expect(rawJson).not.toContain('privateNotes');
    expect(rawJson).not.toContain('internalTrace');

    // 3. Evidence Catalog contract verification
    expect(context.evidenceCatalog.length).toBeGreaterThan(0);
    for (const ev of context.evidenceCatalog) {
      expect(ev.id).toMatch(/^[a-z_]+\.[a-z0-9_.-]+$/i);
      expect(['GOAL', 'TIME', 'METRIC', 'TREND', 'ANOMALY', 'EVENT', 'EFFICIENCY', 'FINANCIAL']).toContain(ev.category);
      expect(typeof ev.label).toBe('string');
      expect(typeof ev.source).toBe('string');
    }
  });
});

describe('Layer 4 — Comprehensive Cache Tests', () => {
  let service: AIService;
  let mockProvider: MockAIProvider;

  beforeEach(() => {
    mockDbStore[STORES.AI_REVIEWS] = [];
    mockProvider = new MockAIProvider();
    vi.spyOn(mockProvider, 'generateAnalysis');
    service = new AIService(mockProvider);
  });

  it('verifies cache hit: same mode + period + scope + query + context', async () => {
    const opts = {
      mode: 'WEEKLY' as const,
      refDate: new Date('2026-09-08'),
      userQuery: 'How is performance looking?',
    };

    // 1. Initial call -> Provider called
    const res1 = await service.runAnalysis(opts);
    expect(res1.provider).toBe('mock');
    expect(mockProvider.generateAnalysis).toHaveBeenCalledTimes(1);

    // 2. Same identical query -> Cache hit
    const res2 = await service.runAnalysis(opts);
    expect(res2.provider).toBe('cached');
    expect(res2.latencyMs).toBe(0);
    expect(res2.analysis.headline).toBe(res1.analysis.headline);
    expect(mockProvider.generateAnalysis).toHaveBeenCalledTimes(1); // Provider NOT called again
  });

  it('verifies cache miss on different query', async () => {
    const opts1 = {
      mode: 'USER_QUERY' as const,
      userQuery: 'What are my top risks?',
      refDate: new Date('2026-09-08'),
    };

    const opts2 = {
      mode: 'USER_QUERY' as const,
      userQuery: 'How is my deep work ratio?',
      refDate: new Date('2026-09-08'),
    };

    await service.runAnalysis(opts1);
    expect(mockProvider.generateAnalysis).toHaveBeenCalledTimes(1);

    // Different query -> cache miss -> Provider called again
    await service.runAnalysis(opts2);
    expect(mockProvider.generateAnalysis).toHaveBeenCalledTimes(2);
  });

  it('verifies cache miss on different pillar scope', async () => {
    const optsPillar1 = {
      mode: 'PILLAR' as const,
      pillarScope: 'trading_os' as const,
      refDate: new Date('2026-09-08'),
    };

    const optsPillar2 = {
      mode: 'PILLAR' as const,
      pillarScope: 'job_hunt' as const,
      refDate: new Date('2026-09-08'),
    };

    await service.runAnalysis(optsPillar1);
    expect(mockProvider.generateAnalysis).toHaveBeenCalledTimes(1);

    // Different pillar -> cache miss -> Provider called
    await service.runAnalysis(optsPillar2);
    expect(mockProvider.generateAnalysis).toHaveBeenCalledTimes(2);
  });

  it('verifies cache miss on different period', async () => {
    const optsPeriod1 = {
      mode: 'WEEKLY' as const,
      refDate: new Date('2026-09-08'), // Week 1
    };

    const optsPeriod2 = {
      mode: 'WEEKLY' as const,
      refDate: new Date('2026-09-15'), // Week 2
    };

    await service.runAnalysis(optsPeriod1);
    expect(mockProvider.generateAnalysis).toHaveBeenCalledTimes(1);

    // Different period -> cache miss -> Provider called
    await service.runAnalysis(optsPeriod2);
    expect(mockProvider.generateAnalysis).toHaveBeenCalledTimes(2);
  });

  it('verifies cache miss on different goal scope', async () => {
    const optsGoal1 = {
      mode: 'GOAL' as const,
      goalScope: 'goal_agency_cash',
      refDate: new Date('2026-09-08'),
    };

    const optsGoal2 = {
      mode: 'GOAL' as const,
      goalScope: 'goal_trading_features',
      refDate: new Date('2026-09-08'),
    };

    await service.runAnalysis(optsGoal1);
    expect(mockProvider.generateAnalysis).toHaveBeenCalledTimes(1);

    // Different goal -> cache miss -> Provider called
    await service.runAnalysis(optsGoal2);
    expect(mockProvider.generateAnalysis).toHaveBeenCalledTimes(2);
  });

  it('verifies cache miss when underlying context changes', async () => {
    const opts = {
      mode: 'WEEKLY' as const,
      refDate: new Date('2026-09-08'),
    };

    await service.runAnalysis(opts);
    expect(mockProvider.generateAnalysis).toHaveBeenCalledTimes(1);

    // Mutate underlying OS facts by adding a completed focus session
    mockDbStore[STORES.FOCUS_SESSIONS] = [
      {
        id: 'fs_new',
        pillarId: 'trading_os',
        category: 'DEEP_WORK',
        durationSeconds: 7200,
        pausedSeconds: 0,
        status: 'STOPPED',
        startedAt: '2026-09-07T10:00:00.000Z',
        endedAt: '2026-09-07T12:00:00.000Z',
      },
    ];

    // Same options, but different context facts -> cache miss -> Provider called
    await service.runAnalysis(opts);
    expect(mockProvider.generateAnalysis).toHaveBeenCalledTimes(2);
  });

  it('verifies forceRegenerate always triggers a provider call', async () => {
    const opts = {
      mode: 'WEEKLY' as const,
      refDate: new Date('2026-09-08'),
    };

    await service.runAnalysis(opts);
    expect(mockProvider.generateAnalysis).toHaveBeenCalledTimes(1);

    // forceRegenerate = true -> Provider called even if cached
    await service.runAnalysis({ ...opts, forceRegenerate: true });
    expect(mockProvider.generateAnalysis).toHaveBeenCalledTimes(2);
  });
});

describe('Layer 4 — AI Review Identity & Scope Segregation', () => {
  let service: AIService;
  let mockProvider: MockAIProvider;

  beforeEach(() => {
    mockDbStore[STORES.AI_REVIEWS] = [];
    mockProvider = new MockAIProvider();
    service = new AIService(mockProvider);
  });

  it('persists AIReviews with distinctive scope tags that never collide', async () => {
    const refDate = new Date('2026-09-08');

    // 1. Dashboard Analysis (WEEKLY, unscoped)
    const dashboardRev = await service.runAnalysis({ mode: 'WEEKLY', refDate });

    // 2. Goal Analysis (GOAL, goalScope: 'g1')
    const goalRev = await service.runAnalysis({ mode: 'GOAL', goalScope: 'g1', refDate });

    // 3. Pillar Analysis (PILLAR, pillarScope: 'agency')
    const pillarRev = await service.runAnalysis({ mode: 'PILLAR', pillarScope: 'agency', refDate });

    // 4. North Star Analysis (NORTH_STAR)
    const northStarRev = await service.runAnalysis({ mode: 'NORTH_STAR', refDate });

    // 5. Brutal Analysis (BRUTAL)
    const brutalRev = await service.runAnalysis({ mode: 'BRUTAL', refDate });

    // 6. Ask AI query 1
    const query1Rev = await service.runAnalysis({ mode: 'USER_QUERY', userQuery: 'What is my runway?', refDate });

    // 7. Ask AI query 2
    const query2Rev = await service.runAnalysis({ mode: 'USER_QUERY', userQuery: 'What is my hit rate?', refDate });

    const storedReviews = mockDbStore[STORES.AI_REVIEWS];
    expect(storedReviews.length).toBe(7);

    // Verify all stored reviews have non-colliding scope identities
    const identities = storedReviews.map((r: any) => ({
      mode: r.mode,
      pillarId: r.pillarId,
      goalId: r.goalId,
      userQueryHash: r.userQueryHash,
    }));

    const serializedSet = new Set(identities.map((i: any) => JSON.stringify(i)));
    expect(serializedSet.size).toBe(7); // All 7 are completely unique
  });
});

describe('Layer 4 — Explicit Generation (getCachedReview)', () => {
  let service: AIService;
  let mockProvider: MockAIProvider;

  beforeEach(() => {
    mockDbStore[STORES.AI_REVIEWS] = [];
    mockProvider = new MockAIProvider();
    vi.spyOn(mockProvider, 'generateAnalysis');
    service = new AIService(mockProvider);
  });

  it('returns null on cache miss WITHOUT calling provider', async () => {
    const result = await service.getCachedReview({
      mode: 'WEEKLY',
      refDate: new Date('2026-09-08'),
    });

    expect(result).toBeNull();
    // Absolutely zero provider calls on mount / tab-switch
    expect(mockProvider.generateAnalysis).toHaveBeenCalledTimes(0);
  });

  it('returns cached review when present without calling provider', async () => {
    // 1. Populate cache by explicit user action
    await service.runAnalysis({
      mode: 'WEEKLY',
      refDate: new Date('2026-09-08'),
    });
    expect(mockProvider.generateAnalysis).toHaveBeenCalledTimes(1);

    // 2. getCachedReview retrieves the record with provider 'cached'
    const cached = await service.getCachedReview({
      mode: 'WEEKLY',
      refDate: new Date('2026-09-08'),
    });

    expect(cached).not.toBeNull();
    expect(cached?.provider).toBe('cached');
    expect(cached?.latencyMs).toBe(0);
    // Still exactly 1 provider call
    expect(mockProvider.generateAnalysis).toHaveBeenCalledTimes(1);
  });
});
