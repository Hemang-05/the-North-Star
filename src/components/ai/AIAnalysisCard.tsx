// ============================================================================
// PERSONAL OS — AI Analysis Card Component
// Standardized UI component presenting AI interpretations across OS surfaces.
// Clearly demarcates FACT, INFERENCE, UNCERTAINTY, Contradictions, and Evidence.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles, RefreshCw, AlertTriangle, Flame, ArrowRight, ChevronDown, ChevronUp
} from 'lucide-react';
import { aiService } from '../../services/ai/aiService';
import type { AIAnalysis, AIAnalysisMode } from '../../types/ai';
import type { PillarSlug } from '../../types/core';
import type { TimePeriodType } from '../../types/intelligence';

interface AIAnalysisCardProps {
  title?: string;
  mode?: AIAnalysisMode;
  periodType?: TimePeriodType;
  pillarScope?: PillarSlug;
  goalScope?: string;
  compact?: boolean;
  allowBrutal?: boolean;
  onViewFull?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function AIAnalysisCard({
  title = 'AI Intelligence',
  mode = 'WEEKLY',
  periodType,
  pillarScope,
  goalScope,
  compact = false,
  allowBrutal = true,
  onViewFull,
  className = '',
  style,
}: AIAnalysisCardProps) {
  const [currentMode, setCurrentMode] = useState<AIAnalysisMode>(mode);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceInfo, setSourceInfo] = useState<{ provider: string; model: string; latencyMs: number } | null>(null);
  const [expanded, setExpanded] = useState(!compact);

  // Check cache only on mount / period / scope changes — NEVER call provider silently
  const checkCache = useCallback(async () => {
    try {
      const cached = await aiService.getCachedReview({
        mode: currentMode,
        periodType,
        pillarScope,
        goalScope,
      });

      if (cached) {
        setAnalysis(cached.analysis);
        setSourceInfo({
          provider: cached.provider,
          model: cached.model,
          latencyMs: cached.latencyMs,
        });
      } else {
        setAnalysis(null);
        setSourceInfo(null);
      }
    } catch (err) {
      console.warn('Failed to check AI cache:', err);
    }
  }, [currentMode, periodType, pillarScope, goalScope]);

  useEffect(() => {
    checkCache();
  }, [checkCache]);

  // Explicit user-triggered analysis execution
  const executeAnalysis = async (selectedMode: AIAnalysisMode, forceRegenerate = false) => {
    setLoading(true);
    setError(null);

    try {
      const response = await aiService.runAnalysis({
        mode: selectedMode,
        periodType,
        pillarScope,
        goalScope,
        forceRegenerate,
      });

      setAnalysis(response.analysis);
      setSourceInfo({
        provider: response.provider,
        model: response.model,
        latencyMs: response.latencyMs,
      });
    } catch (err: any) {
      console.error('AI Analysis failed:', err);
      setError(err?.message || 'AI analysis is currently unavailable. Your underlying OS data is unaffected.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`card ${className}`}
      style={{
        border: currentMode === 'BRUTAL' ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(139, 92, 246, 0.3)',
        background: currentMode === 'BRUTAL'
          ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.06) 0%, rgba(15, 23, 42, 0.6) 100%)'
          : 'linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, rgba(15, 23, 42, 0.6) 100%)',
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* Top Banner & Header */}
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28,
            height: 28,
            borderRadius: 'var(--radius-md)',
            background: currentMode === 'BRUTAL' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(139, 92, 246, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: currentMode === 'BRUTAL' ? '#ef4444' : '#a855f7',
          }}>
            {currentMode === 'BRUTAL' ? <Flame size={16} /> : <Sparkles size={16} />}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 className="card-title" style={{ margin: 0, fontSize: 'var(--text-base)' }}>
                {title}
              </h3>
              {sourceInfo && (
                <span className="badge badge-neutral" style={{ fontSize: 10, padding: '2px 6px' }}>
                  {sourceInfo.provider === 'cached' ? '⚡ Cached' : `gemini-3.7-flash (${sourceInfo.latencyMs}ms)`}
                </span>
              )}
            </div>
            <div className="text-xs text-muted" style={{ marginTop: 2 }}>
              Code calculates deterministic reality. AI interprets variance & gaps.
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {allowBrutal && (
            <button
              className={`btn btn-sm ${currentMode === 'BRUTAL' ? 'btn-danger' : 'btn-ghost'}`}
              style={{ fontSize: 11, padding: '4px 8px', borderRadius: 'var(--radius-md)' }}
              onClick={() => {
                const nextMode = currentMode === 'BRUTAL' ? mode : 'BRUTAL';
                setCurrentMode(nextMode);
              }}
              disabled={loading}
              title="Toggle Brutal Analysis (unfiltered, unsparing evaluation)"
            >
              <Flame size={12} />
              <span>{currentMode === 'BRUTAL' ? 'Standard Mode' : 'Brutal Mode'}</span>
            </button>
          )}

          {analysis && (
            <button
              id="btn-regenerate-ai"
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 11, padding: '4px 8px' }}
              onClick={() => executeAnalysis(currentMode, true)}
              disabled={loading}
              title="Force fresh regeneration with Gemini 3.7 Flash"
            >
              <RefreshCw size={12} className={loading ? 'spin' : ''} />
              <span>Regenerate</span>
            </button>
          )}

          {compact && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setExpanded(!expanded)}
              style={{ padding: 4 }}
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          )}
        </div>
      </div>

      <div className="card-body" style={{ paddingTop: 12 }}>
        {/* Explicit Generation State (No Cache Yet) */}
        {!analysis && !loading && !error && (
          <div
            style={{
              padding: '24px 16px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: currentMode === 'BRUTAL' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(139, 92, 246, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: currentMode === 'BRUTAL' ? '#ef4444' : '#a855f7',
              }}
            >
              {currentMode === 'BRUTAL' ? <Flame size={22} /> : <Sparkles size={22} />}
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                {currentMode === 'BRUTAL' ? 'Brutal AI Evaluation Ready' : 'Deterministic OS Facts Compiled'}
              </div>
              <div className="text-xs text-muted" style={{ maxWidth: 420, marginTop: 4, lineHeight: 1.4 }}>
                Personal OS tracks reality in code. Run Gemini 3.7 Flash analysis on demand to interpret progress, uncover blind spots, and assess trajectories.
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
              <button
                id="btn-run-ai-analysis"
                className="btn btn-primary btn-sm"
                style={{
                  background: currentMode === 'BRUTAL'
                    ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)'
                    : 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                  boxShadow: '0 2px 8px rgba(139, 92, 246, 0.25)',
                  gap: 6,
                  padding: '6px 14px',
                }}
                onClick={() => executeAnalysis(currentMode, false)}
              >
                {currentMode === 'BRUTAL' ? <Flame size={14} /> : <Sparkles size={14} />}
                <span>Run Analysis</span>
              </button>

              {allowBrutal && currentMode !== 'BRUTAL' && (
                <button
                  id="btn-run-brutal-analysis"
                  className="btn btn-secondary btn-sm"
                  style={{
                    borderColor: 'rgba(239, 68, 68, 0.35)',
                    color: '#f87171',
                    gap: 6,
                    padding: '6px 14px',
                  }}
                  onClick={() => {
                    setCurrentMode('BRUTAL');
                    executeAnalysis('BRUTAL', false);
                  }}
                >
                  <Flame size={14} />
                  <span>Brutal Assessment</span>
                </button>
              )}
            </div>
          </div>
        )}
        {/* Loading State */}
        {loading && !analysis && (
          <div style={{ padding: '24px 0', textAlign: 'center' }}>
            <RefreshCw size={24} className="spin" style={{ color: '#8b5cf6', marginBottom: 12 }} />
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Analyzing Deterministic OS Facts</div>
            <div className="text-xs text-muted">Grounded Gemini 3.7 Flash interpretation in progress...</div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div style={{
            padding: '12px 16px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 12,
          }}>
            <AlertTriangle size={18} style={{ color: 'var(--clr-danger)', flexShrink: 0 }} />
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-primary)' }}>
              {error}
            </div>
          </div>
        )}

        {/* Analysis Content */}
        {analysis && (
          <div>
            {/* Headline & Summary */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, lineHeight: 1.3 }}>
                {analysis.headline}
              </div>
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {analysis.summary}
              </p>
            </div>

            {/* Observations (Categorized & Fact-Inference Tagged) */}
            {analysis.observations && analysis.observations.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div className="text-xs text-muted" style={{ fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Key Grounded Observations
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {analysis.observations.slice(0, compact && !expanded ? 3 : 8).map((obs) => (
                    <div
                      key={obs.id}
                      style={{
                        padding: '6px 10px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                        fontSize: 'var(--text-xs)',
                      }}
                    >
                      <span
                        className={`badge ${
                          obs.type === 'FACT' ? 'badge-neutral' : obs.type === 'INFERENCE' ? 'badge-warning' : 'badge-danger'
                        }`}
                        style={{ fontSize: 9, padding: '1px 5px', flexShrink: 0, marginTop: 1 }}
                      >
                        {obs.type}
                      </span>
                      <span style={{ flex: 1, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        {obs.statement}
                      </span>
                      {obs.evidenceRefs && obs.evidenceRefs.length > 0 && (
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>
                          [{obs.evidenceRefs.join(', ')}]
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Contradictions (Expanded View) */}
            {expanded && analysis.contradictions && analysis.contradictions.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div className="text-xs text-muted" style={{ fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Observed Behavioral Contradictions
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {analysis.contradictions.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        padding: '8px 12px',
                        background: 'rgba(239, 68, 68, 0.05)',
                        borderLeft: '3px solid #ef4444',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--text-xs)',
                      }}
                    >
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                        Stated Intent: "{c.statedIntent}"
                      </div>
                      <div style={{ color: '#f87171' }}>
                        Observed Reality: {c.observedReality}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actionable Priorities & Risks (Expanded View) */}
            {expanded && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginTop: 16 }}>
                {analysis.priorities && analysis.priorities.length > 0 && (
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 'var(--radius-md)' }}>
                    <div className="text-xs text-muted" style={{ fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>
                      Recommended Focus
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {analysis.priorities.slice(0, 3).map((p) => (
                        <div key={p.id} style={{ fontSize: 'var(--text-xs)' }}>
                          <span style={{ fontWeight: 700, color: '#a855f7', marginRight: 6 }}>#{p.rank}</span>
                          <span style={{ fontWeight: 600 }}>{p.area}:</span>{' '}
                          <span className="text-muted">{p.rationale}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {analysis.risks && analysis.risks.length > 0 && (
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 'var(--radius-md)' }}>
                    <div className="text-xs text-muted" style={{ fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>
                      Identified Risks
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {analysis.risks.slice(0, 3).map((r) => (
                        <div key={r.id} style={{ fontSize: 'var(--text-xs)' }}>
                          <span style={{ fontWeight: 600, color: r.severity === 'HIGH' ? '#ef4444' : '#f59e0b' }}>
                            ⚠ {r.title}:
                          </span>{' '}
                          <span className="text-muted">{r.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* View Full / Compact Action Link */}
            {compact && onViewFull && (
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 11, color: '#a855f7' }}
                  onClick={onViewFull}
                >
                  <span>View Full Time & Intelligence Analysis</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
