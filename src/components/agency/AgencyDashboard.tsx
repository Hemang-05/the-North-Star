// ============================================================================
// PERSONAL OS — Agency Dashboard (Command Center)
// End-to-end vertical slice for Freelance → Agency.
// Unifies lead pipeline, client management, invoicing, goals,
// maturity tracking, deterministic KPIs, status engine, and AI audit.
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  Building2, Users, CreditCard, Target, TrendingUp, Zap, Activity, Play, Plus,
  Clock,
} from 'lucide-react';
import { useStore, useDataChangeListener, useActiveTimer, logEvent, notifyDataChange } from '../../hooks/useDatabase';
import { dbGetAll, dbPut, STORES } from '../../services/db';
import type {
  AgencyClient, AgencyProject, AgencyLead, AgencyInvoice,
  Goal, ActivityEvent,
} from '../../types';
import {
  loadAgencyKpiSummary,
  type AgencyKpiSummary,
} from '../../services/agencyKpi';
import {
  evaluateAgencyStatus,
  getVerdictStyle,
  type StatusEvaluation,
} from '../../services/statusEngine';
import {
  buildAgencyAiFacts,
  generateOfflineAgencyAudit,
  type AgencyAiFacts,
} from '../../services/aiContext';
import { formatDuration, formatINR, timeAgo, formatDate, generateId, now } from '../../utils/helpers';
import { showToast } from '../Toast';
import { LeadManager } from './LeadManager';
import { ClientProjectManager } from './ClientProjectManager';
import { InvoiceManager } from './InvoiceManager';
import { AgencyGoals } from './AgencyGoals';
import { AgencyMaturityView } from './AgencyMaturityView';
import { AIAnalysisCard } from '../ai/AIAnalysisCard';
import type { ViewId } from '../Sidebar';

interface AgencyDashboardProps {
  onNavigate?: (view: ViewId) => void;
}

type TabType = 'PIPELINE' | 'CLIENTS' | 'INVOICES' | 'GOALS' | 'MATURITY' | 'AI_REVIEW' | 'ACTIVITY';

export function AgencyDashboard({ onNavigate: _onNavigate }: AgencyDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('PIPELINE');
  const [kpis, setKpis] = useState<AgencyKpiSummary | null>(null);
  const [statusEval, setStatusEval] = useState<StatusEvaluation | null>(null);

  // Data stores
  const { items: clients } = useStore<AgencyClient>(STORES.AGENCY_CLIENTS);
  const { items: projects } = useStore<AgencyProject>(STORES.AGENCY_PROJECTS);
  const { items: leads } = useStore<AgencyLead>(STORES.AGENCY_LEADS);
  const { items: invoices } = useStore<AgencyInvoice>(STORES.AGENCY_INVOICES);
  const { items: events } = useStore<ActivityEvent>(STORES.EVENTS);
  useStore<Goal>(STORES.GOALS);

  // AI state
  const [aiFacts, setAiFacts] = useState<AgencyAiFacts | null>(null);
  const [strategicAudit, setStrategicAudit] = useState<string>('');
  const [loadingAi, setLoadingAi] = useState(false);

  // Focus Timer
  const { session: activeSession, startTimer } = useActiveTimer();
  const [showFocusModal, setShowFocusModal] = useState(false);
  const [selectedFocusCategory, setSelectedFocusCategory] = useState('Client Work');

  // Convert-to-client modal
  const [convertLead, setConvertLead] = useState<AgencyLead | null>(null);

  // Load KPIs
  const refreshKpis = useCallback(async () => {
    try {
      const summary = await loadAgencyKpiSummary();
      const allGoals = await dbGetAll<Goal>(STORES.GOALS);
      const evalResult = evaluateAgencyStatus(summary, allGoals);
      setKpis(summary);
      setStatusEval(evalResult);
    } catch (err) {
      console.error('Error computing Agency KPIs:', err);
    }
  }, []);

  useEffect(() => { refreshKpis(); }, [refreshKpis]);
  useDataChangeListener(refreshKpis);

  // AI Audit
  const handleGenerateAudit = async () => {
    setLoadingAi(true);
    try {
      const facts = await buildAgencyAiFacts();
      const audit = generateOfflineAgencyAudit(facts);
      setAiFacts(facts);
      setStrategicAudit(audit);
    } catch (err) {
      console.error(err);
      showToast('Could not assemble Agency AI facts', 'error');
    } finally {
      setLoadingAi(false);
    }
  };

  // Focus timer
  const handleStartTimer = async () => {
    await startTimer('agency', selectedFocusCategory);
    setShowFocusModal(false);
    showToast(`Focus timer started: Agency — ${selectedFocusCategory}`, 'success');
  };

  // Convert Lead to Client
  const handleConvertToClient = async (lead: AgencyLead) => {
    setConvertLead(lead);
  };

  const confirmConvertToClient = async () => {
    if (!convertLead) return;
    const client: AgencyClient = {
      id: generateId('client'),
      name: convertLead.companyName,
      company: convertLead.companyName,
      contactPerson: convertLead.contactPerson,
      email: convertLead.email,
      phone: convertLead.phone,
      industry: convertLead.industry,
      acquisitionChannel: convertLead.source,
      icpScore: 70,
      status: 'ACTIVE',
      lifetimeRevenue: 0,
      startDate: now(),
      leadId: convertLead.id,
      notes: convertLead.notes,
      createdAt: now(),
      updatedAt: now(),
    };
    await dbPut(STORES.AGENCY_CLIENTS, client);

    // Update lead with clientId
    const updatedLead: AgencyLead = { ...convertLead, clientId: client.id, updatedAt: now() };
    await dbPut(STORES.AGENCY_LEADS, updatedLead);

    await logEvent('agency', 'AGENCY_CLIENT_WON', {
      entityRefType: 'AgencyClient',
      entityRefId: client.id,
      metadata: {
        name: client.name,
        source: convertLead.source,
        leadId: convertLead.id,
        estimatedDealValue: convertLead.estimatedDealValue,
      },
    });

    notifyDataChange();
    showToast(`🎉 ${convertLead.companyName} converted to active client!`, 'success');
    setConvertLead(null);
  };

  const verdictStyle = statusEval ? getVerdictStyle(statusEval.verdict) : getVerdictStyle('NEGLECTED');

  // Filtered Agency events
  const agencyEvents = events
    .filter(e => e.pillarId === 'agency')
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 30);

  return (
    <div className="page-body">
      {/* 1. TOP HEADER & HEALTH VERDICT BANNER */}
      <div
        className="card"
        style={{
          padding: '24px',
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%)',
          border: '1px solid rgba(139, 92, 246, 0.25)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ flex: '1 1 340px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{
                fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa',
              }}>
                Priority #2 Pillar
              </span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                Cash vs Billed vs Receivables
              </span>
            </div>

            <h1 style={{ margin: '0 0 6px', fontSize: 'var(--text-2xl)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Building2 size={28} style={{ color: '#8b5cf6' }} />
              Freelance → Agency Engine
            </h1>
            <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', maxWidth: 640 }}>
              Track clients, manage the sales pipeline, invoice with strict financial separation, and measure agency maturity evolution.
            </p>

            {/* Health Verdict */}
            {statusEval && (
              <div style={{
                marginTop: 16, padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                background: verdictStyle.bg,
                border: `1px solid ${verdictStyle.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexWrap: 'wrap', gap: 12,
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{
                      fontSize: '11px', fontWeight: 800, textTransform: 'uppercase',
                      color: verdictStyle.color, letterSpacing: '0.05em',
                    }}>
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
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Health Score</div>
                  <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: verdictStyle.color }}>
                    {statusEval.score}/100
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 200 }}>
            <button className="btn btn-primary" style={{ justifyContent: 'center', gap: 8 }}
              onClick={() => setActiveTab('PIPELINE')}>
              <Plus size={15} /> New Lead
            </button>
            <button className="btn btn-secondary" style={{ justifyContent: 'center', gap: 8 }}
              onClick={() => setActiveTab('INVOICES')}>
              <CreditCard size={14} style={{ color: '#8b5cf6' }} /> Create Invoice
            </button>
            <button className="btn btn-secondary" style={{ justifyContent: 'center', gap: 8 }}
              onClick={() => setShowFocusModal(true)}>
              <Play size={14} style={{ color: '#8b5cf6' }} />
              {activeSession && activeSession.pillarId === 'agency' ? 'Timer Active' : 'Start Focus Session'}
            </button>
          </div>
        </div>

        {/* KPI RIBBON */}
        {kpis && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 12, marginTop: 24, paddingTop: 20,
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          }}>
            <div className="card" style={{ padding: '12px 14px', background: 'rgba(255, 255, 255, 0.02)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: 2 }}>Realized Cash</div>
              <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#22c55e' }}>
                {formatINR(kpis.realizedCash)}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                {kpis.paidInvoices} paid
              </div>
            </div>
            <div className="card" style={{ padding: '12px 14px', background: 'rgba(255, 255, 255, 0.02)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: 2 }}>Receivables</div>
              <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#f59e0b' }}>
                {formatINR(kpis.accountsReceivable)}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                {kpis.overdueInvoices} overdue
              </div>
            </div>
            <div className="card" style={{ padding: '12px 14px', background: 'rgba(255, 255, 255, 0.02)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: 2 }}>Pipeline Value</div>
              <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#3b82f6' }}>
                {formatINR(kpis.totalPipelineValue)}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                {kpis.activeLeads} active leads
              </div>
            </div>
            <div className="card" style={{ padding: '12px 14px', background: 'rgba(255, 255, 255, 0.02)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: 2 }}>Active Clients</div>
              <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#8b5cf6' }}>
                {kpis.activeClients}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                {kpis.totalClients} total
              </div>
            </div>
            <div className="card" style={{ padding: '12px 14px', background: 'rgba(255, 255, 255, 0.02)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: 2 }}>Hourly Rate</div>
              <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#06b6d4', marginTop: 4 }}>
                {kpis.effectiveHourlyRate !== null ? `${formatINR(kpis.effectiveHourlyRate)}/hr` : '—'}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                {formatDuration(kpis.focusTimeThisWeekSeconds)} this week
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
      }}>
        {[
          { id: 'PIPELINE', label: 'Pipeline & Leads', icon: Users, count: leads.length },
          { id: 'CLIENTS', label: 'Clients & Projects', icon: Building2, count: clients.length },
          { id: 'INVOICES', label: 'Invoices & Cashflow', icon: CreditCard, count: invoices.length },
          { id: 'GOALS', label: 'Agency Goals', icon: Target },
          { id: 'MATURITY', label: 'Agency Maturity', icon: TrendingUp },
          { id: 'AI_REVIEW', label: 'AI Business Audit', icon: Zap },
          { id: 'ACTIVITY', label: 'Activity Ledger', icon: Activity, count: agencyEvents.length },
        ].map(tab => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 16px',
                borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
                border: 'none',
                borderBottom: isSelected ? '2px solid #8b5cf6' : '2px solid transparent',
                background: isSelected ? 'rgba(139, 92, 246, 0.1)' : 'transparent',
                color: isSelected ? '#a78bfa' : 'var(--text-secondary)',
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
                  background: isSelected ? 'rgba(139, 92, 246, 0.25)' : 'rgba(255, 255, 255, 0.06)',
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
      {activeTab === 'PIPELINE' && (
        <LeadManager
          leads={leads}
          clients={clients}
          onConvertToClient={handleConvertToClient}
        />
      )}

      {activeTab === 'CLIENTS' && (
        <ClientProjectManager
          clients={clients}
          projects={projects}
          invoices={invoices}
        />
      )}

      {activeTab === 'INVOICES' && (
        <InvoiceManager
          invoices={invoices}
          clients={clients}
          projects={projects}
          kpis={kpis}
        />
      )}

      {activeTab === 'GOALS' && kpis && (
        <AgencyGoals kpis={kpis} />
      )}

      {activeTab === 'MATURITY' && kpis && (
        <AgencyMaturityView maturity={kpis.maturity} />
      )}

      {activeTab === 'AI_REVIEW' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Layer 4 Live AI Pillar Audit */}
          <AIAnalysisCard
            mode="PILLAR"
            pillarScope="agency"
            title="Layer 4 AI Strategic Interpretation — Agency & Client Engine"
            allowBrutal={true}
          />

          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Zap size={20} style={{ color: '#f59e0b' }} />
                  Agency Strategic Audit Engine
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                  Deterministic financial and pipeline analysis from your Agency ledger
                </p>
              </div>
              <button className="btn btn-primary btn-sm" onClick={handleGenerateAudit} disabled={loadingAi}>
                {loadingAi ? 'Analyzing...' : 'Run Business Audit'}
              </button>
            </div>

            {strategicAudit ? (
              <div style={{
                marginTop: 20, padding: '20px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-subtle)',
                whiteSpace: 'pre-wrap', lineHeight: 1.6,
                fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)',
              }}>
                {strategicAudit}
              </div>
            ) : (
              <div style={{ marginTop: 24, textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
                Click <strong>Run Business Audit</strong> to analyze your Agency financials, pipeline, and operational health.
              </div>
            )}

            {aiFacts && (
              <details style={{ marginTop: 16 }}>
                <summary style={{ fontSize: '11px', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  Inspect Deterministic JSON Facts Payload
                </summary>
                <pre style={{
                  marginTop: 10, padding: 12,
                  borderRadius: 'var(--radius-sm)',
                  background: '#090d16', fontSize: '11px',
                  overflowX: 'auto', color: '#a78bfa',
                }}>
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
            Agency Activity Ledger (Append-Only)
          </h3>
          {agencyEvents.length === 0 ? (
            <div className="empty-state">
              <Activity size={36} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
              <div className="empty-state-title">No events recorded yet</div>
              <div className="empty-state-text">Actions like adding leads, creating invoices, and focus sessions will be logged here.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {agencyEvents.map(ev => (
                <div key={ev.id} style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  fontSize: 'var(--text-xs)',
                }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {ev.eventType.replace(/_/g, ' ')}
                    </div>
                    {ev.metadata && (
                      <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: 2 }}>
                        {Object.entries(ev.metadata).map(([k, v]) => `${k}: ${v}`).join(' • ')}
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

      {/* Convert Lead to Client Modal */}
      {convertLead && (
        <div className="modal-backdrop" onClick={() => setConvertLead(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 'var(--text-lg)' }}>🎉 Convert Lead to Client</h3>
            <p style={{ margin: '0 0 16px', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
              This will create an active client from <strong>{convertLead.companyName}</strong> with pre-filled details from the lead record.
            </p>
            <div style={{
              padding: '14px', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)',
              fontSize: '12px', marginBottom: 16,
            }}>
              <div><strong>Company:</strong> {convertLead.companyName}</div>
              <div><strong>Contact:</strong> {convertLead.contactPerson || '—'}</div>
              <div><strong>Source:</strong> {convertLead.source}</div>
              {convertLead.estimatedDealValue && (
                <div><strong>Deal Value:</strong> {formatINR(convertLead.estimatedDealValue)}</div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => setConvertLead(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={confirmConvertToClient}>
                Convert to Client
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Focus Timer Modal */}
      {showFocusModal && (
        <div className="modal-backdrop" onClick={() => setShowFocusModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 'var(--text-lg)' }}>Start Agency Focus Session</h3>
            <p style={{ margin: '0 0 16px', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
              Choose a category to track time against the Agency pillar.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {['Client Work', 'Lead Generation', 'Outreach', 'Sales', 'Operations'].map(cat => (
                <button
                  key={cat}
                  className="btn btn-secondary"
                  style={{
                    justifyContent: 'flex-start',
                    background: selectedFocusCategory === cat ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-subtle)',
                    borderColor: selectedFocusCategory === cat ? '#8b5cf6' : 'var(--border-subtle)',
                    color: selectedFocusCategory === cat ? '#a78bfa' : 'var(--text-primary)',
                  }}
                  onClick={() => setSelectedFocusCategory(cat)}
                >
                  <Clock size={14} /> {cat}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <button className="btn btn-secondary" onClick={() => setShowFocusModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleStartTimer}>Start Session</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
