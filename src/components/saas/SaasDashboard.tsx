// ============================================================================
// PERSONAL OS — Trading OS → SaaS Command Center (Master Dashboard)
// Priority #3 Console unifying Product / Build Loop & Business / Distribution Loop.
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  Code2, Users, Target, Zap, Activity,
  Play, Plus, Tag, Share2, MessageSquare, ShieldCheck, X,
} from 'lucide-react';
import { useStore, useDataChangeListener, useActiveTimer } from '../../hooks/useDatabase';
import { dbGetAll, STORES } from '../../services/db';
import type {
  SaasFeature,
  SaasTestRun,
  SaasRelease,
  SaasDistributionActivity,
  SaasUserMetricSnapshot,
  SaasFeedback,
  Goal,
  ActivityEvent,
} from '../../types';
import { loadSaasKpiSummary, type SaasKpiSummary } from '../../services/saasKpi';
import {
  evaluateSaasStatus,
  getVerdictStyle,
  type StatusEvaluation,
} from '../../services/statusEngine';
import {
  buildSaasAiFacts,
  generateOfflineSaasAudit,
  type SaasAiFacts,
} from '../../services/aiContext';
import {
  formatINR,
  formatSafePercent,
  timeAgo,
} from '../../utils/helpers';
import { showToast } from '../Toast';
import { FeatureManager } from './FeatureManager';
import { TestingView } from './TestingView';
import { ReleaseManager } from './ReleaseManager';
import { DistributionView } from './DistributionView';
import { UserMetricsView } from './UserMetricsView';
import { FeedbackManager } from './FeedbackManager';
import { SaasGoals } from './SaasGoals';
import { AIAnalysisCard } from '../ai/AIAnalysisCard';
import type { ViewId } from '../Sidebar';

interface SaasDashboardProps {
  onNavigate?: (view: ViewId) => void;
}

type TabType =
  | 'PRODUCT'
  | 'TESTING'
  | 'RELEASES'
  | 'DISTRIBUTION'
  | 'USERS'
  | 'FEEDBACK'
  | 'GOALS'
  | 'AI_AUDIT'
  | 'ACTIVITY';

export function SaasDashboard({ onNavigate: _onNavigate }: SaasDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('PRODUCT');
  const [kpis, setKpis] = useState<SaasKpiSummary | null>(null);
  const [statusEval, setStatusEval] = useState<StatusEvaluation | null>(null);
  const [loading, setLoading] = useState(true);

  // Data stores
  const { items: features } = useStore<SaasFeature>(STORES.SAAS_FEATURES);
  const { items: tests } = useStore<SaasTestRun>(STORES.SAAS_TEST_RUNS);
  const { items: releases } = useStore<SaasRelease>(STORES.SAAS_RELEASES);
  const { items: distribution } = useStore<SaasDistributionActivity>(STORES.SAAS_DISTRIBUTION);
  const { items: snapshots } = useStore<SaasUserMetricSnapshot>(STORES.SAAS_USER_SNAPSHOTS);
  const { items: feedback } = useStore<SaasFeedback>(STORES.SAAS_FEEDBACK);
  const { items: events } = useStore<ActivityEvent>(STORES.EVENTS);
  const { items: goals } = useStore<Goal>(STORES.GOALS);

  // AI State
  const [_aiFacts, setAiFacts] = useState<SaasAiFacts | null>(null);
  const [strategicAudit, setStrategicAudit] = useState<string>('');
  const [loadingAi, setLoadingAi] = useState(false);

  // Focus Timer
  const { session: activeSession, startTimer } = useActiveTimer();
  const [showFocusModal, setShowFocusModal] = useState(false);
  const [selectedFocusCategory, setSelectedFocusCategory] = useState('Product Development');

  // Load KPIs
  const refreshKpis = useCallback(async () => {
    try {
      const summary = await loadSaasKpiSummary();
      const allGoals = await dbGetAll<Goal>(STORES.GOALS);
      const evalResult = evaluateSaasStatus(summary, allGoals);
      setKpis(summary);
      setStatusEval(evalResult);
    } catch (err) {
      console.error('Error computing SaaS KPIs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshKpis();
  }, [refreshKpis]);
  useDataChangeListener(refreshKpis);

  // AI Audit
  const handleGenerateAudit = async () => {
    setLoadingAi(true);
    try {
      const facts = await buildSaasAiFacts();
      const audit = generateOfflineSaasAudit(facts);
      setAiFacts(facts);
      setStrategicAudit(audit);
      showToast('SaaS Strategic Audit generated', 'success');
    } catch (err) {
      console.error('Error generating AI audit:', err);
      showToast('Failed to generate audit', 'error');
    } finally {
      setLoadingAi(false);
    }
  };

  // Focus timer
  const handleStartTimer = async () => {
    await startTimer('trading_os', selectedFocusCategory);
    setShowFocusModal(false);
    showToast(`Focus session started: Trading OS — ${selectedFocusCategory}`, 'success');
  };

  const verdictStyle = statusEval ? getVerdictStyle(statusEval.verdict) : getVerdictStyle('NEGLECTED');

  // SaaS-filtered events for activity tab
  const saasEvents = events
    .filter((e) => e.pillarId === 'trading_os')
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

  if (loading) {
    return (
      <div className="page-body">
        <div className="empty-state">
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            border: '3px solid var(--border-subtle)',
            borderTopColor: '#06b6d4',
            animation: 'spin 0.8s linear infinite', marginBottom: 16,
          }} />
          <div className="empty-state-title">Loading SaaS Command Center...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0, width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
      {/* 1. COMMAND CENTER HEADER */}
      <div className="card" style={{
        padding: 24,
        background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%)',
        border: '1px solid rgba(6, 182, 212, 0.25)',
        minWidth: 0,
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{
                fontSize: '11px', padding: '3px 8px', borderRadius: 4,
                background: 'rgba(6, 182, 212, 0.2)', color: '#06b6d4',
                fontWeight: 700, letterSpacing: '0.04em',
              }}>
                PRIORITY #3
              </span>
              <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
                Trading OS → SaaS Command Center
              </h2>
            </div>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>
              Dual-loop operational console: Product/Build Velocity vs Business/Distribution Growth.
            </p>
          </div>

          {/* VERDICT BADGE */}
          {statusEval && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '8px 16px', borderRadius: 'var(--radius-md)',
              background: verdictStyle.bg, border: `1px solid ${verdictStyle.border}`,
            }}>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Operational Status
                </div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: verdictStyle.color }}>
                  {verdictStyle.label} ({statusEval.score}/100)
                </div>
              </div>
              <div style={{
                width: 12, height: 12, borderRadius: '50%',
                background: verdictStyle.color,
                boxShadow: `0 0 10px ${verdictStyle.color}`,
              }} />
            </div>
          )}
        </div>

        {/* HEALTH HEADLINE */}
        {statusEval && (
          <div style={{
            marginTop: 16, padding: '10px 14px', borderRadius: 'var(--radius-sm)',
            background: 'rgba(0, 0, 0, 0.25)', border: '1px solid rgba(255, 255, 255, 0.05)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
          }}>
            <div>
              <strong style={{ fontSize: 'var(--text-xs)', color: verdictStyle.color }}>
                {statusEval.headline}
              </strong>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginLeft: 8 }}>
                — {statusEval.reason}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {statusEval.badges.map((b) => (
                <span key={b} style={{
                  fontSize: '10px', padding: '2px 8px', borderRadius: 10,
                  background: 'rgba(255, 255, 255, 0.06)', color: 'var(--text-primary)',
                }}>
                  {b}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* QUICK ACTIONS */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: 8, marginTop: 18,
          minWidth: 0, width: '100%',
        }}>
          <button
            className="btn btn-secondary btn-sm"
            style={{ justifyContent: 'center', gap: 6 }}
            onClick={() => setActiveTab('PRODUCT')}
          >
            <Plus size={14} style={{ color: '#06b6d4' }} /> Add Feature
          </button>
          <button
            className="btn btn-secondary btn-sm"
            style={{ justifyContent: 'center', gap: 6 }}
            onClick={() => setActiveTab('TESTING')}
          >
            <ShieldCheck size={14} style={{ color: '#22c55e' }} /> Log Test
          </button>
          <button
            className="btn btn-secondary btn-sm"
            style={{ justifyContent: 'center', gap: 6 }}
            onClick={() => setActiveTab('RELEASES')}
          >
            <Tag size={14} style={{ color: '#8b5cf6' }} /> New Release
          </button>
          <button
            className="btn btn-secondary btn-sm"
            style={{ justifyContent: 'center', gap: 6 }}
            onClick={() => setActiveTab('DISTRIBUTION')}
          >
            <Share2 size={14} style={{ color: '#ec4899' }} /> Distribution
          </button>
          <button
            className="btn btn-secondary btn-sm"
            style={{ justifyContent: 'center', gap: 6 }}
            onClick={() => setActiveTab('USERS')}
          >
            <Users size={14} style={{ color: '#3b82f6' }} /> Record Metrics
          </button>
          <button
            className="btn btn-secondary btn-sm"
            style={{ justifyContent: 'center', gap: 6 }}
            onClick={() => setShowFocusModal(true)}
          >
            <Play size={14} style={{ color: '#f59e0b' }} />
            {activeSession && activeSession.pillarId === 'trading_os' ? 'Timer Active' : 'Focus Timer'}
          </button>
        </div>

        {/* KPI RIBBON */}
        {kpis && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: 10, marginTop: 20, paddingTop: 16,
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            minWidth: 0, width: '100%',
          }}>
            {/* Product Velocity */}
            <div className="card" style={{ padding: '10px 12px', background: 'rgba(255, 255, 255, 0.02)' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: 2 }}>Product Velocity</div>
              <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#06b6d4' }}>
                {kpis.featuresDone} Done / {kpis.featuresInProgress} Dev
              </div>
              <div style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>
                {formatSafePercent(kpis.featureCompletionRate)} completion
              </div>
            </div>

            {/* Quality & Test Pass Rate */}
            <div className="card" style={{ padding: '10px 12px', background: 'rgba(255, 255, 255, 0.02)' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: 2 }}>Test Pass Rate</div>
              <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#22c55e' }}>
                {formatSafePercent(kpis.testPassRate)}
              </div>
              <div style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>
                {kpis.passTestRuns} of {kpis.totalTestRuns} pass
              </div>
            </div>

            {/* Total Users */}
            <div className="card" style={{ padding: '10px 12px', background: 'rgba(255, 255, 255, 0.02)' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: 2 }}>Total Users</div>
              <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#3b82f6' }}>
                {kpis.totalUsers}
              </div>
              <div style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>
                {kpis.activeUsers} active
              </div>
            </div>

            {/* Paying Users & Conversion */}
            <div className="card" style={{ padding: '10px 12px', background: 'rgba(255, 255, 255, 0.02)' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: 2 }}>Paying Users</div>
              <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#22c55e' }}>
                {kpis.payingUsers}
              </div>
              <div style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>
                {formatSafePercent(kpis.payingConversionRate)} conversion
              </div>
            </div>

            {/* Recurring Revenue */}
            <div className="card" style={{ padding: '10px 12px', background: 'rgba(255, 255, 255, 0.02)' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: 2 }}>Recurring Revenue</div>
              <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#8b5cf6' }}>
                {formatINR(kpis.recurringRevenue)}
              </div>
              <div style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>
                MRR observation
              </div>
            </div>

            {/* Distribution */}
            <div className="card" style={{ padding: '10px 12px', background: 'rgba(255, 255, 255, 0.02)' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: 2 }}>Distribution</div>
              <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#ec4899' }}>
                {kpis.distributionThisWeek}
              </div>
              <div style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>
                {kpis.totalDistributionActivities} total activities
              </div>
            </div>

            {/* Build vs Distribution Balance */}
            <div className="card" style={{ padding: '10px 12px', background: 'rgba(255, 255, 255, 0.02)' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: 2 }}>Effort Balance</div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#f59e0b', marginTop: 4 }}>
                {kpis.balanceLabel}
              </div>
              <div style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>
                Observed behavior
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. TABS */}
      <div style={{
        display: 'flex', gap: 6,
        borderBottom: '1px solid var(--border-subtle)',
        paddingBottom: 2, overflowX: 'auto',
        minWidth: 0, maxWidth: '100%', width: '100%',
      }}>
        {[
          { id: 'PRODUCT', label: 'Product & Features', icon: Code2, count: features.length },
          { id: 'TESTING', label: 'Testing & QA', icon: ShieldCheck, count: tests.length },
          { id: 'RELEASES', label: 'Releases', icon: Tag, count: releases.length },
          { id: 'DISTRIBUTION', label: 'Distribution', icon: Share2, count: distribution.length },
          { id: 'USERS', label: 'Users & Metrics', icon: Users, count: snapshots.length },
          { id: 'FEEDBACK', label: 'Feedback & Bugs', icon: MessageSquare, count: feedback.length },
          { id: 'GOALS', label: 'SaaS Goals', icon: Target },
          { id: 'AI_AUDIT', label: 'AI SaaS Audit', icon: Zap },
          { id: 'ACTIVITY', label: 'Activity Ledger', icon: Activity, count: saasEvents.length },
        ].map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
                border: 'none',
                borderBottom: isSelected ? '2px solid #06b6d4' : '2px solid transparent',
                background: isSelected ? 'rgba(6, 182, 212, 0.1)' : 'transparent',
                color: isSelected ? '#38bdf8' : 'var(--text-secondary)',
                fontWeight: isSelected ? 600 : 400,
                fontSize: 'var(--text-xs)', cursor: 'pointer',
                whiteSpace: 'nowrap', transition: 'all 0.15s ease',
              }}
            >
              <Icon size={14} />
              {tab.label}
              {tab.count !== undefined && (
                <span style={{
                  fontSize: '10px', padding: '1px 6px', borderRadius: 8,
                  background: isSelected ? 'rgba(6, 182, 212, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                  color: isSelected ? '#fff' : 'var(--text-muted)',
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 3. TAB CONTENT */}
      {activeTab === 'PRODUCT' && (
        <FeatureManager
          features={features}
          tests={tests}
        />
      )}

      {activeTab === 'TESTING' && (
        <TestingView
          tests={tests}
          features={features}
        />
      )}

      {activeTab === 'RELEASES' && (
        <ReleaseManager
          releases={releases}
        />
      )}

      {activeTab === 'DISTRIBUTION' && (
        <DistributionView
          distribution={distribution}
          distributionFocusSeconds={kpis?.distributionFocusSeconds || 0}
        />
      )}

      {activeTab === 'USERS' && (
        <UserMetricsView
          snapshots={snapshots}
        />
      )}

      {activeTab === 'FEEDBACK' && (
        <FeedbackManager
          feedback={feedback}
          features={features}
        />
      )}

      {activeTab === 'GOALS' && kpis && (
        <SaasGoals
          kpis={kpis}
          goals={goals}
        />
      )}

      {activeTab === 'AI_AUDIT' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Layer 4 Live AI Pillar Audit */}
          <AIAnalysisCard
            mode="PILLAR"
            pillarScope="trading_os"
            title="Layer 4 AI Strategic Interpretation — Trading OS & SaaS"
            allowBrutal={true}
          />

          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: 4 }}>
                  AI SaaS Product & Business Audit
                </h3>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>
                  Deterministic audit interpreting verified product velocity, test quality, distribution footprint, and monetization traction.
                </p>
              </div>

              <button
                className="btn btn-primary btn-sm"
                onClick={handleGenerateAudit}
                disabled={loadingAi}
                style={{ gap: 6 }}
              >
                <Zap size={14} />
                {loadingAi ? 'Analyzing Facts...' : 'Generate Strategic Audit'}
              </button>
            </div>
          </div>

          {strategicAudit ? (
            <div className="card" style={{
              padding: 24, background: 'rgba(255, 255, 255, 0.02)',
              whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: 'var(--text-xs)',
            }}>
              {strategicAudit}
            </div>
          ) : (
            <div className="card" style={{ padding: 36, textAlign: 'center', color: 'var(--text-muted)' }}>
              Click "Generate Strategic Audit" above to review your product loop, distribution health, and user metrics.
            </div>
          )}
        </div>
      )}

      {activeTab === 'ACTIVITY' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            Immutable Activity Ledger for Trading OS → SaaS ({saasEvents.length} events logged).
          </div>

          <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 14px' }}>Event Type</th>
                  <th style={{ padding: '10px 14px' }}>Entity Ref Type</th>
                  <th style={{ padding: '10px 14px' }}>Entity Ref ID</th>
                  <th style={{ padding: '10px 14px' }}>Metadata / Details</th>
                  <th style={{ padding: '10px 14px' }}>Occurred At</th>
                </tr>
              </thead>
              <tbody>
                {saasEvents.map((evt) => (
                  <tr key={evt.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#06b6d4' }}>
                      {evt.eventType}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      {evt.entityRefType || '—'}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                      {evt.entityRefId || '—'}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-primary)', maxWidth: 320 }}>
                      {evt.metadata ? JSON.stringify(evt.metadata) : '—'}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {timeAgo(evt.occurredAt)}
                    </td>
                  </tr>
                ))}
                {saasEvents.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                      No activity ledger events logged yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FOCUS SESSION MODAL */}
      {showFocusModal && (
        <div className="modal-overlay" onClick={() => setShowFocusModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>Start SaaS Focus Session</h3>
              <button className="btn-icon btn-ghost" onClick={() => setShowFocusModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="label">Activity Category</label>
                <select
                  className="input"
                  value={selectedFocusCategory}
                  onChange={(e) => setSelectedFocusCategory(e.target.value)}
                >
                  <option value="Product Development">Product Development</option>
                  <option value="Testing">Testing & Quality</option>
                  <option value="Bug Fixing">Bug Fixing</option>
                  <option value="Product Research">Product Research</option>
                  <option value="Distribution">Distribution</option>
                  <option value="User Research">User Research</option>
                  <option value="SaaS Operations">SaaS Operations</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button className="btn btn-secondary" onClick={() => setShowFocusModal(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={handleStartTimer} style={{ gap: 6 }}>
                  <Play size={14} /> Start Timer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
