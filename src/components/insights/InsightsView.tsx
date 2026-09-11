// ============================================================================
// PERSONAL OS — Insights & Integrity Console (Layer 5)
// Universal console for Cross-Pillar Intelligence, Alerts & Exceptions,
// and Data Quality & Integrity.
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert, Compass, CheckCircle2,
  RefreshCw, Filter, Eye, Check,
  Layers, Database
} from 'lucide-react';
import type { PillarSlug, TimePeriodType, PeriodBounds } from '../../types';
import type {
  CrossPillarFact,
  Alert,
  AlertStatus,
  DataQualityReport,
  DataQualityCategory,
} from '../../types/layer5';
import { PILLARS, PILLAR_MAP } from '../../config/pillars';
import { generateCrossPillarIntelligence } from '../../services/crossPillarIntelligence';
import { syncAlerts, acknowledgeAlert, resolveAlert } from '../../services/alertEngine';
import { runDataQualityCheck } from '../../services/dataQuality';
import { dbGetAll, STORES } from '../../services/db';
import { useDataChangeListener } from '../../hooks/useDatabase';
import { showToast } from '../Toast';
import type { ViewId } from '../Sidebar';

interface InsightsViewProps {
  onNavigate?: (view: ViewId) => void;
}

type TabMode = 'CROSS_PILLAR' | 'ALERTS' | 'DATA_QUALITY';

const SEVERITY_BADGES = {
  CRITICAL: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.3)', label: 'Critical' },
  WARNING: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.3)', label: 'Warning' },
  INFO: { color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.12)', border: 'rgba(6, 182, 212, 0.3)', label: 'Info' },
};

export function InsightsView({ onNavigate }: InsightsViewProps) {
  const [activeTab, setActiveTab] = useState<TabMode>('CROSS_PILLAR');
  const [periodType, setPeriodType] = useState<TimePeriodType>('THIS_WEEK');
  const [loading, setLoading] = useState(true);

  // Layer 5 Data State
  const [facts, setFacts] = useState<CrossPillarFact[]>([]);
  const [periodBounds, setPeriodBounds] = useState<PeriodBounds | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [qualityReport, setQualityReport] = useState<DataQualityReport | null>(null);

  // Filters
  const [alertStatusFilter, setAlertStatusFilter] = useState<'ALL' | AlertStatus>('ALL');
  const [alertSeverityFilter, setAlertSeverityFilter] = useState<string>('ALL');
  const [alertPillarFilter, setAlertPillarFilter] = useState<string>('ALL');
  const [qualityCategoryFilter, setQualityCategoryFilter] = useState<'ALL' | DataQualityCategory>('ALL');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [cpResult, allStoredAlerts, dqReport] = await Promise.all([
        generateCrossPillarIntelligence(periodType),
        dbGetAll<Alert>(STORES.ALERTS),
        runDataQualityCheck(periodType),
        syncAlerts(periodType),
      ]);

      setFacts(cpResult.facts);
      setPeriodBounds(cpResult.period);
      setQualityReport(dqReport);

      // Filter or sort alerts by latest detection
      const sortedAlerts = [...allStoredAlerts].sort(
        (a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
      );
      setAlerts(sortedAlerts);
    } catch (err) {
      console.error('Failed to load Layer 5 insights:', err);
      showToast('Error loading insights and alerts', 'error');
    } finally {
      setLoading(false);
    }
  }, [periodType]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useDataChangeListener(loadData);

  const handleAcknowledge = async (id: string) => {
    try {
      await acknowledgeAlert(id);
      showToast('Alert acknowledged', 'info');
      await loadData();
    } catch {
      showToast('Failed to acknowledge alert', 'error');
    }
  };

  const handleResolve = async (id: string) => {
    try {
      await resolveAlert(id);
      showToast('Alert marked as resolved', 'success');
      await loadData();
    } catch {
      showToast('Failed to resolve alert', 'error');
    }
  };

  // Filtered Alerts
  const filteredAlerts = alerts.filter((a) => {
    if (alertStatusFilter !== 'ALL' && a.status !== alertStatusFilter) return false;
    if (alertSeverityFilter !== 'ALL' && a.severity !== alertSeverityFilter) return false;
    if (alertPillarFilter !== 'ALL' && !a.pillarIds.includes(alertPillarFilter as PillarSlug)) return false;
    return true;
  });

  const openAlertsCount = alerts.filter((a) => a.status === 'OPEN').length;

  return (
    <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' }}>
      {/* 1. COMMAND HEADER */}
      <div className="card" style={{
        padding: 24,
        background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%)',
        border: '1px solid rgba(236, 72, 153, 0.25)',
        minWidth: 0, maxWidth: '100%', boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Compass size={22} style={{ color: '#ec4899' }} />
              <span style={{ fontSize: 'var(--text-lg)', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                Cross-Pillar Intelligence & Data Integrity
              </span>
              <span style={{
                fontSize: '11px', padding: '2px 8px', borderRadius: 4,
                background: 'rgba(236, 72, 153, 0.15)', color: '#ec4899', fontWeight: 600,
              }}>
                Layer 5
              </span>
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              Deterministic cross-pillar relationship detection, operational exception tracking, and transactional data quality.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Period Selector */}
            <select
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value as TimePeriodType)}
              className="input"
              style={{ padding: '6px 12px', fontSize: 'var(--text-xs)', width: 'auto' }}
            >
              <option value="TODAY">Today</option>
              <option value="THIS_WEEK">This Week</option>
              <option value="THIS_MONTH">This Month</option>
            </select>

            <button
              className="btn btn-secondary btn-sm"
              onClick={loadData}
              disabled={loading}
              style={{ gap: 6 }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* METRIC RIBBON */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12, marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          minWidth: 0, width: '100%',
        }}>
          <div className="card" style={{ padding: '10px 14px', background: 'rgba(255, 255, 255, 0.02)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: 2 }}>Cross-Pillar Facts</div>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#06b6d4' }}>
              {facts.length}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Observations across 6 pillars</div>
          </div>

          <div className="card" style={{
            padding: '10px 14px',
            background: openAlertsCount > 0 ? 'rgba(239, 68, 68, 0.05)' : 'rgba(255, 255, 255, 0.02)',
            border: openAlertsCount > 0 ? '1px solid rgba(239, 68, 68, 0.2)' : undefined,
          }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: 2 }}>Open Alerts</div>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: openAlertsCount > 0 ? '#ef4444' : '#22c55e' }}>
              {openAlertsCount}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
              {openAlertsCount > 0 ? 'Requires attention' : 'All clear'}
            </div>
          </div>

          <div className="card" style={{
            padding: '10px 14px',
            background: (qualityReport?.summary.criticalCount || 0) > 0 ? 'rgba(245, 158, 11, 0.05)' : 'rgba(255, 255, 255, 0.02)',
          }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: 2 }}>Data Quality Issues</div>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: (qualityReport?.summary.criticalCount || 0) > 0 ? '#f59e0b' : 'var(--text-primary)' }}>
              {qualityReport?.summary.totalIssues ?? 0}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
              {qualityReport?.summary.criticalCount ?? 0} critical, {qualityReport?.summary.warningCount ?? 0} warnings
            </div>
          </div>
        </div>
      </div>

      {/* 2. LAYER 5 TAB NAVIGATION */}
      <div style={{
        display: 'flex', gap: 8, borderBottom: '1px solid var(--border-subtle)',
        paddingBottom: 2, overflowX: 'auto', minWidth: 0, maxWidth: '100%', width: '100%',
      }}>
        <button
          className={`btn btn-sm ${activeTab === 'CROSS_PILLAR' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('CROSS_PILLAR')}
          style={{ gap: 6, whiteSpace: 'nowrap' }}
        >
          <Layers size={14} /> Cross-Pillar Observations ({facts.length})
        </button>

        <button
          className={`btn btn-sm ${activeTab === 'ALERTS' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('ALERTS')}
          style={{ gap: 6, whiteSpace: 'nowrap' }}
        >
          <ShieldAlert size={14} /> Alerts & Exceptions ({openAlertsCount} Open)
        </button>

        <button
          className={`btn btn-sm ${activeTab === 'DATA_QUALITY' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('DATA_QUALITY')}
          style={{ gap: 6, whiteSpace: 'nowrap' }}
        >
          <Database size={14} /> Data Quality & Integrity ({qualityReport?.summary.totalIssues ?? 0})
        </button>
      </div>

      {/* 3. TAB CONTENT */}
      {/* ==================================================================== */}
      {/* TAB 1: CROSS-PILLAR INTELLIGENCE */}
      {/* ==================================================================== */}
      {activeTab === 'CROSS_PILLAR' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0, maxWidth: '100%' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            Strictly observational relationship detection across the 6 pillars. Never asserts causality.
          </div>

          {facts.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
              No cross-pillar imbalances, tradeoffs, or divergences detected for {periodBounds?.label || 'this period'}.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
              {facts.map((fact) => {
                const sBadge = SEVERITY_BADGES[fact.severity] || SEVERITY_BADGES.INFO;
                return (
                  <div
                    key={fact.id}
                    className="card"
                    style={{
                      padding: 16,
                      border: `1px solid ${sBadge.border}`,
                      background: 'rgba(255, 255, 255, 0.02)',
                      display: 'flex', flexDirection: 'column', gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '10px', padding: '2px 8px', borderRadius: 4,
                          background: sBadge.bg, color: sBadge.color, fontWeight: 700,
                        }}>
                          {fact.type.replace(/_/g, ' ')}
                        </span>

                        {fact.pillarIds.map((pId) => {
                          const pCfg = PILLAR_MAP[pId];
                          return (
                            <button
                              key={pId}
                              onClick={() => onNavigate?.(pId)}
                              style={{
                                fontSize: '10px', padding: '2px 6px', borderRadius: 4,
                                background: `${pCfg?.color || '#fff'}15`, color: pCfg?.color || '#fff',
                                fontWeight: 600, border: 'none', cursor: onNavigate ? 'pointer' : 'default',
                              }}
                            >
                              {pCfg?.title || pId}
                            </button>
                          );
                        })}
                      </div>

                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {fact.severity}
                      </span>
                    </div>

                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {fact.title}
                    </div>

                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {fact.description}
                    </div>

                    {fact.evidence && fact.evidence.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                        {fact.evidence.map((ev, idx) => (
                          <span
                            key={idx}
                            style={{
                              fontSize: '10px', padding: '2px 6px', borderRadius: 4,
                              background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)',
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            {ev.sourceType}: {String(ev.value ?? ev.sourceId)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: ALERTS & EXCEPTIONS */}
      {/* ==================================================================== */}
      {activeTab === 'ALERTS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0, maxWidth: '100%' }}>
          {/* TOOLBAR */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Filter size={14} style={{ color: 'var(--text-muted)' }} />
              <select
                value={alertStatusFilter}
                onChange={(e) => setAlertStatusFilter(e.target.value as any)}
                className="input"
                style={{ padding: '4px 8px', fontSize: 'var(--text-xs)', width: 'auto' }}
              >
                <option value="ALL">All Statuses</option>
                <option value="OPEN">Open Only</option>
                <option value="ACKNOWLEDGED">Acknowledged Only</option>
                <option value="RESOLVED">Resolved Only</option>
              </select>

              <select
                value={alertSeverityFilter}
                onChange={(e) => setAlertSeverityFilter(e.target.value)}
                className="input"
                style={{ padding: '4px 8px', fontSize: 'var(--text-xs)', width: 'auto' }}
              >
                <option value="ALL">All Severities</option>
                <option value="CRITICAL">Critical Only</option>
                <option value="WARNING">Warning Only</option>
                <option value="INFO">Info Only</option>
              </select>

              <select
                value={alertPillarFilter}
                onChange={(e) => setAlertPillarFilter(e.target.value)}
                className="input"
                style={{ padding: '4px 8px', fontSize: 'var(--text-xs)', width: 'auto' }}
              >
                <option value="ALL">All Pillars</option>
                {PILLARS.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>

            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              Showing {filteredAlerts.length} of {alerts.length} historical records
            </div>
          </div>

          {/* ALERTS LIST */}
          {filteredAlerts.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
              No alerts match the selected filters.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredAlerts.map((alert) => {
                const sBadge = SEVERITY_BADGES[alert.severity] || SEVERITY_BADGES.INFO;
                const isResolved = alert.status === 'RESOLVED';
                const isAcknowledged = alert.status === 'ACKNOWLEDGED';

                return (
                  <div
                    key={alert.id}
                    className="card"
                    style={{
                      padding: 16,
                      border: !isResolved && alert.severity === 'CRITICAL' ? `1px solid ${sBadge.border}` : undefined,
                      opacity: isResolved ? 0.65 : 1,
                      display: 'flex', flexDirection: 'column', gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '10px', padding: '2px 8px', borderRadius: 4,
                          background: sBadge.bg, color: sBadge.color, fontWeight: 700,
                        }}>
                          {alert.severity}
                        </span>

                        <span style={{
                          fontSize: '10px', padding: '2px 8px', borderRadius: 4,
                          background: alert.status === 'OPEN' ? 'rgba(239, 68, 68, 0.15)' : alert.status === 'ACKNOWLEDGED' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                          color: alert.status === 'OPEN' ? '#ef4444' : alert.status === 'ACKNOWLEDGED' ? '#f59e0b' : '#22c55e',
                          fontWeight: 700,
                        }}>
                          {alert.status}
                        </span>

                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {alert.type}
                        </span>

                        {alert.pillarIds.map((pId) => (
                          <button
                            key={pId}
                            onClick={() => onNavigate?.(pId)}
                            style={{
                              fontSize: '10px', padding: '2px 6px', borderRadius: 4,
                              background: `${PILLAR_MAP[pId]?.color || '#fff'}15`,
                              color: PILLAR_MAP[pId]?.color || '#fff', fontWeight: 600,
                              border: 'none', cursor: onNavigate ? 'pointer' : 'default',
                            }}
                          >
                            {PILLAR_MAP[pId]?.title || pId}
                          </button>
                        ))}
                      </div>

                      {/* Action buttons */}
                      {!isResolved && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {!isAcknowledged && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleAcknowledge(alert.id)}
                              style={{ padding: '4px 8px', fontSize: '11px', gap: 4 }}
                            >
                              <Eye size={12} /> Acknowledge
                            </button>
                          )}
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleResolve(alert.id)}
                            style={{ padding: '4px 8px', fontSize: '11px', gap: 4, color: '#22c55e' }}
                          >
                            <Check size={12} /> Resolve
                          </button>
                        </div>
                      )}
                    </div>

                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {alert.title}
                    </div>

                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                      {alert.description}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4, fontSize: '10px', color: 'var(--text-muted)' }}>
                      <div>
                        Detected: {new Date(alert.detectedAt).toLocaleDateString()} {new Date(alert.detectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {alert.resolvedAt && ` • Resolved: ${new Date(alert.resolvedAt).toLocaleDateString()} (${alert.resolutionReason || 'MANUAL'})`}
                      </div>

                      <div style={{ fontFamily: 'var(--font-mono)' }}>
                        FP: {alert.fingerprint}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: DATA QUALITY & INTEGRITY */}
      {/* ==================================================================== */}
      {activeTab === 'DATA_QUALITY' && qualityReport && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0, maxWidth: '100%' }}>
          {/* CATEGORY METRICS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, minWidth: 0 }}>
            {Object.entries(qualityReport.summary.byCategory).map(([cat, count]) => (
              <div
                key={cat}
                className="card"
                style={{
                  padding: 10,
                  cursor: 'pointer',
                  background: qualityCategoryFilter === cat ? 'rgba(255, 255, 255, 0.08)' : undefined,
                  border: count > 0 && (cat === 'TEMPORAL_INTEGRITY' || cat === 'CONSISTENCY')
                    ? '1px solid rgba(239, 68, 68, 0.25)'
                    : undefined,
                }}
                onClick={() => setQualityCategoryFilter(qualityCategoryFilter === cat ? 'ALL' : cat as any)}
              >
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: 2 }}>
                  {cat.replace(/_/g, ' ')}
                </div>
                <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  {count}
                </div>
                <div style={{ fontSize: '9px', color: count > 0 ? '#f59e0b' : '#22c55e' }}>
                  {count === 0 ? 'Clean' : `${count} check${count > 1 ? 's' : ''}`}
                </div>
              </div>
            ))}
          </div>

          {/* ISSUES TABLE */}
          <div className="card" style={{ overflowX: 'auto', padding: 0, minWidth: 0, maxWidth: '100%' }}>
            <table style={{ width: '100%', minWidth: 680, borderCollapse: 'collapse', fontSize: 'var(--text-xs)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px' }}>Severity</th>
                  <th style={{ padding: '12px 16px' }}>Category</th>
                  <th style={{ padding: '12px 16px' }}>Issue Description</th>
                  <th style={{ padding: '12px 16px' }}>Entity Reference</th>
                  <th style={{ padding: '12px 16px' }}>Evidence</th>
                </tr>
              </thead>
              <tbody>
                {qualityReport.issues
                  .filter((issue) => qualityCategoryFilter === 'ALL' || issue.category === qualityCategoryFilter)
                  .map((issue) => {
                    const sBadge = SEVERITY_BADGES[issue.severity] || SEVERITY_BADGES.INFO;
                    return (
                      <tr key={issue.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            display: 'inline-block',
                            fontSize: '10px', padding: '2px 8px', borderRadius: 4,
                            background: sBadge.bg, color: sBadge.color, fontWeight: 700,
                          }}>
                            {issue.severity}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                          {issue.category.replace(/_/g, ' ')}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                            {issue.title}
                          </div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                            {issue.description}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                          {issue.entityRef ? `${issue.entityRef.type}:${issue.entityRef.id}` : (issue.pillarId || 'System')}
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                          {issue.evidence.map((e) => String(e.value ?? e.sourceId)).join(', ') || '—'}
                        </td>
                      </tr>
                    );
                  })}
                {qualityReport.issues.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#22c55e' }}>
                      <CheckCircle2 size={20} style={{ margin: '0 auto 8px', color: '#22c55e' }} />
                      No data quality issues detected. Reality records are structurally sound.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
