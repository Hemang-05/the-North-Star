// ============================================================================
// PERSONAL OS — Job Hunt Pillar Dashboard (Command Center)
// End-to-end vertical slice for Career & Job Hunt.
// Unifies pipeline management, outreach tracking, career capital, goals,
// deterministic KPI metrics, status health engine, and AI strategic audit.
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  Briefcase,
  Send,
  MessageSquare,
  Sparkles,
  Target,
  Clock,
  Plus,
  Play,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Activity,
  Zap,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { useStore, useDataChangeListener, useActiveTimer } from '../../hooks/useDatabase';
import { dbGetAll, STORES } from '../../services/db';
import type {
  JobOpportunity,
  JobApplication,
  JobOutreach,
  CareerCapital,
  Goal,
  ActivityEvent,
  FocusSession,
} from '../../types';
import {
  loadJobHuntKpiSummary,
  calculateJobHuntKpis,
  type JobHuntKpiSummary,
} from '../../services/jobHuntKpi';
import {
  evaluateJobHuntStatus,
  getVerdictStyle,
  type StatusEvaluation,
} from '../../services/statusEngine';
import {
  buildJobHuntAiFacts,
  generateOfflineStrategicAudit,
  type JobHuntAiFacts,
} from '../../services/aiContext';
import {
  formatDuration,
  formatSafePercent,
  formatINR,
  timeAgo,
  formatDate,
} from '../../utils/helpers';
import { showToast } from '../Toast';
import { OpportunityManager } from './OpportunityManager';
import { QuickApplyForm } from './QuickApplyForm';
import { OutreachTracker } from './OutreachTracker';
import { CareerCapitalView } from './CareerCapitalView';
import { JobHuntGoals } from './JobHuntGoals';
import { AIAnalysisCard } from '../ai/AIAnalysisCard';
import type { ViewId } from '../Sidebar';

interface JobHuntDashboardProps {
  onNavigate?: (view: ViewId) => void;
}

type TabType = 'PIPELINE' | 'OUTREACH' | 'ASSETS' | 'GOALS' | 'AI_REVIEW' | 'ACTIVITY';

export function JobHuntDashboard({ onNavigate }: JobHuntDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('PIPELINE');
  const [kpis, setKpis] = useState<JobHuntKpiSummary | null>(null);
  const [statusEval, setStatusEval] = useState<StatusEvaluation | null>(null);
  const [loading, setLoading] = useState(true);

  // Raw data stores
  const { items: opportunities } = useStore<JobOpportunity>(STORES.JOB_OPPORTUNITIES);
  const { items: applications } = useStore<JobApplication>(STORES.JOB_APPLICATIONS);
  const { items: goals } = useStore<Goal>(STORES.GOALS);
  const { items: events } = useStore<ActivityEvent>(STORES.EVENTS);

  // Modals
  const [showQuickApply, setShowQuickApply] = useState(false);
  const [quickApplyInitialOpp, setQuickApplyInitialOpp] = useState<JobOpportunity | null>(null);
  const [showFocusModal, setShowFocusModal] = useState(false);
  const [selectedFocusCategory, setSelectedFocusCategory] = useState('Applications');

  // AI facts and audit review state
  const [aiFacts, setAiFacts] = useState<JobHuntAiFacts | null>(null);
  const [strategicAudit, setStrategicAudit] = useState<string>('');
  const [loadingAi, setLoadingAi] = useState(false);

  // Active timer hook
  const { session: activeSession, startTimer } = useActiveTimer();

  // Load KPIs and status
  const refreshKpis = useCallback(async () => {
    try {
      const summary = await loadJobHuntKpiSummary();
      const allGoals = await dbGetAll<Goal>(STORES.GOALS);
      const evalResult = evaluateJobHuntStatus(summary, allGoals);
      setKpis(summary);
      setStatusEval(evalResult);
    } catch (err) {
      console.error('Error computing Job Hunt KPIs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshKpis();
  }, [refreshKpis]);

  useDataChangeListener(refreshKpis);

  // Generate AI Audit
  const handleGenerateAudit = async () => {
    setLoadingAi(true);
    try {
      const facts = await buildJobHuntAiFacts();
      const audit = generateOfflineStrategicAudit(facts);
      setAiFacts(facts);
      setStrategicAudit(audit);
    } catch (err) {
      console.error(err);
      showToast('Could not assemble AI facts', 'error');
    } finally {
      setLoadingAi(false);
    }
  };

  const handleStartTimer = async () => {
    await startTimer('job_hunt', selectedFocusCategory);
    setShowFocusModal(false);
    showToast(`Focus timer started: Job Hunt — ${selectedFocusCategory}`, 'success');
  };

  const verdictStyle = statusEval ? getVerdictStyle(statusEval.verdict) : getVerdictStyle('NEGLECTED');

  // Filter Job Hunt events for Activity feed
  const jobEvents = events
    .filter((e) => e.pillarId === 'job_hunt')
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 30);

  return (
    <div className="page-body">
      {/* 1. TOP HEADER & HEALTH VERDICT BANNER */}
      <div
        className="card"
        style={{
          padding: '24px',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ flex: '1 1 340px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(99, 102, 241, 0.2)',
                color: '#818cf8',
              }}>
                Priority #1 Pillar
              </span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                Deterministic Reality Ledger
              </span>
            </div>

            <h1 style={{ margin: '0 0 6px', fontSize: 'var(--text-2xl)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Briefcase size={28} style={{ color: '#6366f1' }} />
              Job Hunt & Career Engine
            </h1>
            <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', maxWidth: 640 }}>
              Capture reality, track conversions across the funnel, optimize outreach velocity, and measure gaps against weekly targets.
            </p>

            {/* Health Verdict Block */}
            {statusEval && (
              <div
                style={{
                  marginTop: 16,
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  background: verdictStyle.bg,
                  border: `1px solid ${verdictStyle.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        color: verdictStyle.color,
                        letterSpacing: '0.05em',
                      }}
                    >
                      {verdictStyle.label}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>•</span>
                    <span style={{ fontWeight: 600, fontSize: 'var(--text-xs)', color: 'var(--text-primary)' }}>
                      {statusEval.headline}
                    </span>
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                    {statusEval.reason}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Health Score</div>
                    <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: verdictStyle.color }}>
                      {statusEval.score}/100
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 200 }}>
            <button
              className="btn btn-primary"
              style={{ justifyContent: 'center', gap: 8 }}
              onClick={() => {
                setQuickApplyInitialOpp(null);
                setShowQuickApply(true);
              }}
            >
              <Send size={15} /> Quick Apply
            </button>

            <button
              className="btn btn-secondary"
              style={{ justifyContent: 'center', gap: 8 }}
              onClick={() => setShowFocusModal(true)}
            >
              <Play size={14} style={{ color: '#6366f1' }} />
              {activeSession && activeSession.pillarId === 'job_hunt' ? 'Timer Active' : 'Start Focus Block'}
            </button>
          </div>
        </div>

        {/* 2. KPI METRICS STRIP */}
        {kpis && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 12,
              marginTop: 24,
              paddingTop: 20,
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            {/* Active Pipeline */}
            <div className="card" style={{ padding: '12px 14px', background: 'rgba(255, 255, 255, 0.02)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: 2 }}>Active Pipeline</div>
              <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                {kpis.activeOpportunities}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                {kpis.totalOpportunities} total tracked
              </div>
            </div>

            {/* Applications This Week */}
            <div className="card" style={{ padding: '12px 14px', background: 'rgba(255, 255, 255, 0.02)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: 2 }}>Apps (7 Days)</div>
              <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#3b82f6' }}>
                {kpis.applicationsThisWeek}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                {kpis.applicationsToday} logged today
              </div>
            </div>

            {/* Outreach Velocity */}
            <div className="card" style={{ padding: '12px 14px', background: 'rgba(255, 255, 255, 0.02)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: 2 }}>Outreach (7 Days)</div>
              <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#8b5cf6' }}>
                {kpis.outreachThisWeek}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                {kpis.totalReplied} replies ({formatSafePercent(kpis.responseRate)})
              </div>
            </div>

            {/* Interviews / Screenings */}
            <div className="card" style={{ padding: '12px 14px', background: 'rgba(255, 255, 255, 0.02)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: 2 }}>Interviews Reached</div>
              <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#ec4899' }}>
                {kpis.interviewsReached}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                {formatSafePercent(kpis.interviewConversionRate)} conversion
              </div>
            </div>

            {/* Offers */}
            <div className="card" style={{ padding: '12px 14px', background: 'rgba(255, 255, 255, 0.02)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: 2 }}>Offers Secured</div>
              <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#22c55e' }}>
                {kpis.offersReceived}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                Goal: 1 Senior Role
              </div>
            </div>

            {/* Focus Time */}
            <div className="card" style={{ padding: '12px 14px', background: 'rgba(255, 255, 255, 0.02)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: 2 }}>Focus (7 Days)</div>
              <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#06b6d4', marginTop: 4 }}>
                {formatDuration(kpis.focusTimeThisWeekSeconds)}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                {formatDuration(kpis.focusTimeTodaySeconds)} today
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. TABS NAVIGATION */}
      <div style={{
        display: 'flex',
        gap: 6,
        borderBottom: '1px solid var(--border-subtle)',
        paddingBottom: 2,
        overflowX: 'auto',
      }}>
        {[
          { id: 'PIPELINE', label: 'Pipeline & Roles', icon: Briefcase, count: opportunities.length },
          { id: 'OUTREACH', label: 'Outreach & Networking', icon: MessageSquare, count: kpis?.totalOutreach },
          { id: 'ASSETS', label: 'Career Capital', icon: Sparkles, count: kpis?.totalAssets },
          { id: 'GOALS', label: 'Goals & Targets', icon: Target },
          { id: 'AI_REVIEW', label: 'AI Strategic Audit', icon: Zap },
          { id: 'ACTIVITY', label: 'Activity Ledger', icon: Activity, count: jobEvents.length },
        ].map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
                border: 'none',
                borderBottom: isSelected ? '2px solid #6366f1' : '2px solid transparent',
                background: isSelected ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                color: isSelected ? '#818cf8' : 'var(--text-secondary)',
                fontWeight: isSelected ? 600 : 400,
                fontSize: 'var(--text-xs)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={14} />
              {tab.label}
              {tab.count !== undefined && (
                <span style={{
                  fontSize: '10px',
                  padding: '1px 6px',
                  borderRadius: 8,
                  background: isSelected ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                  color: isSelected ? '#fff' : 'var(--text-muted)',
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 4. TAB CONTENT */}
      {activeTab === 'PIPELINE' && (
        <OpportunityManager
          opportunities={opportunities}
          loading={loading}
          onOpenQuickApply={(opp) => {
            setQuickApplyInitialOpp(opp || null);
            setShowQuickApply(true);
          }}
          onOpenOutreach={(opp) => {
            setActiveTab('OUTREACH');
          }}
        />
      )}

      {activeTab === 'OUTREACH' && (
        <OutreachTracker opportunities={opportunities} />
      )}

      {activeTab === 'ASSETS' && (
        <CareerCapitalView />
      )}

      {activeTab === 'GOALS' && kpis && (
        <JobHuntGoals kpis={kpis} />
      )}

      {activeTab === 'AI_REVIEW' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Layer 4 Live AI Pillar Audit */}
          <AIAnalysisCard
            mode="PILLAR"
            pillarScope="job_hunt"
            title="Layer 4 AI Strategic Interpretation — Career & Job Hunt"
            allowBrutal={true}
          />

          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Zap size={20} style={{ color: '#f59e0b' }} />
                  Deterministic Strategic Audit Engine
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                  Generates an immutable factual packet from your ledger and evaluates reality vs goals
                </p>
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleGenerateAudit}
                disabled={loadingAi}
              >
                {loadingAi ? 'Analyzing Reality...' : 'Run Strategic Audit'}
              </button>
            </div>

            {strategicAudit ? (
              <div
                style={{
                  marginTop: 20,
                  padding: '20px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-subtle)',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.6,
                  fontSize: 'var(--text-sm)',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {strategicAudit}
              </div>
            ) : (
              <div style={{ marginTop: 24, textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
                Click <strong>Run Strategic Audit</strong> to parse all current pipeline stages, velocity, response rates, and focus data.
              </div>
            )}

            {aiFacts && (
              <details style={{ marginTop: 16 }}>
                <summary style={{ fontSize: '11px', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  Inspect Deterministic JSON Facts Payload (LLM Grounding Context)
                </summary>
                <pre
                  style={{
                    marginTop: 10,
                    padding: 12,
                    borderRadius: 'var(--radius-sm)',
                    background: '#090d16',
                    fontSize: '11px',
                    overflowX: 'auto',
                    color: '#818cf8',
                  }}
                >
                  {JSON.stringify(aiFacts, null, 2)}
                </pre>
              </details>
            )}
          </div>
        </div>
      )}

      {activeTab === 'ACTIVITY' && (
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 'var(--text-lg)', fontWeight: 600 }}>
            Job Hunt Activity Ledger (Append-Only)
          </h3>
          {jobEvents.length === 0 ? (
            <div className="empty-state">
              <Activity size={36} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
              <div className="empty-state-title">No events recorded yet</div>
              <div className="empty-state-text">Actions you take like applications, outreach, and focus sessions will be logged here.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {jobEvents.map((ev) => (
                <div
                  key={ev.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: 'var(--text-xs)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {ev.eventType.replace(/_/g, ' ')}
                    </div>
                    {ev.metadata && (
                      <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: 2 }}>
                        {Object.entries(ev.metadata)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(' • ')}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: '11px' }}>
                    <div>{timeAgo(ev.occurredAt)}</div>
                    <div style={{ fontSize: '10px' }}>{formatDate(ev.occurredAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick Apply Modal */}
      {showQuickApply && (
        <QuickApplyForm
          opportunities={opportunities}
          initialOpportunity={quickApplyInitialOpp}
          isOpen={showQuickApply}
          onClose={() => setShowQuickApply(false)}
          onSuccess={() => {
            refreshKpis();
          }}
        />
      )}

      {/* Start Focus Timer Modal */}
      {showFocusModal && (
        <div className="modal-backdrop" onClick={() => setShowFocusModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 'var(--text-lg)' }}>
              Start Job Hunt Focus Session
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
              Choose a focused category to track time against this pillar.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {['Applications', 'Outreach', 'Interview Prep', 'Job Research', 'Portfolio', 'Learning'].map((cat) => (
                <button
                  key={cat}
                  className="btn btn-secondary"
                  style={{
                    justifyContent: 'flex-start',
                    background: selectedFocusCategory === cat ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-subtle)',
                    borderColor: selectedFocusCategory === cat ? '#6366f1' : 'var(--border-subtle)',
                    color: selectedFocusCategory === cat ? '#818cf8' : 'var(--text-primary)',
                  }}
                  onClick={() => setSelectedFocusCategory(cat)}
                >
                  <Clock size={14} /> {cat}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <button className="btn btn-secondary" onClick={() => setShowFocusModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleStartTimer}>
                Start Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
