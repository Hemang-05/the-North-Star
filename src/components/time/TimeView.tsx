// ============================================================================
// PERSONAL OS — Time & Intelligence View
// Deterministic Ground Truth: Where did time go? What did it produce?
//
// Core Axiom:
//   "Time is evidence. Outcomes are evidence. Intelligence is derived from both.
//    Code calculates facts deterministically; AI interprets later."
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  Clock, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  AlertTriangle, CheckCircle2, RefreshCw, BarChart2, Shield,
  Layers, Target, DollarSign, Calendar
} from 'lucide-react';
import { generateIntelligenceSnapshot } from '../../services/intelligenceFacts';
import { formatDuration, formatINR } from '../../utils/helpers';
import type {
  TimePeriodType,
  IntelligenceSnapshot,
  PillarTimeDetail,
  AnomalyFact,
  TrendFact,
} from '../../types/intelligence';
import { AIAnalysisCard } from '../ai/AIAnalysisCard';
import type { AIAnalysisMode } from '../../types/ai';

export function TimeView() {
  const [periodType, setPeriodType] = useState<TimePeriodType>('THIS_WEEK');
  const [snapshot, setSnapshot] = useState<IntelligenceSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await generateIntelligenceSnapshot(periodType);
      setSnapshot(data);
    } catch (err) {
      console.error('Failed to load intelligence snapshot:', err);
    } finally {
      setLoading(false);
    }
  }, [periodType]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading && !snapshot) {
    return (
      <div className="page-body">
        <div className="empty-state">
          <RefreshCw size={32} className="spin" style={{ color: '#6366f1', marginBottom: 16 }} />
          <div className="empty-state-title">Computing Time & Intelligence Facts</div>
          <div className="empty-state-text">Aggregating focus sessions and pillar outcomes...</div>
        </div>
      </div>
    );
  }

  const time = snapshot?.time;
  const pillars = snapshot?.pillars || [];
  const anomalies = snapshot?.anomalies || [];
  const trends = snapshot?.trends || [];

  return (
    <div className="page-body">
      {/* Header & Period Switcher */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Clock size={24} style={{ color: '#6366f1' }} />
            <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
              Time & Intelligence
            </h1>
          </div>
          <p className="text-sm text-muted" style={{ margin: 0 }}>
            Deterministic evidence of time allocation, outcome efficiency, and period movements.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Period Toggle Buttons */}
          <div className="btn-group" style={{ display: 'inline-flex', background: 'var(--surface-sunken)', padding: 3, borderRadius: 'var(--radius-lg)' }}>
            {(['TODAY', 'THIS_WEEK', 'THIS_MONTH', 'THIS_QUARTER'] as TimePeriodType[]).map((type) => (
              <button
                key={type}
                className={`btn btn-sm ${periodType === type ? 'btn-primary' : 'btn-ghost'}`}
                style={{ borderRadius: 'var(--radius-md)', fontSize: 'var(--text-xs)', padding: '4px 10px' }}
                onClick={() => setPeriodType(type)}
              >
                {type === 'TODAY' && 'Today'}
                {type === 'THIS_WEEK' && 'This Week'}
                {type === 'THIS_MONTH' && 'This Month'}
                {type === 'THIS_QUARTER' && 'This Quarter'}
              </button>
            ))}
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={loadData}
            disabled={loading}
            title="Recalculate Time & Intelligence Facts"
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Top Metrics Ribbon */}
      <div className="grid-stats" style={{ marginBottom: 24 }}>
        {/* Total Focus */}
        <div className="card">
          <div className="card-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="stat-label">Total Focus Time</div>
              {time?.changePercent !== null && time?.changePercent !== undefined && (
                <span
                  className={`badge ${time.changePercent >= 0 ? 'badge-success' : 'badge-danger'}`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11 }}
                >
                  {time.changePercent >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                  {time.changePercent >= 0 ? `+${time.changePercent}%` : `${time.changePercent}%`}
                </span>
              )}
            </div>
            <div className="stat-value" style={{ color: '#6366f1', marginTop: 4 }}>
              {time ? `${time.totalHours}h` : '0h'}
            </div>
            <div className="text-xs text-muted" style={{ marginTop: 4 }}>
              {time ? `${time.totalMinutes} total minutes in ${time.period.label}` : '—'}
            </div>
          </div>
        </div>

        {/* Deep Work */}
        <div className="card">
          <div className="card-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="stat-label">Deep Work (≥25m)</div>
              <span className="badge badge-primary" style={{ fontSize: 11 }}>
                {time?.deepWorkRatioPercent || 0}% ratio
              </span>
            </div>
            <div className="stat-value" style={{ color: '#8b5cf6', marginTop: 4 }}>
              {time ? `${Math.round((time.deepWorkMinutes / 60) * 10) / 10}h` : '0h'}
            </div>
            <div className="text-xs text-muted" style={{ marginTop: 4 }}>
              {time?.deepWorkSessionCount || 0} uninterrupted sessions
            </div>
          </div>
        </div>

        {/* Session Count & Avg */}
        <div className="card">
          <div className="card-body">
            <div className="stat-label">Session Pace</div>
            <div className="stat-value" style={{ color: '#06b6d4', marginTop: 4 }}>
              {time?.sessionCount || 0}
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', fontWeight: 500 }}> sessions</span>
            </div>
            <div className="text-xs text-muted" style={{ marginTop: 4 }}>
              Avg: {time?.averageSessionMinutes || 0}m · Longest: {time?.longestSessionMinutes || 0}m
            </div>
          </div>
        </div>

        {/* Priority Alignment */}
        <div className="card">
          <div className="card-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="stat-label">Priority Alignment</div>
              <span className="badge badge-warning" style={{ fontSize: 11 }}>
                Ranks #1-#3
              </span>
            </div>
            <div className="stat-value" style={{ color: '#f59e0b', marginTop: 4 }}>
              {time?.priorityAlignedPercent || 0}%
            </div>
            <div className="text-xs text-muted" style={{ marginTop: 4 }}>
              {time ? `${Math.round((time.priorityAlignedMinutes / 60) * 10) / 10}h` : '0h'} in Job Hunt, Agency & SaaS
            </div>
          </div>
        </div>
      </div>

      {/* Six-Pillar Time Allocation Bar */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart2 size={16} style={{ color: 'var(--clr-accent)' }} />
            <h2 className="card-title">Pillar Time Allocation & Share</h2>
          </div>
          <span className="text-xs text-muted">
            Hierarchical priority order (#1 to #6)
          </span>
        </div>
        <div className="card-body">
          {/* Segmented Bar */}
          {time && time.totalMinutes > 0 ? (
            <div
              style={{
                height: 16,
                borderRadius: 'var(--radius-full)',
                display: 'flex',
                overflow: 'hidden',
                background: 'rgba(255,255,255,0.05)',
                marginBottom: 20,
              }}
            >
              {time.pillarDetails.map((p) => {
                if (p.sharePercent <= 0) return null;
                return (
                  <div
                    key={p.pillarId}
                    style={{
                      width: `${p.sharePercent}%`,
                      background: p.color,
                      transition: 'width 0.3s ease',
                    }}
                    title={`${p.title}: ${p.hours}h (${p.sharePercent}%)`}
                  />
                );
              })}
            </div>
          ) : (
            <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginBottom: 12 }}>
              No focus sessions recorded in this period.
            </div>
          )}

          {/* Pillar Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {time?.pillarDetails.map((p) => (
              <div
                key={p.pillarId}
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: 12,
                  borderLeft: `3px solid ${p.color}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: 4,
                        background: 'rgba(255,255,255,0.08)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      #{p.priorityRank}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{p.title}</span>
                  </div>

                  {p.changePercent !== null && p.changePercent !== undefined && p.changePercent !== 0 && (
                    <span
                      style={{
                        fontSize: 11,
                        color: p.changePercent > 0 ? 'var(--clr-success)' : 'var(--clr-danger)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 2,
                      }}
                    >
                      {p.changePercent > 0 ? '+' : ''}{p.changePercent}%
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: p.color }}>
                    {p.hours}h
                  </span>
                  <span className="text-xs text-muted">
                    {p.sharePercent}% of total · {p.sessionCount} sessions
                  </span>
                </div>

                {/* Top category tags */}
                {Object.keys(p.byCategory).length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                    {Object.entries(p.byCategory)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 2)
                      .map(([cat, mins]) => (
                        <span
                          key={cat}
                          style={{
                            fontSize: 10,
                            background: 'rgba(255,255,255,0.04)',
                            color: 'var(--text-secondary)',
                            padding: '2px 6px',
                            borderRadius: 4,
                          }}
                        >
                          {cat}: {mins}m
                        </span>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Attention & Deterministic Anomalies */}
      {anomalies.length > 0 && (
        <div
          className="card"
          style={{
            marginBottom: 24,
            border: '1px solid rgba(239, 68, 68, 0.3)',
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, rgba(15, 23, 42, 0.4) 100%)',
          }}
        >
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={16} style={{ color: 'var(--clr-danger)' }} />
              <h2 className="card-title" style={{ color: 'var(--clr-danger)' }}>
                Attention: Deterministic Anomalies
              </h2>
            </div>
            <span className="text-xs text-muted">
              Calculated deviations against historical baselines. Zero AI assumptions.
            </span>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {anomalies.map((anom) => (
                <div
                  key={anom.id}
                  style={{
                    background: 'rgba(0, 0, 0, 0.2)',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    borderLeft: `3px solid ${anom.severity === 'CRITICAL' ? 'var(--clr-danger)' : 'var(--clr-warning)'}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                      {anom.title}
                    </span>
                    <span
                      className={`badge ${anom.severity === 'CRITICAL' ? 'badge-danger' : 'badge-warning'}`}
                      style={{ fontSize: 10 }}
                    >
                      {anom.severity}
                    </span>
                  </div>
                  <p style={{ margin: '2px 0 6px 0', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                    {anom.description}
                  </p>
                  <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-muted)' }}>
                    <span>Baseline: {anom.baseline}</span>
                    <span>Threshold: {anom.threshold}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Time -> Activity -> KPI -> Efficiency Relationship */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={16} style={{ color: '#8b5cf6' }} />
            <h2 className="card-title">Time & Outcome Observations</h2>
          </div>
          <span className="text-xs text-muted">
            Observed alongside focus sessions: logged activities, KPI snapshots, and operating efficiency
          </span>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {pillars.map((p) => (
              <div
                key={p.pillarId}
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: 16,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
                    <span style={{ fontWeight: 700, fontSize: 'var(--text-base)' }}>{p.title}</span>
                  </div>
                  <span className="badge badge-neutral" style={{ fontSize: 11 }}>
                    {p.focusHours}h focus
                  </span>
                </div>

                {/* Outcomes and efficiency */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)' }}>
                    <span className="text-muted">Activities Logged:</span>
                    <span style={{ fontWeight: 600 }}>{p.activityCount} events</span>
                  </div>

                  {p.efficiency && (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'rgba(139, 92, 246, 0.08)',
                        padding: '6px 10px',
                        borderRadius: 'var(--radius-sm)',
                        marginTop: 4,
                      }}
                    >
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                        {p.efficiency.label}:
                      </span>
                      <span style={{ fontWeight: 700, color: '#8b5cf6', fontSize: 'var(--text-sm)' }}>
                        {p.efficiency.value !== null ? `₹${p.efficiency.value.toLocaleString('en-IN')}/hr` : '—'}
                      </span>
                    </div>
                  )}

                  {/* Active Goals in this pillar */}
                  {p.goals.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div className="text-xs text-muted" style={{ marginBottom: 4 }}>Goal Relationship:</div>
                      {p.goals.slice(0, 2).map((g) => (
                        <div
                          key={g.goalId}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: 11,
                            padding: '4px 0',
                            borderTop: '1px solid rgba(255,255,255,0.04)',
                          }}
                        >
                          <span className="truncate" style={{ maxWidth: 180 }}>{g.title}</span>
                          <span
                            className={`badge ${
                              g.status === 'ACHIEVED' || g.status === 'ON_TRACK'
                                ? 'badge-success'
                                : g.status === 'BEHIND'
                                ? 'badge-danger'
                                : 'badge-neutral'
                            }`}
                            style={{ fontSize: 10 }}
                          >
                            {g.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Movements & Trends */}
      {trends.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={16} style={{ color: 'var(--clr-success)' }} />
              <h2 className="card-title">Period Movements & Changes</h2>
            </div>
            <span className="text-xs text-muted">
              Observed changes compared with {snapshot?.previousPeriod.label}
            </span>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {trends.map((t) => (
                <div
                  key={t.id}
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: 12,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{t.title}</span>
                    {t.percentageChange !== null && (
                      <span
                        className={`badge ${t.favorable !== false ? 'badge-success' : 'badge-danger'}`}
                        style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 2 }}
                      >
                        {t.direction === 'UP' ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                        {t.percentageChange >= 0 ? `+${t.percentageChange}%` : `${t.percentageChange}%`}
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    {t.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* AI Interpretation Layer (Layer 4) */}
      <div style={{ marginTop: 24 }}>
        <AIAnalysisCard
          mode={periodType === 'TODAY' ? 'DAILY' : periodType === 'THIS_WEEK' ? 'WEEKLY' : 'MONTHLY'}
          title={`Layer 4 AI Interpretation — ${periodType === 'TODAY' ? 'Daily' : periodType === 'THIS_WEEK' ? 'Weekly' : 'Monthly'}`}
          allowBrutal={true}
        />
      </div>
    </div>
  );
}
