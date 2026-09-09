// ============================================================================
// PERSONAL OS — Ask My OS (Layer 4 AI Intelligence Interface)
// Natural language queries grounded in deterministic OS facts.
//
// Core Axiom:
//   "Code calculates. AI judges and explains. AI does not redefine reality."
// ============================================================================

import { useState } from 'react';
import {
  MessageSquare, Send, Sparkles, AlertCircle, RefreshCw,
  CheckCircle2, AlertTriangle, ShieldAlert, Target, Clock, Zap
} from 'lucide-react';
import { aiService } from '../services/ai/aiService';
import type { AIAnalysis, AIEvidence } from '../types/ai';

interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content?: string;
  analysis?: AIAnalysis;
  provider?: string;
  model?: string;
  latencyMs?: number;
  evidenceCatalog?: Record<string, AIEvidence>;
  error?: string;
}

export function AskAI() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [brutalMode, setBrutalMode] = useState(false);

  const handleAsk = async (queryText?: string) => {
    const textToAsk = (queryText || query).trim();
    if (!textToAsk || loading) return;

    const userMsgId = 'msg-' + Date.now();
    const newHistory: ChatMessage[] = [
      ...history,
      { id: userMsgId, role: 'user', content: textToAsk },
    ];
    setHistory(newHistory);
    setQuery('');
    setLoading(true);

    try {
      const review = await aiService.runAnalysis({
        mode: brutalMode ? 'BRUTAL' : 'USER_QUERY',
        userQuery: textToAsk,
      });

      setHistory([
        ...newHistory,
        {
          id: 'ai-' + Date.now(),
          role: 'ai',
          analysis: review.analysis,
          provider: review.provider,
          model: review.model,
          latencyMs: review.latencyMs,
        },
      ]);
    } catch (err: any) {
      setHistory([
        ...newHistory,
        {
          id: 'ai-err-' + Date.now(),
          role: 'ai',
          error: err.message || 'Failed to generate OS interpretation.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const suggestedQueries = [
    'Where did my time go this week?',
    'Am I making progress toward my job goal?',
    'What is my biggest bottleneck right now?',
    'Which pillar am I neglecting?',
    'How is the VOIRE brand margin performing?',
    'Am I spending time on things that move my goals forward?',
  ];

  return (
    <div className="page-body">
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 38,
                height: 38,
                borderRadius: 'var(--radius-md)',
                background: 'rgba(139, 92, 246, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#8b5cf6',
              }}>
                <Sparkles size={20} />
              </div>
              <div>
                <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
                  Ask My Personal OS
                </h1>
                <p className="text-xs text-muted" style={{ margin: 0 }}>
                  Layer 4 AI intelligence grounded in deterministic OS facts.
                </p>
              </div>
            </div>

            {/* Brutal honesty toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                className={`btn btn-xs ${brutalMode ? 'btn-danger' : 'btn-ghost'}`}
                style={{ borderRadius: 'var(--radius-md)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                onClick={() => setBrutalMode(!brutalMode)}
                title="Switch to unvarnished, high-rigor audit tone"
              >
                <Zap size={12} />
                <span>{brutalMode ? 'Brutal Mode Active' : 'Enable Brutal Mode'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Info Banner */}
        <div className="card" style={{ marginBottom: 20, border: '1px solid rgba(139, 92, 246, 0.25)', background: 'rgba(139, 92, 246, 0.04)' }}>
          <div className="card-body" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 16px' }}>
            <AlertCircle size={16} style={{ color: '#8b5cf6', flexShrink: 0, marginTop: 2 }} />
            <div className="text-xs text-muted" style={{ lineHeight: 1.5 }}>
              AI answers are derived exclusively from your ground-truth data: time entries, registered KPIs, goals, and pillar outcomes.
              <strong style={{ color: 'var(--text-secondary)' }}> The AI never calculates — it judges, synthesizes, and highlights variances.</strong>
            </div>
          </div>
        </div>

        {/* Chat / Query Feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24, minHeight: 240 }}>
          {history.length === 0 ? (
            <div className="card" style={{ padding: '36px 20px', textAlign: 'center' }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'rgba(139, 92, 246, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
                color: '#8b5cf6',
              }}>
                <MessageSquare size={24} />
              </div>
              <div style={{ fontWeight: 700, fontSize: 'var(--text-md)', marginBottom: 4 }}>
                Ask anything about your performance
              </div>
              <div className="text-xs text-muted" style={{ marginBottom: 18 }}>
                Select a suggested inquiry or type your custom query below.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 8, textAlign: 'left' }}>
                {suggestedQueries.map((q) => (
                  <button
                    key={q}
                    className="btn btn-ghost btn-sm"
                    style={{
                      justifyContent: 'flex-start',
                      textAlign: 'left',
                      background: 'var(--surface-sunken)',
                      border: '1px solid var(--border-subtle)',
                      padding: '8px 12px',
                      fontSize: 'var(--text-xs)',
                    }}
                    onClick={() => handleAsk(q)}
                  >
                    <MessageSquare size={13} style={{ flexShrink: 0, color: 'var(--clr-primary)' }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            history.map((msg) => (
              <div key={msg.id}>
                {msg.role === 'user' ? (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
                    <div style={{
                      maxWidth: '85%',
                      padding: '10px 16px',
                      borderRadius: 'var(--radius-lg)',
                      background: 'rgba(99, 102, 241, 0.15)',
                      border: '1px solid rgba(99, 102, 241, 0.3)',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 600,
                    }}>
                      {msg.content}
                    </div>
                  </div>
                ) : msg.error ? (
                  <div className="card" style={{ border: '1px solid rgba(239, 68, 68, 0.3)', padding: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--clr-danger)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                      <AlertTriangle size={16} />
                      <span>Analysis Unavailable</span>
                    </div>
                    <p style={{ margin: '6px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                      {msg.error}
                    </p>
                  </div>
                ) : msg.analysis ? (
                  <div className="card" style={{ padding: 18, border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
                    {/* Metadata Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Sparkles size={14} style={{ color: '#8b5cf6' }} />
                        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          OS Intelligence Interpretation
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: 'var(--text-muted)' }}>
                        <span className="badge badge-neutral" style={{ fontSize: 9 }}>{msg.model || 'gemini-3.7-flash'}</span>
                        <span>{msg.latencyMs ? `${msg.latencyMs}ms` : ''}</span>
                      </div>
                    </div>

                    {/* Summary */}
                    <p style={{ margin: '0 0 14px', fontSize: 'var(--text-sm)', lineHeight: 1.6, color: 'var(--text-primary)' }}>
                      {msg.analysis.summary}
                    </p>

                    {/* Observations */}
                    {msg.analysis.observations && msg.analysis.observations.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
                          Key Observations
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {msg.analysis.observations.map((obs) => (
                            <div
                              key={obs.id}
                              style={{
                                padding: '6px 10px',
                                background: 'var(--surface-sunken)',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: 'var(--text-xs)',
                                borderLeft: obs.type === 'FACT' ? '3px solid var(--clr-primary)' : obs.type === 'INFERENCE' ? '3px solid #8b5cf6' : '3px solid var(--clr-warning)',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                                <span style={{ fontWeight: 600 }}>{obs.text}</span>
                                <span className="badge badge-neutral" style={{ fontSize: 9 }}>{obs.type}</span>
                              </div>
                              {obs.evidenceIds && obs.evidenceIds.length > 0 && (
                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                                  {obs.evidenceIds.map((eid) => (
                                    <span key={eid} style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '1px 4px', borderRadius: 2 }}>
                                      {eid}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Contradictions & Risks */}
                    {(msg.analysis.contradictions?.length || 0) > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--clr-warning)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <AlertTriangle size={12} />
                          Contradictions Identified
                        </div>
                        {msg.analysis.contradictions.map((c) => (
                          <div key={c.id} style={{ fontSize: 'var(--text-xs)', padding: '6px 10px', background: 'rgba(245, 158, 11, 0.08)', borderRadius: 'var(--radius-sm)', marginBottom: 4 }}>
                            <strong>{c.claim}:</strong> {c.reality}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Actionable Priorities */}
                    {msg.analysis.priorities && msg.analysis.priorities.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
                          Bounded Priorities
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {msg.analysis.priorities.map((p) => (
                            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)' }}>
                              <CheckCircle2 size={12} style={{ color: p.urgency === 'HIGH' ? 'var(--clr-danger)' : 'var(--clr-primary)', flexShrink: 0 }} />
                              <span style={{ fontWeight: 600 }}>{p.title}:</span>
                              <span className="text-muted">{p.rationale}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ))
          )}

          {loading && (
            <div className="card" style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
              <RefreshCw size={18} className="spin" style={{ color: '#8b5cf6' }} />
              <div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Synthesizing Facts & Evaluating OS Context...</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  Grounded inference via Gemini 3.7 Flash
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div style={{
          display: 'flex',
          gap: 8,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          padding: '8px 8px 8px 16px',
          alignItems: 'center',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
            placeholder={brutalMode ? 'Ask unvarnished, brutal audit question...' : 'Ask about your time, goals, gaps, or bottlenecks...'}
            disabled={loading}
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: 'var(--text-sm)',
              padding: 0,
              color: 'var(--text-primary)',
            }}
          />
          <button
            className="btn btn-primary btn-sm"
            onClick={() => handleAsk()}
            disabled={!query.trim() || loading}
            style={{ opacity: query.trim() && !loading ? 1 : 0.5 }}
          >
            {loading ? <RefreshCw size={14} className="spin" /> : <Send size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}
