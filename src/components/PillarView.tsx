// ============================================================================
// PERSONAL OS — Generic Pillar Detail View
// Shows pillar-specific overview, quick-capture, activity, and KPIs.
// ============================================================================

import { useMemo } from 'react';
import {
  Briefcase, Building2, LineChart, TrendingUp, Heart, Palette,
  Zap, Timer, Target, ChevronRight,
} from 'lucide-react';
import { useTodayEvents, useFocusSessions, useGoals, logEvent } from '../hooks/useDatabase';
import { PILLARS, QUICK_EVENTS } from '../config/pillars';
import { formatDuration, groupBy, sumBy, formatNumber } from '../utils/helpers';
import { showToast } from './Toast';
import type { PillarSlug } from '../types';
import type { ViewId } from './Sidebar';

const PILLAR_ICONS: Record<string, React.FC<{ size?: number }>> = {
  Briefcase, Building2, LineChart, TrendingUp: TrendingUp, Heart, Palette,
};

// Pillar-specific descriptions
const PILLAR_DESCRIPTIONS: Record<string, string> = {
  job_hunt: 'Full-time role · ₹9-12 LPA · Full-stack / AI Engineer · Remote preferred',
  agency: '₹6L+/month revenue · 5+ active clients · Team of 3 · Inbound leads',
  trading_os: '100+ users · 10-20% paying · ₹100/month · Serious SaaS product',
  forex: 'Master fundamentals · Develop setup · Backtest systematically · Build discipline',
  fitness: '65-70 kg · V-taper physique · 5 km daily · 30 kg bench each side',
  voire: 'D2C clothing brand · Weekend creative · Drop-based launches · Profitable',
};

// Pillar KPI labels
const PILLAR_KPIS: Record<string, { key: string; label: string; emoji: string }[]> = {
  job_hunt: [
    { key: 'JOB_APPLICATION_SUBMITTED', label: 'Applications', emoji: '📨' },
    { key: 'JOB_OUTREACH_SENT', label: 'Outreach', emoji: '💬' },
    { key: 'JOB_REPLY_RECEIVED', label: 'Replies', emoji: '📩' },
    { key: 'JOB_INTERVIEW_BOOKED', label: 'Interviews', emoji: '🎯' },
  ],
  agency: [
    { key: 'AGENCY_LEAD_FOUND', label: 'Leads Found', emoji: '🎣' },
    { key: 'AGENCY_PROPOSAL_SENT', label: 'Proposals', emoji: '📄' },
    { key: 'AGENCY_CLIENT_CALL', label: 'Calls', emoji: '📞' },
    { key: 'AGENCY_PAYMENT_RECEIVED', label: 'Payments', emoji: '💰' },
  ],
  trading_os: [
    { key: 'SAAS_FEATURE_COMPLETED', label: 'Features Done', emoji: '🚀' },
    { key: 'SAAS_BUG_FIXED', label: 'Bugs Fixed', emoji: '🐛' },
    { key: 'SAAS_USER_REGISTERED', label: 'New Users', emoji: '👤' },
    { key: 'SAAS_CONTENT_PUBLISHED', label: 'Posts', emoji: '📢' },
  ],
  forex: [
    { key: 'FOREX_STUDY_SESSION', label: 'Study Sessions', emoji: '📖' },
    { key: 'FOREX_PAPER_TRADE', label: 'Paper Trades', emoji: '📊' },
    { key: 'FOREX_BACKTEST_RUN', label: 'Backtests', emoji: '🔬' },
    { key: 'FOREX_RULE_VIOLATION', label: 'Rule Violations', emoji: '⚠️' },
  ],
  fitness: [
    { key: 'FITNESS_WORKOUT_DONE', label: 'Workouts', emoji: '💪' },
    { key: 'FITNESS_RUN_COMPLETED', label: 'Runs', emoji: '🏃' },
    { key: 'FITNESS_MEAL_LOGGED', label: 'Meals Logged', emoji: '🍽️' },
    { key: 'FITNESS_SLEEP_LOGGED', label: 'Sleep Logs', emoji: '😴' },
  ],
  voire: [
    { key: 'VOIRE_DESIGN_IDEA', label: 'Design Ideas', emoji: '✨' },
    { key: 'VOIRE_ORDER_RECEIVED', label: 'Orders', emoji: '🛒' },
    { key: 'VOIRE_CONTENT_POSTED', label: 'Content', emoji: '📸' },
    { key: 'VOIRE_DESIGN_APPROVED', label: 'Approved', emoji: '✅' },
  ],
};

interface PillarViewProps {
  pillarId: PillarSlug;
  onNavigate: (view: ViewId) => void;
}

export function PillarView({ pillarId, onNavigate }: PillarViewProps) {
  const pillar = PILLARS.find((p) => p.id === pillarId)!;
  const { events: todayEvents } = useTodayEvents();
  const { sessions } = useFocusSessions();
  const { goals } = useGoals();

  const pillarGoals = goals.filter((g) => g.pillarId === pillarId);
  const IconComp = PILLAR_ICONS[pillar.icon];
  const quickEvents = QUICK_EVENTS[pillarId] || [];
  const kpis = PILLAR_KPIS[pillarId] || [];

  // Compute pillar stats
  const stats = useMemo(() => {
    const pillarEvents = todayEvents.filter((e) => e.pillarId === pillarId);
    const todayStr = new Date().toISOString().split('T')[0];
    const pillarSessions = sessions.filter((s) => s.pillarId === pillarId && s.startedAt.startsWith(todayStr));
    const focusSeconds = sumBy(pillarSessions, (s) => s.durationSeconds);
    const eventsByType = groupBy(pillarEvents, (e) => e.eventType);

    // KPI values
    const kpiValues = kpis.map((kpi) => ({
      ...kpi,
      todayCount: (eventsByType[kpi.key] || []).length,
    }));

    return {
      totalEvents: pillarEvents.length,
      focusSeconds,
      kpiValues,
      categories: groupBy(pillarSessions, (s) => s.category),
    };
  }, [todayEvents, sessions, pillarId, kpis]);

  const handleQuickLog = async (eventType: string, label: string) => {
    await logEvent(pillarId, eventType);
    showToast(`✓ ${label} recorded`, 'success', 2000);
  };

  return (
    <div className="page-body">
      {/* Pillar Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 'var(--radius-lg)',
            background: `${pillar.color}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: pillar.color,
          }}>
            {IconComp ? <IconComp size={22} /> : <div style={{ width: 12, height: 12, borderRadius: '50%', background: pillar.color }} />}
          </div>
          <div>
            <h1 style={{
              fontSize: 'var(--text-xl)',
              fontWeight: 800,
              letterSpacing: '-0.02em',
            }}>
              {pillar.title}
            </h1>
            <p className="text-sm text-muted">
              {PILLAR_DESCRIPTIONS[pillarId]}
            </p>
          </div>
          <span className="badge badge-neutral" style={{ marginLeft: 'auto' }}>
            Priority #{pillar.priorityRank}
          </span>
        </div>
      </div>

      {/* Today's KPIs */}
      <div className="grid-stats" style={{ marginBottom: 20 }}>
        {stats.kpiValues.map((kpi) => (
          <div key={kpi.key} className="card">
            <div className="card-body" style={{ padding: '12px 16px' }}>
              <div className="stat">
                <div className="stat-label">{kpi.emoji} {kpi.label}</div>
                <div className="stat-value" style={{ color: pillar.color }}>
                  {formatNumber(kpi.todayCount)}
                </div>
                <div className="stat-delta neutral">today</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Focus & Events Summary */}
      <div className="grid-2" style={{ marginBottom: 20, gridTemplateColumns: '1fr 1fr' }}>
        <div className="card">
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Timer size={18} style={{ color: pillar.color }} />
            <div>
              <div className="stat-label">Focus Time Today</div>
              <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: pillar.color }}>
                {stats.focusSeconds > 0 ? formatDuration(stats.focusSeconds) : '0m'}
              </div>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              style={{ marginLeft: 'auto' }}
              onClick={() => onNavigate('timer')}
            >
              Start <ChevronRight size={12} />
            </button>
          </div>
        </div>
        <div className="card">
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Zap size={18} style={{ color: 'var(--clr-success)' }} />
            <div>
              <div className="stat-label">Total Events Today</div>
              <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>
                {formatNumber(stats.totalEvents)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Capture for this pillar */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={14} style={{ color: 'var(--clr-success)' }} />
            Quick Capture
          </div>
        </div>
        <div className="card-body">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
            gap: 8,
          }}>
            {quickEvents.map((evt) => (
              <button
                key={evt.eventType}
                className="quick-action-btn"
                onClick={() => handleQuickLog(evt.eventType, evt.label)}
              >
                <span className="emoji">{evt.emoji}</span>
                <span>{evt.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Goals */}
      {pillarGoals.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Target size={14} />
              Goals
            </div>
          </div>
          <div className="card-body">
            {pillarGoals.map((g) => {
              const progress = g.targetValue > 0 ? (g.currentComputedValue / g.targetValue) * 100 : 0;
              return (
                <div key={g.id} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span className="text-sm font-semibold">{g.title}</span>
                    <span className="text-xs text-muted">
                      {g.currentComputedValue} / {g.targetValue} {g.unit}
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${Math.min(progress, 100)}%`,
                        background: pillar.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Focus Categories Breakdown */}
      {Object.keys(stats.categories).length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <div className="card-title">Focus Breakdown</div>
          </div>
          <div className="card-body">
            {Object.entries(stats.categories).map(([cat, catSessions]) => {
              const catDuration = sumBy(catSessions, (s) => s.durationSeconds);
              return (
                <div key={cat} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 0',
                  borderBottom: '1px solid var(--border-subtle)',
                }}>
                  <span className="text-sm">{cat}</span>
                  <span className="text-sm font-semibold" style={{ color: pillar.color, fontFamily: 'var(--font-mono)' }}>
                    {formatDuration(catDuration)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
