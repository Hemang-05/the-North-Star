// ============================================================================
// PERSONAL OS — Forex Discipline & Emotional Leak Tab
// Core Primary Pillar Monitor: Rule Adherence Rate, Clean Streak, and Mistake Frequency.
// Features explicit deterministic thresholds for severe mistakes (FOMO/Revenge >= 2).
// ============================================================================

import {
  ShieldCheck, ShieldAlert, AlertTriangle,
  Flame, Award, BarChart3,
} from 'lucide-react';
import type { ForexKpiSummary } from '../../services/forexKpi';
import {
  CRITICAL_MISTAKE_COUNT_THRESHOLD,
  SEVERE_TRADE_MISTAKES,
} from '../../services/forexKpi';
import { formatSafePercent } from '../../utils/helpers';

interface ForexDisciplineTabProps {
  kpis: ForexKpiSummary;
}

export function ForexDisciplineTab({ kpis }: ForexDisciplineTabProps) {
  const adherenceRate = kpis.ruleAdherenceRate ?? 100;
  const criticalMistakes = kpis.fomoCount + kpis.revengeCount;
  const hasCriticalBreach = criticalMistakes >= CRITICAL_MISTAKE_COUNT_THRESHOLD;

  const getAdherenceColor = (rate: number) => {
    if (rate >= 85) return '#10b981';
    if (rate >= 70) return '#f59e0b';
    return '#ef4444';
  };

  const adherenceColor = getAdherenceColor(adherenceRate);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Critical Mistake Threshold Banner */}
      {hasCriticalBreach && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 14,
          }}
        >
          <AlertTriangle size={24} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: '#ef4444', marginBottom: 4 }}>
              Discipline Breakdown: Severe Mistakes (Threshold &gt;= {CRITICAL_MISTAKE_COUNT_THRESHOLD})
            </div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', lineHeight: 1.5 }}>
              The system observed <strong>{criticalMistakes} critical discipline breaches</strong> ({kpis.fomoCount} FOMO, {kpis.revengeCount} Revenge trades).
              The deterministic safety threshold is <strong>&gt;= {CRITICAL_MISTAKE_COUNT_THRESHOLD}</strong>. Emotional trades destroy edge and risk capital.
              Enforce a strict cooling-off period before any future paper execution.
            </div>
          </div>
        </div>
      )}

      {/* Top Metric Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {/* Adherence Gauge */}
        <div className="card" style={{ padding: '20px', borderTop: `4px solid ${adherenceColor}` }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={14} style={{ color: adherenceColor }} />
            <span>Process Adherence Rate (Primary KPI)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: adherenceColor }}>
              {formatSafePercent(kpis.ruleAdherenceRate)}
            </span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)' }}>
              ({kpis.ruleAdheredCount}/{kpis.totalPaperTrades} trades)
            </span>
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 8 }}>
            {adherenceRate >= 85
              ? 'Excellent rule compliance'
              : adherenceRate >= 70
              ? 'Borderline discipline — tighten execution'
              : 'Severe discipline leak — stop trading'}
          </div>
        </div>

        {/* Clean Streak */}
        <div className="card" style={{ padding: '20px', borderTop: '4px solid #ec4899' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Flame size={14} style={{ color: '#ec4899' }} />
            <span>Clean Trade Streak</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: '#ec4899' }}>
              {kpis.cleanTradeStreak}
            </span>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-subtle)' }}>
              trades
            </span>
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 8 }}>
            Consecutive executions without rule violations or mistake tags
          </div>
        </div>

        {/* Severe Mistake Count */}
        <div className="card" style={{ padding: '20px', borderTop: `4px solid ${criticalMistakes > 0 ? '#ef4444' : '#10b981'}` }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldAlert size={14} style={{ color: criticalMistakes > 0 ? '#ef4444' : '#10b981' }} />
            <span>Severe Emotional Leaks</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: criticalMistakes > 0 ? '#ef4444' : '#10b981' }}>
              {criticalMistakes}
            </span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)' }}>
              (Limit: &lt; {CRITICAL_MISTAKE_COUNT_THRESHOLD})
            </span>
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 8 }}>
            {kpis.fomoCount} FOMO + {kpis.revengeCount} Revenge recorded
          </div>
        </div>
      </div>

      {/* Mistake Distribution Analysis */}
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <BarChart3 size={16} style={{ color: '#f59e0b' }} /> Mistake Frequency & Psychological Leaks
        </h3>

        {kpis.totalMistakesRecorded === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 20px' }}>
            <Award size={36} style={{ color: '#10b981', margin: '0 auto 10px' }} />
            <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: '#10b981', marginBottom: 4 }}>
              Zero Mistakes Tagged!
            </div>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>
              All executed paper trades followed the trading plan with no emotional deviations recorded.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {kpis.topMistakes.map((m) => {
              const isSevere = SEVERE_TRADE_MISTAKES.includes(m.mistake);
              return (
                <div key={m.mistake} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)' }}>
                    <span style={{ fontWeight: 600, color: isSevere ? '#ef4444' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {isSevere && <AlertTriangle size={12} style={{ color: '#ef4444' }} />}
                      {m.mistake}
                      {isSevere && (
                        <span style={{ fontSize: 10, color: '#ef4444', opacity: 0.8 }}>(Severe)</span>
                      )}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {m.count} time(s) — {m.percentage}%
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div
                    style={{
                      height: 6,
                      borderRadius: 3,
                      background: 'rgba(255, 255, 255, 0.08)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${m.percentage}%`,
                        background: isSevere ? '#ef4444' : '#f59e0b',
                        borderRadius: 3,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Discipline Axioms */}
      <div
        className="card"
        style={{
          padding: 16,
          background: 'rgba(245, 158, 11, 0.05)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Personal OS Discipline Principles
        </div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', lineHeight: 1.5 }}>
          1. <strong>Process Precedes Profit</strong>: Trade quality is measured by adherence to rules, not by whether the market produced a win or loss.
          <br />
          2. <strong>One Trade Does Not Matter</strong>: Trading edge only expresses itself across a series of 50+ disciplined sample trades.
          <br />
          3. <strong>Zero Tolerance for Revenge & FOMO</strong>: Every unforced mistake resets your clean execution streak.
        </div>
      </div>
    </div>
  );
}
