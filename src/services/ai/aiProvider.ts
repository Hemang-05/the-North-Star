// ============================================================================
// PERSONAL OS — AI Provider Abstraction
// Decouples the application from any single AI backend.
// Implementations: GeminiProvider (via server boundary) and MockAIProvider (offline / test).
// ============================================================================

import {
  AI_MODEL,
  type AIAnalysis,
  type AIRequest,
  type AIResponse,
} from '../../types/ai';

export interface AIProvider {
  readonly name: string;
  generateAnalysis(request: AIRequest): Promise<AIResponse>;
}

/**
 * Production Gemini Provider.
 * Communicates with the server-side `/api/ai/analyze` endpoint.
 * Protects secrets by never touching or storing the API key client-side.
 */
export class GeminiProvider implements AIProvider {
  readonly name = 'gemini';

  async generateAnalysis(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: request.mode,
          context: request.context,
          thinkingBudgetOverride: request.thinkingBudget,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const errorMsg = data.error || `HTTP ${response.status}: Failed to generate AI analysis`;
        const err = new Error(errorMsg);
        (err as any).category = data.category || 'SERVER_ERROR';
        throw err;
      }

      return {
        analysis: data.analysis,
        provider: data.provider || 'gemini',
        model: data.model || AI_MODEL,
        mode: request.mode,
        latencyMs: data.latencyMs || Date.now() - startTime,
        contextHash: '', // populated by AIService
        createdAt: data.createdAt || new Date().toISOString(),
      };
    } catch (err: unknown) {
      if (err instanceof Error && (err as any).category) {
        throw err;
      }
      const networkError = new Error('AI analysis unavailable right now. Your underlying Personal OS data is unaffected.');
      (networkError as any).category = 'NETWORK_OFFLINE';
      throw networkError;
    }
  }
}

/**
 * Deterministic Mock AI Provider for offline environments and unit testing.
 * Generates structured observations, contradictions, and goal assessments
 * strictly citing valid IDs from the context's evidence catalog.
 */
export class MockAIProvider implements AIProvider {
  readonly name = 'mock';

  async generateAnalysis(request: AIRequest): Promise<AIResponse> {
    const { mode, context } = request;
    const catalog = context.evidenceCatalog || [];
    const validIds = catalog.map((e) => e.id);

    // Pick valid evidence references for grounding
    const goalRef = validIds.find((id) => id.startsWith('goal.')) || validIds[0] || 'mock.evidence';
    const timeRef = validIds.find((id) => id.startsWith('time.')) || validIds[0] || 'mock.time';
    const northStarRef = validIds.find((id) => id.startsWith('north_star.')) || validIds[0] || 'mock.ns';

    const mockAnalysis: AIAnalysis = {
      headline: `${mode} Analysis: ${context.time.summary.totalHours}h Focus Time with ${context.goals.length} Tracked Goals`,
      summary: `Evaluated ${context.period.label} performance across all six pillars. Time allocation shows ${context.time.summary.deepWorkRatioPercent}% deep work and ${context.time.summary.priorityAlignedPercent}% priority alignment.`,
      confidence: 'HIGH',
      observations: [
        {
          id: 'obs_1',
          type: 'FACT',
          category: 'TIME',
          statement: `Recorded ${context.time.summary.totalHours} focus hours across ${context.time.summary.sessionCount} sessions during ${context.period.label}.`,
          evidenceRefs: [timeRef],
        },
        {
          id: 'obs_2',
          type: 'FACT',
          category: 'GOAL',
          statement: `Currently tracking ${context.goals.length} active goals; top priority focus is ${context.time.summary.priorityAlignedPercent}% aligned with job hunt, agency, and SaaS.`,
          evidenceRefs: [goalRef],
        },
        {
          id: 'obs_3',
          type: 'INFERENCE',
          category: 'OUTCOME',
          statement: 'Time spent in top priority pillars coincided with active milestone progression.',
          evidenceRefs: [timeRef, goalRef, northStarRef],
        },
      ],
      patterns: [
        {
          id: 'pat_1',
          title: 'Priority Pillar Focus',
          description: 'Focus sessions are predominantly concentrated in the designated top three priority pillars.',
          pillarIds: ['job_hunt', 'agency', 'trading_os'],
          significance: 'HIGH',
          evidenceRefs: [timeRef],
        },
      ],
      contradictions: [
        {
          id: 'con_1',
          statedIntent: 'Stated priority #1 is Job Hunt',
          observedReality: `Job Hunt received focus time commensurate with current pipeline activity.`,
          severity: 'NOTE',
          evidenceRefs: [timeRef],
        },
      ],
      risks: [
        {
          id: 'risk_1',
          title: 'Unmeasured Goal Latency',
          description: 'Goals with unrecorded current values require periodic reality logging to compute accurate gaps.',
          severity: 'LOW',
          mitigationFact: 'Update current metrics in the Goals tab.',
        },
      ],
      opportunities: [
        {
          id: 'opp_1',
          title: 'Deep Work Consolidation',
          description: 'Increasing session lengths beyond 45 minutes can further elevate the deep work ratio.',
        },
      ],
      priorities: [
        {
          id: 'prio_1',
          rank: 1,
          area: 'Priority #1 Pillar Execution',
          rationale: 'Highest leveraged pillar according to the Personal OS hierarchy.',
          nature: 'PRIORITY',
        },
      ],
      goalAnalysis: context.goals.map((g) => ({
        goalId: g.goalId,
        goalTitle: g.title,
        status: g.status,
        varianceExplanation: `Current computed value is ${g.current ?? 'unmeasured'} vs target of ${g.target}. Gap is ${g.gap ?? 'unknown'}.`,
        trajectory: g.status === 'ACHIEVED' || g.status === 'AHEAD' ? 'IMPROVING' : 'STABLE',
        evidenceRefs: [goalRef],
      })),
      evidenceCatalog: catalog,
    };

    return {
      analysis: mockAnalysis,
      provider: 'mock',
      model: 'mock-engine',
      mode,
      latencyMs: 15,
      contextHash: '',
      createdAt: new Date().toISOString(),
    };
  }
}
