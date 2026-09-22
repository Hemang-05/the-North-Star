// ============================================================================
// PERSONAL OS — Central AI Service
// Orchestrates canonical context building, cache identity verification,
// provider invocation, structured response validation, and AIReview persistence.
//
// Core Axiom:
//   "Code calculates. AI judges and explains."
//   "No duplicate calls on re-renders. Deterministic caching with query isolation."
// ============================================================================

import type {
  AIAnalysisMode,
  AIContext,
  AIRequest,
  AIResponse,
} from '../../types/ai';
import type { AIReview, PillarSlug } from '../../types/core';
import type { TimePeriodType } from '../../types/intelligence';
import type { AIProvider } from './aiProvider';
import { GeminiProvider } from './aiProvider';
import { buildCanonicalAIContext } from './aiContextBuilder';
import { generateDeterministicAnalysis } from './deterministicAiFallback';
import { dbGetAll, dbPut, STORES } from '../db';

/**
 * Fast deterministic string hash function (FNV-1a 32-bit).
 */
export function hashString(str: string): string {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
}

/**
 * Computes deterministic context hash from authoritative analytical facts.
 * Excludes transient render timestamps, internal ephemeral keys, and UI states.
 */
export function computeContextHash(context: AIContext): string {
  const canonicalData = {
    version: context.contextVersion,
    mode: context.analysisMode,
    period: {
      type: context.period.type,
      start: context.period.start,
      end: context.period.end,
    },
    pillarScope: context.pillarScope,
    goalScope: context.goalScope,
    northStar: context.northStar
      ? {
          current: context.northStar.current,
          target: context.northStar.target,
          status: context.northStar.status,
        }
      : null,
    goals: context.goals.map((g) => ({
      id: g.goalId,
      current: g.current,
      target: g.target,
      status: g.status,
    })),
    time: {
      totalMinutes: context.time.summary.totalMinutes,
      sessions: context.time.summary.sessionCount,
      deepWorkRatio: context.time.summary.deepWorkRatioPercent,
      pillars: context.time.pillars.map((p) => ({ id: p.pillarId, m: p.minutes })),
    },
    trends: context.intelligence.trends.map((t) => t.id),
    anomalies: context.intelligence.anomalies.map((a) => a.id),
  };

  return hashString(JSON.stringify(canonicalData));
}

/**
 * Computes query hash ensuring distinct questions never share cached answers.
 */
export function computeUserQueryHash(query?: string): string | undefined {
  if (!query || !query.trim()) return undefined;
  return hashString(query.trim().toLowerCase());
}

export interface RunAnalysisOptions {
  mode: AIAnalysisMode;
  periodType?: TimePeriodType;
  refDate?: Date;
  pillarScope?: PillarSlug;
  goalScope?: string;
  userQuery?: string;
  forceRegenerate?: boolean;
}

export class AIService {
  private provider: AIProvider;

  constructor(provider?: AIProvider) {
    this.provider = provider || new GeminiProvider();
  }

  setProvider(provider: AIProvider): void {
    this.provider = provider;
  }

  getProviderName(): string {
    return this.provider.name;
  }

  /**
   * Primary entry point for AI analysis across all OS surfaces.
   */
  async runAnalysis(options: RunAnalysisOptions): Promise<AIResponse> {
    const {
      mode,
      periodType,
      refDate = new Date(),
      pillarScope,
      goalScope,
      userQuery,
      forceRegenerate = false,
    } = options;

    // 1. Build canonical AI context and evidence catalog
    const context = await buildCanonicalAIContext({
      mode,
      periodType,
      refDate,
      pillarScope,
      goalScope,
      userQuery,
    });

    // 2. Compute deterministic identity
    const contextHash = computeContextHash(context);
    const userQueryHash = computeUserQueryHash(userQuery);

    // 3. Cache lookup (IndexedDB)
    if (!forceRegenerate) {
      const cached = await this.findCachedReview({
        mode,
        periodStart: context.period.start,
        periodEnd: context.period.end,
        pillarScope,
        goalScope,
        contextHash,
        userQueryHash,
      });

      if (cached && cached.analysis) {
        return {
          analysis: cached.analysis as any,
          provider: 'cached',
          model: cached.model || 'cached',
          mode,
          latencyMs: 0,
          contextHash,
          userQueryHash,
          createdAt: cached.createdAt,
        };
      }
    }

    // 4. Invoke configured provider with deterministic fallback
    const request: AIRequest = {
      mode,
      context,
      userQuery,
      pillarScope,
      goalScope,
      forceRegenerate,
    };

    let response: AIResponse;
    try {
      response = await this.provider.generateAnalysis(request);
    } catch (providerErr: unknown) {
      const errMsg = providerErr instanceof Error ? providerErr.message : String(providerErr);
      console.warn(`[AIService] Live provider unavailable ("${errMsg}"). Seamlessly engaging Deterministic Strategic Engine fallback.`);

      const deterministic = generateDeterministicAnalysis(context, mode);
      response = {
        analysis: deterministic,
        provider: 'offline-deterministic',
        model: 'deterministic-rules-engine',
        mode,
        latencyMs: 15,
        contextHash,
        userQueryHash,
        createdAt: new Date().toISOString(),
      };
    }

    response.contextHash = contextHash;
    response.userQueryHash = userQueryHash;

    // 5. Persist AIReview record
    try {
      const reviewRecord: AIReview = {
        id: `rev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        reviewType: mode === 'USER_QUERY' ? 'QUERY' : (mode as any),
        periodStart: context.period.start,
        periodEnd: context.period.end,
        mode,
        pillarId: pillarScope,
        goalId: goalScope,
        userQueryHash,
        contextHash,
        contextVersion: context.contextVersion,
        provider: response.provider,
        model: response.model,
        analysis: response.analysis,
        createdAt: response.createdAt,
      };

      await dbPut(STORES.AI_REVIEWS, reviewRecord);
    } catch (persistErr) {
      console.warn('[AIService] Failed to persist AIReview to IndexedDB:', persistErr);
    }

    return response;
  }

  /**
   * Retrieves an existing cached review matching the exact identity tuple
   * without triggering a provider call if no cache exists.
   */
  async getCachedReview(options: Omit<RunAnalysisOptions, 'forceRegenerate'>): Promise<AIResponse | null> {
    const {
      mode,
      periodType,
      refDate = new Date(),
      pillarScope,
      goalScope,
      userQuery,
    } = options;

    const context = await buildCanonicalAIContext({
      mode,
      periodType,
      refDate,
      pillarScope,
      goalScope,
      userQuery,
    });

    const contextHash = computeContextHash(context);
    const userQueryHash = computeUserQueryHash(userQuery);

    const cached = await this.findCachedReview({
      mode,
      periodStart: context.period.start,
      periodEnd: context.period.end,
      pillarScope,
      goalScope,
      contextHash,
      userQueryHash,
    });

    if (cached && cached.analysis) {
      return {
        analysis: cached.analysis as any,
        provider: 'cached',
        model: cached.model || 'cached',
        mode,
        latencyMs: 0,
        contextHash,
        userQueryHash,
        createdAt: cached.createdAt,
      };
    }

    return null;
  }

  /**
   * Looks up a cached AIReview matching the exact identity tuple.
   */
  private async findCachedReview(identity: {
    mode: AIAnalysisMode;
    periodStart: string;
    periodEnd: string;
    pillarScope?: string;
    goalScope?: string;
    contextHash: string;
    userQueryHash?: string;
  }): Promise<AIReview | null> {
    try {
      const allReviews = await dbGetAll<AIReview>(STORES.AI_REVIEWS);
      const match = allReviews.find((r) => {
        if (r.mode !== identity.mode) return false;
        if (r.periodStart !== identity.periodStart || r.periodEnd !== identity.periodEnd) return false;
        
        const rPillar = r.pillarId || undefined;
        if (rPillar !== identity.pillarScope) return false;

        const rGoal = r.goalId || undefined;
        if (rGoal !== identity.goalScope) return false;

        const rQuery = r.userQueryHash || undefined;
        if (rQuery !== identity.userQueryHash) return false;

        return r.contextHash === identity.contextHash;
      });

      return match || null;
    } catch {
      return null;
    }
  }
}

// Global default singleton instance
export const aiService = new AIService();
