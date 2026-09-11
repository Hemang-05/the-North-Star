// ============================================================================
// PERSONAL OS — Dashboard (Command Center)
// Overview of all pillars, North Star, today's stats, and activity.
// ============================================================================

import { useMemo, useState, useEffect, useCallback } from 'react';
import {
  Star, Timer, TrendingUp, Zap, Target,
  Briefcase, Building2, LineChart, Heart, Palette,
  Clock, ArrowUpRight, ArrowDownRight, AlertTriangle, BarChart2,
  Compass, ShieldAlert,
} from 'lucide-react';
import { useTodayEvents, useFocusSessions, useDataChangeListener } from '../hooks/useDatabase';
import { PILLARS } from '../config/pillars';
import { formatDuration, formatINR, groupBy, sumBy, formatNumber } from '../utils/helpers';
import { ActivityFeed } from './ActivityFeed';
import { generateIntelligenceSnapshot } from '../services/intelligenceFacts';
import { getPeriodBounds, aggregateFocusSessions } from '../services/timeAggregation';
import { generateCrossPillarIntelligence } from '../services/crossPillarIntelligence';
import { syncAlerts } from '../services/alertEngine';
import { runDataQualityCheck } from '../services/dataQuality';
import type { ViewId } from './Sidebar';
import type { IntelligenceSnapshot } from '../types/intelligence';
import { AIAnalysisCard } from './ai/AIAnalysisCard';

const PILLAR_ICONS: Record<string, React.FC<{ size?: number }>> = {
  Briefcase, Building2, LineChart, TrendingUp: TrendingUp, Heart, Palette,
};

interface DashboardProps {
  onNavigate: (view: ViewId) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { events: todayEvents } = useTodayEvents();
  const { sessions } = useFocusSessions();
  const [snapshot, setSnapshot] = useState<IntelligenceSnapshot | null>(null);

  const [layer5Summary, setLayer5Summary] = useState({
    factsCount: 0,
    openAlertsCount: 0,
    qualityIssuesCount: 0,
    criticalQualityCount: 0,
  });

  const loadLayer5 = useCallback(async () => {
    try {
      const [cpResult, alertsList, dqReport] = await Promise.all([
        generateCrossPillarIntelligence('THIS_WEEK'),
        syncAlerts('THIS_WEEK'),
        runDataQualityCheck('THIS_WEEK'),
      ]);
      setLayer5Summary({
        factsCount: cpResult.facts.length,
        openAlertsCount: alertsList.filter((a) => a.status === 'OPEN').length,
        qualityIssuesCount: dqReport.summary.totalIssues,
        criticalQualityCount: dqReport.summary.criticalCount,
      });
    } catch (e) {
      console.warn('Dashboard Layer 5 load failed:', e);
    }
  }, []);

  useEffect(() => {
    loadLayer5();
  }, [loadLayer5]);

  useDataChangeListener(loadLayer5);

  useEffect(() => {
    generateIntelligenceSnapshot('THIS_WEEK')
      .then((data) => setSnapshot(data))
      .catch((err) => console.error('Dashboard intelligence snapshot error:', err));
  }, []);

  // Compute time summaries for Today, This Week, and This Month
  const weekSummary = useMemo(() => {
    const { current, previous } = getPeriodBounds('THIS_WEEK');
    return aggregateFocusSessions(sessions, current, previous);
  }, [sessions]);

  const monthSummary = useMemo(() => {
    const { current, previous } = getPeriodBounds('THIS_MONTH');
    return aggregateFocusSessions(sessions, current, previous);
  }, [sessions]);

  // Compute today's stats
  const todayStats = useMemo(() => {
    // Events by pillar
    const eventsByPillar = groupBy(todayEvents, (e) => e.pillarId);

    // Today's focus sessions
    const todayStr = new Date().toISOString().split('T')[0];
    const todaySessions = sessions.filter((s) => s.startedAt.startsWith(todayStr));
    const focusByPillar = groupBy(todaySessions, (s) => s.pillarId);

    const totalFocusSeconds = sumBy(todaySessions, (s) => s.durationSeconds);
    const totalEvents = todayEvents.length;

    const pillarStats = PILLARS.map((p) => {
      const pillarEvents = eventsByPillar[p.id] || [];
      const pillarFocus = focusByPillar[p.id] || [];
      const focusSeconds = sumBy(pillarFocus, (s) => s.durationSeconds);

      return {
        pillar: p,
        eventCount: pillarEvents.length,
        focusSeconds,
        categories: groupBy(pillarFocus, (s) => s.category),
      };
    });

    return {
      totalEvents,
      totalFocusSeconds,
      pillarStats,
    };
  }, [todayEvents, sessions]);

  return (
    <div className="page-body">
      {/* North Star Card */}
      <div className="card card-north-star" style={{ marginBottom: 24 }}>
        <div className="card-body" style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Star size={20} style={{ color: 'var(--clr-north-star)' }} />
                <span style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--clr-north-star)',
                }}>
                  North Star
                </span>
              </div>
              <div style={{
                fontSize: 'var(--text-3xl)',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                color: 'var(--clr-north-star)',
                lineHeight: 1.1,
              }}>
                {formatINR(10000000)}
              </div>
              <div className="text-sm text-muted" style={{ marginTop: 4 }}>
                Total business value target · 1 year
              </div>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => onNavigate('north-star')}
              style={{ borderColor: 'rgba(251, 191, 36, 0.2)', color: 'var(--clr-north-star)' }}
            >
              <Target size={14} />
              View Report
            </button>
          </div>

          {/* Pillar contribution indicators */}
          <div style={{ display: 'flex', gap: 16, marginTop: 20, flexWrap: 'wrap' }}>
            {PILLARS.filter(p => ['agency', 'trading_os', 'voire', 'job_hunt'].includes(p.id)).map((p) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {p.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Today's Stats Row */}
      <div className="grid-stats" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-body">
            <div className="stat">
              <div className="stat-label">Focus Time Today</div>
              <div className="stat-value" style={{ color: '#6366f1' }}>
                {todayStats.totalFocusSeconds > 0
                  ? formatDuration(todayStats.totalFocusSeconds)
                  : '0m'}
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="stat">
              <div className="stat-label">Events Today</div>
              <div className="stat-value" style={{ color: '#22c55e' }}>
                {formatNumber(todayStats.totalEvents)}
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="stat">
              <div className="stat-label">Active Pillars</div>
              <div className="stat-value" style={{ color: '#f59e0b' }}>
                {todayStats.pillarStats.filter((p) => p.eventCount > 0 || p.focusSeconds > 0).length}
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}> / 6</span>
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="stat">
              <div className="stat-label">Longest Session</div>
              <div className="stat-value" style={{ color: '#ec4899' }}>
                {sessions.length > 0
                  ? formatDuration(
                      Math.max(
                        ...sessions
                          .filter((s) => s.startedAt.startsWith(new Date().toISOString().split('T')[0]))
                          .map((s) => s.durationSeconds),
                        0
                      )
                    )
                  : '—'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Layer 5 Cross-Pillar & System Integrity Section */}
      <div className="card" style={{
        marginBottom: 24,
        background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.04) 0%, rgba(15, 23, 42, 0.4) 100%)',
        border: '1px solid rgba(236, 72, 153, 0.25)',
      }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Compass size={18} style={{ color: '#ec4899' }} />
            <div>
              <h2 className="card-title" style={{ margin: 0, fontSize: 'var(--text-base)' }}>Cross-Pillar & System Integrity</h2>
              <div className="text-xs text-muted">Layer 5 derived intelligence, active exceptions, and data trustworthiness</div>
            </div>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onNavigate('insights')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <ShieldAlert size={14} style={{ color: '#ec4899' }} />
            <span>View All Insights</span>
          </button>
        </div>

        <div className="card-body" style={{ paddingTop: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <div
              style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', cursor: 'pointer' }}
              onClick={() => onNavigate('insights')}
            >
              <div className="stat-label">Cross-Pillar Observations</div>
              <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: '#06b6d4', marginTop: 2 }}>
                {layer5Summary.factsCount}
              </div>
              <div className="text-xs text-muted">Tradeoffs & allocations</div>
            </div>

            <div
              style={{
                background: layer5Summary.openAlertsCount > 0 ? 'rgba(239, 68, 68, 0.05)' : 'rgba(255,255,255,0.02)',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                border: layer5Summary.openAlertsCount > 0 ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid var(--border-color)',
                cursor: 'pointer',
              }}
              onClick={() => onNavigate('insights')}
            >
              <div className="stat-label">Open Alerts</div>
              <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: layer5Summary.openAlertsCount > 0 ? '#ef4444' : '#22c55e', marginTop: 2 }}>
                {layer5Summary.openAlertsCount}
              </div>
              <div className="text-xs text-muted">
                {layer5Summary.openAlertsCount > 0 ? 'Exceptions pending' : 'All clear'}
              </div>
            </div>

            <div
              style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', cursor: 'pointer' }}
              onClick={() => onNavigate('insights')}
            >
              <div className="stat-label">Data Quality Issues</div>
              <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: layer5Summary.qualityIssuesCount > 0 ? '#f59e0b' : 'var(--text-primary)', marginTop: 2 }}>
                {layer5Summary.qualityIssuesCount}
              </div>
              <div className="text-xs text-muted">
                {layer5Summary.criticalQualityCount > 0 ? `${layer5Summary.criticalQualityCount} critical` : 'Structural integrity verified'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Time & Intelligence Section (Layer 3) */}
      <div className="card" style={{ marginBottom: 24, border: '1px solid rgba(99, 102, 241, 0.25)' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={18} style={{ color: '#6366f1' }} />
            <div>
              <h2 className="card-title" style={{ margin: 0 }}>Time & Intelligence</h2>
              <div className="text-xs text-muted">Deterministic allocation, period movement, and goal reality</div>
            </div>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onNavigate('time')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <BarChart2 size={14} />
            <span>Full Intelligence</span>
          </button>
        </div>

        <div className="card-body">
          {/* Time Comparison Grid: Today, Week, Month */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div className="stat-label">Focus Today</div>
              <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: '#6366f1', marginTop: 2 }}>
                {Math.round((todayStats.totalFocusSeconds / 3600) * 10) / 10}h
              </div>
              <div className="text-xs text-muted">{Math.floor(todayStats.totalFocusSeconds / 60)} minutes</div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="stat-label">This Week</div>
                {weekSummary.changePercent !== null && weekSummary.changePercent !== undefined && (
                  <span className={`badge ${weekSummary.changePercent >= 0 ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: 10 }}>
                    {weekSummary.changePercent >= 0 ? '+' : ''}{weekSummary.changePercent}%
                  </span>
                )}
              </div>
              <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: '#8b5cf6', marginTop: 2 }}>
                {weekSummary.totalHours}h
              </div>
              <div className="text-xs text-muted">{weekSummary.sessionCount} sessions · {weekSummary.deepWorkMinutes}m deep</div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div className="stat-label">This Month</div>
              <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: '#06b6d4', marginTop: 2 }}>
                {monthSummary.totalHours}h
              </div>
              <div className="text-xs text-muted">{monthSummary.sessionCount} sessions total</div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div className="stat-label">Priority Alignment</div>
              <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: '#f59e0b', marginTop: 2 }}>
                {weekSummary.priorityAlignedPercent}%
              </div>
              <div className="text-xs text-muted">Top 3 priority pillars</div>
            </div>
          </div>

          {/* Distribution Bar */}
          {weekSummary.totalMinutes > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                <span>Weekly Time Distribution by Pillar</span>
                <span>{weekSummary.totalHours}h total</span>
              </div>
              <div
                style={{
                  height: 10,
                  borderRadius: 'var(--radius-full)',
                  display: 'flex',
                  overflow: 'hidden',
                  background: 'rgba(255,255,255,0.05)',
                }}
              >
                {weekSummary.pillarDetails.map((p) => {
                  if (p.sharePercent <= 0) return null;
                  return (
                    <div
                      key={p.pillarId}
                      style={{ width: `${p.sharePercent}%`, background: p.color }}
                      title={`${p.title}: ${p.hours}h (${p.sharePercent}%)`}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Goal Reality Counters & Movements */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            {/* Goal Reality Status */}
            {snapshot?.goalStats && (
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 'var(--radius-md)' }}>
                <div className="text-xs text-muted" style={{ marginBottom: 8, fontWeight: 600 }}>
                  GOAL REALITY STATUS
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span className="badge badge-success" style={{ fontSize: 11 }}>
                    {snapshot.goalStats.achieved} Achieved
                  </span>
                  <span className="badge badge-primary" style={{ fontSize: 11 }}>
                    {snapshot.goalStats.ahead} Ahead
                  </span>
                  <span className="badge badge-success" style={{ fontSize: 11 }}>
                    {snapshot.goalStats.onTrack} On Track
                  </span>
                  <span className="badge badge-danger" style={{ fontSize: 11 }}>
                    {snapshot.goalStats.behind} Behind
                  </span>
                  {snapshot.goalStats.noData > 0 && (
                    <span className="badge badge-warning" style={{ fontSize: 11 }}>
                      {snapshot.goalStats.noData} No Data
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Significant Movements */}
            {snapshot?.biggestMovements && (
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 'var(--radius-md)' }}>
                <div className="text-xs text-muted" style={{ marginBottom: 8, fontWeight: 600 }}>
                  KEY MOVEMENTS
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--text-xs)' }}>
                  {snapshot.biggestMovements.positive ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--clr-success)' }}>
                      <ArrowUpRight size={14} />
                      <span className="truncate">{snapshot.biggestMovements.positive.title}: {snapshot.biggestMovements.positive.description}</span>
                    </div>
                  ) : (
                    <span className="text-muted">No material positive surge</span>
                  )}

                  {snapshot.biggestMovements.negative ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--clr-danger)' }}>
                      <ArrowDownRight size={14} />
                      <span className="truncate">{snapshot.biggestMovements.negative.title}: {snapshot.biggestMovements.negative.description}</span>
                    </div>
                  ) : (
                    <span className="text-muted">No material negative contraction</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Attention Anomalies if any */}
          {snapshot?.anomalies && snapshot.anomalies.length > 0 && (
            <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={14} style={{ color: 'var(--clr-danger)', flexShrink: 0 }} />
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-primary)' }}>
                <strong>Attention:</strong> {snapshot.anomalies[0].title} — {snapshot.anomalies[0].description}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Layer 4 AI Intelligence Summary */}
      <AIAnalysisCard
        title="AI Intelligence Briefing"
        mode="DAILY"
        compact={true}
        allowBrutal={true}
        onViewFull={() => onNavigate('time')}
        style={{ marginBottom: 24 }}
      />

      {/* Pillars Grid + Activity Feed */}
      <div className="grid-2" style={{ alignItems: 'flex-start' }}>
        {/* Pillars Status */}
        <div>
          <div style={{
            fontSize: 'var(--text-md)',
            fontWeight: 700,
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <Zap size={16} style={{ color: 'var(--clr-success)' }} />
            Pillar Activity
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {todayStats.pillarStats.map((ps, idx) => {
              const IconComp = PILLAR_ICONS[ps.pillar.icon];
              const hasActivity = ps.eventCount > 0 || ps.focusSeconds > 0;
              return (
                <button
                  key={ps.pillar.id}
                  className="card card-pillar"
                  style={{
                    '--pillar-color': ps.pillar.color,
                    animationDelay: `${idx * 60}ms`,
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'left',
                  } as React.CSSProperties}
                  onClick={() => onNavigate(ps.pillar.id as ViewId)}
                >
                  <div className="card-body" style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32,
                          height: 32,
                          borderRadius: 'var(--radius-md)',
                          background: `${ps.pillar.color}15`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: ps.pillar.color,
                        }}>
                          {IconComp ? <IconComp size={16} /> : <div style={{ width: 8, height: 8, borderRadius: '50%', background: ps.pillar.color }} />}
                        </div>
                        <div>
                          <div style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>
                            {ps.pillar.title}
                          </div>
                          <div className="text-xs text-muted">
                            Priority #{ps.pillar.priorityRank}
                            {ps.pillar.id === 'voire' ? ' · Weekend focus' : ''}
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        {hasActivity ? (
                          <>
                            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: ps.pillar.color }}>
                              {ps.eventCount} events
                            </div>
                            {ps.focusSeconds > 0 && (
                              <div className="text-xs text-muted">
                                {formatDuration(ps.focusSeconds)}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="badge badge-neutral" style={{ fontSize: 10 }}>
                            No activity
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Activity Feed */}
        <div>
          <ActivityFeed limit={15} />
        </div>
      </div>

      {/* Quick Actions Row */}
      <div style={{ marginTop: 24, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={() => onNavigate('quick-capture')}>
          <Zap size={16} />
          Quick Capture
        </button>
        <button className="btn btn-ghost" onClick={() => onNavigate('timer')}>
          <Timer size={16} />
          Start Focus
        </button>
        <button className="btn btn-ghost" onClick={() => onNavigate('north-star')} style={{ borderColor: 'rgba(251, 191, 36, 0.2)', color: 'var(--clr-north-star)' }}>
          <Star size={16} />
          North Star
        </button>
      </div>
    </div>
  );
}
