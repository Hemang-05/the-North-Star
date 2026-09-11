// ============================================================================
// PERSONAL OS — Forex Learning Command Center (Master Dashboard)
// Priority #4 Console: Skill & Discipline Tracker for Pillar 4: Forex Learning.
// Governs the Core Learning Loop:
// Study → Understanding → Setup Development → Backtesting → Paper Trading → Review → Discipline
// Code calculates. AI judges and explains.
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  BookOpen, Compass, Microscope, LineChart,
  ShieldCheck, Target, Sparkles, Activity, Play,
  Layers, CheckCircle2, Clock, Flame,
  RefreshCw,
} from 'lucide-react';
import {
  useStore,
  useDataChangeListener,
  useActiveTimer,
} from '../../hooks/useDatabase';
import { dbGetAll, STORES } from '../../services/db';
import type {
  ForexStudySession,
  ForexSetup,
  ForexBacktestBatch,
  ForexPaperTrade,
  Goal,
  ActivityEvent,
} from '../../types';
import { loadForexKpiSummary, type ForexKpiSummary } from '../../services/forexKpi';
import {
  evaluateForexStatus,
  getVerdictStyle,
  type StatusEvaluation,
} from '../../services/statusEngine';
import {
  buildForexAiFacts,
  generateOfflineForexAudit,
  type ForexAiFacts,
} from '../../services/aiContext';
import {
  formatDuration,
  formatSafePercent,
  formatDate,
} from '../../utils/helpers';
import { showToast } from '../Toast';
import { ForexStudyTab } from './ForexStudyTab';
import { ForexSetupsTab } from './ForexSetupsTab';
import { ForexBacktestTab } from './ForexBacktestTab';
import { ForexPaperTradesTab } from './ForexPaperTradesTab';
import { ForexDisciplineTab } from './ForexDisciplineTab';
import { ForexGoalsTab } from './ForexGoalsTab';
import { AIAnalysisCard } from '../ai/AIAnalysisCard';
import type { ViewId } from '../Sidebar';

interface ForexDashboardProps {
  onNavigate?: (view: ViewId) => void;
}

type TabType =
  | 'OVERVIEW'
  | 'STUDY'
  | 'SETUPS'
  | 'BACKTESTS'
  | 'PAPER'
  | 'DISCIPLINE'
  | 'GOALS'
  | 'AI_AUDIT'
  | 'ACTIVITY';

// Core 7-Step Learning Loop
const LEARNING_LOOP_STEPS = [
  { step: 1, name: 'Study', desc: 'Market structure, theory, and liquidity' },
  { step: 2, name: 'Understanding', desc: 'Internalize price action principles' },
  { step: 3, name: 'Setup Development', desc: 'Codify strict entry, SL, & TP rules' },
  { step: 4, name: 'Backtesting', desc: 'Validate statistical edge on 50+ trades' },
  { step: 5, name: 'Paper Trading', desc: 'Forward practice execution fidelity' },
  { step: 6, name: 'Review', desc: 'Post-trade audit and journal tagging' },
  { step: 7, name: 'Discipline', desc: 'Zero tolerance for unforced mistakes' },
];

export function ForexDashboard({ onNavigate }: ForexDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('OVERVIEW');
  const [kpis, setKpis] = useState<ForexKpiSummary | null>(null);
  const [statusEval, setStatusEval] = useState<StatusEvaluation | null>(null);
  const [loading, setLoading] = useState(true);

  // Data Stores
  const { items: studySessions } = useStore<ForexStudySession>(STORES.FOREX_STUDY);
  const { items: setups } = useStore<ForexSetup>(STORES.FOREX_SETUPS);
  const { items: backtests } = useStore<ForexBacktestBatch>(STORES.FOREX_BACKTESTS);
  const { items: paperTrades } = useStore<ForexPaperTrade>(STORES.FOREX_PAPER_TRADES);
  const { items: goals } = useStore<Goal>(STORES.GOALS);
  const { items: events } = useStore<ActivityEvent>(STORES.EVENTS);

  // AI State
  const [, setAiFacts] = useState<ForexAiFacts | null>(null);
  const [strategicAudit, setStrategicAudit] = useState<string>('');
  const [loadingAi, setLoadingAi] = useState(false);

  // Focus Timer
  const { session: activeSession, startTimer } = useActiveTimer();
  const [showFocusModal, setShowFocusModal] = useState(false);
  const [selectedFocusCategory, setSelectedFocusCategory] = useState('Study');

  // Load KPIs
  const refreshKpis = useCallback(async () => {
    try {
      const summary = await loadForexKpiSummary();
      const allGoals = await dbGetAll<Goal>(STORES.GOALS);
      const evalResult = evaluateForexStatus(summary, allGoals);
      setKpis(summary);
      setStatusEval(evalResult);
    } catch (err) {
      console.error('Error computing Forex KPIs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshKpis();
  }, [refreshKpis]);
  useDataChangeListener(refreshKpis);

  // AI Audit Generator
  const handleGenerateAudit = async () => {
    setLoadingAi(true);
    try {
      const facts = await buildForexAiFacts();
      const audit = generateOfflineForexAudit(facts);
      setAiFacts(facts);
      setStrategicAudit(audit);
      showToast('Generated strategic Forex audit', 'success');
    } catch (err) {
      console.error('Error generating Forex audit:', err);
      showToast('Failed to generate audit', 'error');
    } finally {
      setLoadingAi(false);
    }
  };

  // Focus Timer Start
  const handleStartFocus = async () => {
    await startTimer('forex', selectedFocusCategory);
    setShowFocusModal(false);
    showToast(`Started ${selectedFocusCategory} focus block`, 'info');
    if (onNavigate) onNavigate('timer');
  };

  const verdictStyle = statusEval
    ? getVerdictStyle(statusEval.verdict)
    : getVerdictStyle('NEGLECTED');

  // Filter forex-specific activity events
  const forexEvents = events
    .filter((e) => e.pillarId === 'forex')
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  return (
    <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Header & Quick Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: '#f59e0b',
                boxShadow: '0 0 10px #f59e0b',
              }}
            />
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#f59e0b' }}>
              Pillar #4 · Skill & Discipline Tracker
            </span>
          </div>
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, margin: 0 }}>
            Forex Learning Command Center
          </h1>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '4px 0 0', maxWidth: 650 }}>
            Dedicated skill-development tracker. Strictly follows the core learning loop: Study → Understanding → Setup Development → Backtesting → Paper Trading → Review → Discipline.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            className="btn btn-sm btn-ghost"
            style={{ borderColor: 'var(--border-subtle)' }}
            onClick={() => setShowFocusModal(true)}
          >
            <Play size={14} style={{ color: '#f59e0b' }} />
            {activeSession && activeSession.pillarId === 'forex' && activeSession.status === 'RUNNING'
              ? 'Focus Running...'
              : 'Start Focus Block'}
          </button>
          <button
            className="btn btn-sm btn-primary"
            style={{ background: '#f59e0b', borderColor: '#f59e0b', color: '#000', fontWeight: 600 }}
            onClick={() => setActiveTab('STUDY')}
          >
            <BookOpen size={14} /> Log Study
          </button>
        </div>
      </div>

      {/* Deterministic Status Verdict Ribbon */}
      {statusEval && (
        <div
          className="card"
          style={{
            padding: '16px 20px',
            borderLeft: `4px solid ${verdictStyle.border}`,
            background: verdictStyle.bg,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span
                className="badge"
                style={{
                  background: verdictStyle.border,
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 12,
                  letterSpacing: 0.5,
                  padding: '4px 10px',
                }}
              >
                {statusEval.verdict}
              </span>
              <span style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)' }}>
                {statusEval.headline}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Learning Health Score:</span>
              <span style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: verdictStyle.border }}>
                {statusEval.score}/100
              </span>
            </div>
          </div>

          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {statusEval.reason}
          </p>

          {statusEval.badges && statusEval.badges.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
              {statusEval.badges.map((b) => (
                <span
                  key={b}
                  className="badge"
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: 'var(--text-primary)',
                    fontSize: 11,
                  }}
                >
                  {b}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Top Metric Strip */}
      {kpis && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {/* Study Hours */}
          <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <BookOpen size={13} style={{ color: '#f59e0b' }} /> Study Time
            </div>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
              {kpis.totalStudyHoursFormatted}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 2 }}>
              {kpis.studySessionsThisWeek} sessions this week
            </div>
          </div>

          {/* Validated Setups */}
          <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Compass size={13} style={{ color: '#10b981' }} /> Validated Setups
            </div>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: '#10b981' }}>
              {kpis.setupsValidated}{' '}
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 400, color: 'var(--text-muted)' }}>
                / {kpis.totalSetups} total
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 2 }}>
              {kpis.setupsBacktesting} in testing, {kpis.setupsPaperTrading} in paper
            </div>
          </div>

          {/* Backtest Sample Size */}
          <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Microscope size={13} style={{ color: '#3b82f6' }} /> Backtest Sample
            </div>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: '#3b82f6' }}>
              {kpis.totalBacktestedTrades}{' '}
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 400, color: 'var(--text-muted)' }}>
                trades
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 2 }}>
              {formatSafePercent(kpis.weightedBacktestWinRate)} win rate
            </div>
          </div>

          {/* Process Adherence (PRIMARY KPI) */}
          <div
            className="card"
            style={{
              padding: '14px 16px',
              border: `1px solid ${(kpis.ruleAdherenceRate ?? 100) >= 85 ? '#10b981' : (kpis.ruleAdherenceRate ?? 100) >= 70 ? '#f59e0b' : '#ef4444'}40`,
            }}
          >
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <ShieldCheck size={13} style={{ color: '#10b981' }} /> Rule Adherence (Primary)
            </div>
            <div
              style={{
                fontSize: 'var(--text-xl)',
                fontWeight: 700,
                color:
                  (kpis.ruleAdherenceRate ?? 100) >= 85
                    ? '#10b981'
                    : (kpis.ruleAdherenceRate ?? 100) >= 70
                    ? '#f59e0b'
                    : '#ef4444',
              }}
            >
              {formatSafePercent(kpis.ruleAdherenceRate)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 2 }}>
              {kpis.totalPaperTrades} paper trades logged
            </div>
          </div>

          {/* Clean Streak */}
          <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Flame size={13} style={{ color: '#ec4899' }} /> Clean Streak
            </div>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: '#ec4899' }}>
              {kpis.cleanTradeStreak}{' '}
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 400, color: 'var(--text-muted)' }}>
                trades
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 2 }}>
              Zero unforced mistakes
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="tabs" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 0 }}>
        {(
          [
            { id: 'OVERVIEW', label: 'Learning Loop', icon: Layers },
            { id: 'STUDY', label: `Study (${studySessions.length})`, icon: BookOpen },
            { id: 'SETUPS', label: `Setups (${setups.length})`, icon: Compass },
            { id: 'BACKTESTS', label: `Backtests (${backtests.length})`, icon: Microscope },
            { id: 'PAPER', label: `Paper Trades (${paperTrades.length})`, icon: LineChart },
            { id: 'DISCIPLINE', label: 'Discipline', icon: ShieldCheck },
            { id: 'GOALS', label: 'Goals', icon: Target },
            { id: 'AI_AUDIT', label: 'AI Audit', icon: Sparkles },
            { id: 'ACTIVITY', label: `Ledger (${forexEvents.length})`, icon: Activity },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`tab-btn ${isActive ? 'active' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 14px',
                borderBottom: isActive ? '2px solid #f59e0b' : '2px solid transparent',
                color: isActive ? '#f59e0b' : 'var(--text-muted)',
                fontWeight: isActive ? 600 : 400,
              }}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT PANELS */}
      {loading || !kpis ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading Forex learning metrics...
        </div>
      ) : (
        <>
          {/* 1. OVERVIEW & LEARNING LOOP TAB */}
          {activeTab === 'OVERVIEW' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Learning Loop Visualizer */}
              <div className="card" style={{ padding: 22 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Layers size={18} style={{ color: '#f59e0b' }} /> The 7-Stage Forex Learning Loop
                    </h2>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                      Skill development is an iterative progression. Do not advance to live trading before mastering this cycle.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                  {LEARNING_LOOP_STEPS.map((s) => {
                    const isPassed =
                      (s.step === 1 && kpis.totalStudySessions > 0) ||
                      (s.step === 2 && kpis.totalStudyMinutes >= 180) ||
                      (s.step === 3 && kpis.totalSetups > 0) ||
                      (s.step === 4 && kpis.totalBacktestedTrades >= 20) ||
                      (s.step === 5 && kpis.totalPaperTrades > 0) ||
                      (s.step === 6 && kpis.totalPaperTrades >= 5) ||
                      (s.step === 7 && (kpis.ruleAdherenceRate ?? 0) >= 85);

                    return (
                      <div
                        key={s.step}
                        style={{
                          background: isPassed ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                          border: `1px solid ${isPassed ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-subtle)'}`,
                          borderRadius: 'var(--radius-sm)',
                          padding: '12px 10px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                          position: 'relative',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: isPassed ? '#10b981' : '#f59e0b' }}>
                            STAGE {s.step}
                          </span>
                          {isPassed && <CheckCircle2 size={13} style={{ color: '#10b981' }} />}
                        </div>

                        <div style={{ fontWeight: 600, fontSize: 'var(--text-xs)' }}>
                          {s.name}
                        </div>

                        <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                          {s.desc}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Weekly Time & Focus Breakdown */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                <div className="card" style={{ padding: 18 }}>
                  <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Clock size={15} style={{ color: '#3b82f6' }} /> Weekly Focus Time Distribution
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 'var(--text-xs)' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ color: 'var(--text-muted)' }}>Study Sessions:</span>
                        <span style={{ fontWeight: 600 }}>{formatDuration(kpis.focusTimeStudySeconds)}</span>
                      </div>
                      <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
                        <div style={{ height: '100%', width: kpis.focusTimeTotalSeconds > 0 ? `${(kpis.focusTimeStudySeconds / kpis.focusTimeTotalSeconds) * 100}%` : '0%', background: '#f59e0b', borderRadius: 2 }} />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ color: 'var(--text-muted)' }}>Backtesting Time:</span>
                        <span style={{ fontWeight: 600 }}>{formatDuration(kpis.focusTimeBacktestingSeconds)}</span>
                      </div>
                      <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
                        <div style={{ height: '100%', width: kpis.focusTimeTotalSeconds > 0 ? `${(kpis.focusTimeBacktestingSeconds / kpis.focusTimeTotalSeconds) * 100}%` : '0%', background: '#3b82f6', borderRadius: 2 }} />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ color: 'var(--text-muted)' }}>Paper Trading Practice:</span>
                        <span style={{ fontWeight: 600 }}>{formatDuration(kpis.focusTimePaperTradingSeconds)}</span>
                      </div>
                      <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
                        <div style={{ height: '100%', width: kpis.focusTimeTotalSeconds > 0 ? `${(kpis.focusTimePaperTradingSeconds / kpis.focusTimeTotalSeconds) * 100}%` : '0%', background: '#10b981', borderRadius: 2 }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Core Operating Principles */}
                <div className="card" style={{ padding: 18, background: 'rgba(245, 158, 11, 0.03)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                  <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, margin: '0 0 10px', color: '#f59e0b' }}>
                    Personal OS Boundaries & Axioms
                  </h3>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    • <strong>I record reality</strong>. The system compares reality with my goals. AI interprets the gap.
                    <br />
                    • <strong>Code calculates</strong>. AI judges and explains.
                    <br />
                    • <strong>Zero Real-Money Risk</strong>. Live accounts and broker APIs are strictly forbidden. Skill and consistency are the only measures of success.
                    <br />
                    • <strong>The $100 Threshold</strong>: Represents an external decision milestone, not an automatic goal or KPI.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. STUDY TAB */}
          {activeTab === 'STUDY' && <ForexStudyTab kpis={kpis} />}

          {/* 3. SETUPS TAB */}
          {activeTab === 'SETUPS' && <ForexSetupsTab kpis={kpis} />}

          {/* 4. BACKTESTS TAB */}
          {activeTab === 'BACKTESTS' && <ForexBacktestTab kpis={kpis} />}

          {/* 5. PAPER TRADES TAB */}
          {activeTab === 'PAPER' && <ForexPaperTradesTab kpis={kpis} />}

          {/* 6. DISCIPLINE TAB */}
          {activeTab === 'DISCIPLINE' && <ForexDisciplineTab kpis={kpis} />}

          {/* 7. GOALS TAB */}
          {activeTab === 'GOALS' && <ForexGoalsTab kpis={kpis} goals={goals} />}

          {/* 8. AI AUDIT TAB */}
          {activeTab === 'AI_AUDIT' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Layer 4 Live AI Pillar Audit */}
              <AIAnalysisCard
                mode="PILLAR"
                pillarScope="forex"
                title="Layer 4 AI Strategic Interpretation — Trading Skill & Forex"
                allowBrutal={true}
              />

              <div className="card" style={{ padding: 22 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                  <div>
                    <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Sparkles size={18} style={{ color: '#f59e0b' }} /> AI Strategic Skill & Discipline Audit
                    </h2>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                      Deterministic gap analysis interpreting study velocity, setup validation, backtest sample adequacy, and emotional discipline leaks.
                    </p>
                  </div>

                  <button
                    className="btn btn-primary btn-sm"
                    style={{ background: '#f59e0b', borderColor: '#f59e0b', color: '#000', fontWeight: 600 }}
                    onClick={handleGenerateAudit}
                    disabled={loadingAi}
                  >
                    <RefreshCw size={14} className={loadingAi ? 'spin' : ''} />
                    {loadingAi ? 'Extracting Facts...' : 'Run Audit'}
                  </button>
                </div>

                {strategicAudit ? (
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '16px 20px',
                      fontSize: 'var(--text-sm)',
                      color: 'var(--text-primary)',
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'inherit',
                    }}
                  >
                    {strategicAudit}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--text-muted)' }}>
                    <Sparkles size={36} style={{ color: '#f59e0b', margin: '0 auto 10px', opacity: 0.6 }} />
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 4 }}>
                      No Audit Generated Yet
                    </div>
                    <p style={{ fontSize: 'var(--text-xs)', margin: '0 0 14px' }}>
                      Click "Run Audit" to deterministically extract verified metrics across all learning phases.
                    </p>
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ background: '#f59e0b', borderColor: '#f59e0b', color: '#000' }}
                      onClick={handleGenerateAudit}
                    >
                      Run Audit
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 9. ACTIVITY LEDGER TAB */}
          {activeTab === 'ACTIVITY' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 600, margin: 0 }}>
                    Forex Activity Event Ledger ({forexEvents.length})
                  </h2>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                    Immutable append-only ledger for all Forex actions. Verified with entity references and metadata.
                  </p>
                </div>
              </div>

              {forexEvents.length === 0 ? (
                <div className="card" style={{ padding: 36, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No Forex activity events logged yet.
                </div>
              ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.03)', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '10px 14px' }}>Event Type</th>
                          <th style={{ padding: '10px 14px' }}>Quantity</th>
                          <th style={{ padding: '10px 14px' }}>Entity Reference</th>
                          <th style={{ padding: '10px 14px' }}>Metadata</th>
                          <th style={{ padding: '10px 14px' }}>Timestamp</th>
                        </tr>
                      </thead>
                      <tbody style={{ fontSize: 'var(--text-xs)' }}>
                        {forexEvents.map((evt) => (
                          <tr key={evt.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '10px 14px', fontWeight: 600 }}>
                              <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', fontSize: 11 }}>
                                {evt.eventType}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              {evt.quantity} {evt.unit || ''}
                            </td>
                            <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>
                              {evt.entityRefType ? `${evt.entityRefType} (${evt.entityRefId?.slice(0, 10)}...)` : '—'}
                            </td>
                            <td style={{ padding: '10px 14px', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {evt.metadata ? JSON.stringify(evt.metadata) : '—'}
                            </td>
                            <td style={{ padding: '10px 14px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                              {formatDate(evt.occurredAt || evt.createdAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Focus Timer Modal */}
      {showFocusModal && (
        <div className="modal-backdrop" onClick={() => setShowFocusModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Play size={18} style={{ color: '#f59e0b' }} /> Start Forex Focus Session
              </h2>
              <button className="btn-icon" onClick={() => setShowFocusModal(false)}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Category</label>
                <select
                  className="select"
                  value={selectedFocusCategory}
                  onChange={(e) => setSelectedFocusCategory(e.target.value)}
                >
                  <option value="Study">Study (Market Structure, Liquidity)</option>
                  <option value="Backtesting">Backtesting (Historical Data Sampling)</option>
                  <option value="Paper Trading">Paper Trading (Execution & Review)</option>
                </select>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowFocusModal(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ background: '#f59e0b', borderColor: '#f59e0b', color: '#000', fontWeight: 600 }}
                  onClick={handleStartFocus}
                >
                  Start Timer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
