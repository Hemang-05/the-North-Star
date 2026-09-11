// ============================================================================
// PERSONAL OS — VOIRE Command Center (Master Dashboard)
// Pillar #6 Console: D2C / Print-on-Demand Streetwear Brand.
// 
// Axioms:
//   "I record reality. The system compares reality with my goals. AI interprets the gap."
//   "Code calculates. AI judges and explains."
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  Palette, Package, Sparkles, ShoppingCart, Megaphone,
  DollarSign, Target, Activity, RefreshCw, ChevronRight,
  TrendingUp, ShieldCheck
} from 'lucide-react';
import { useStore, useDataChangeListener } from '../../hooks/useDatabase';
import { STORES } from '../../services/db';
import type {
  VoireDesign,
  VoireProduct,
  VoireDrop,
  VoireOrder,
  VoireOrderItem,
  VoireMarketingCampaign,
  VoireFinancialPeriod,
  VoireKpiSummary,
} from '../../types/pillars';
import type { Goal, ActivityEvent } from '../../types';
import { loadVoireKpiSummary } from '../../services/voireKpi';
import { evaluateVoireStatus, type StatusEvaluation } from '../../services/statusEngine';
import {
  buildVoireAiFacts,
  generateOfflineVoireAudit,
  type VoireAiFacts,
} from '../../services/aiContext';
import { formatINR, formatDate, timeAgo } from '../../utils/helpers';
import { showToast } from '../Toast';
import { VoireDesignsTab } from './VoireDesignsTab';
import { VoireProductsTab } from './VoireProductsTab';
import { VoireDropsTab } from './VoireDropsTab';
import { VoireOrdersTab } from './VoireOrdersTab';
import { VoireMarketingTab } from './VoireMarketingTab';
import { VoireFinancialsTab } from './VoireFinancialsTab';
import { VoireGoalsTab } from './VoireGoalsTab';
import { AIAnalysisCard } from '../ai/AIAnalysisCard';
import type { ViewId } from '../Sidebar';
import './voire.css';

interface VoireDashboardProps {
  onNavigate?: (view: ViewId) => void;
}

type TabType =
  | 'OVERVIEW'
  | 'DESIGNS'
  | 'PRODUCTS'
  | 'DROPS'
  | 'ORDERS'
  | 'MARKETING'
  | 'FINANCIALS'
  | 'GOALS'
  | 'AI_AUDIT'
  | 'ACTIVITY';

export function VoireDashboard({ onNavigate: _onNavigate }: VoireDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('OVERVIEW');

  // Live entity stores
  const { items: designs = [] } = useStore<VoireDesign>(STORES.VOIRE_DESIGNS);
  const { items: products = [] } = useStore<VoireProduct>(STORES.VOIRE_PRODUCTS);
  const { items: drops = [] } = useStore<VoireDrop>(STORES.VOIRE_DROPS);
  const { items: orders = [] } = useStore<VoireOrder>(STORES.VOIRE_ORDERS);
  const { items: orderItems = [] } = useStore<VoireOrderItem>(STORES.VOIRE_ORDER_ITEMS);
  const { items: campaigns = [] } = useStore<VoireMarketingCampaign>(STORES.VOIRE_MARKETING);
  const { items: periods = [] } = useStore<VoireFinancialPeriod>(STORES.VOIRE_FINANCIAL_PERIODS);
  const { items: goals = [] } = useStore<Goal>(STORES.GOALS);
  const { items: allEvents = [] } = useStore<ActivityEvent>(STORES.EVENTS);

  // Deterministic KPI state
  const [kpis, setKpis] = useState<VoireKpiSummary>({
    totalDesigns: 0,
    readyOrSampledDesigns: 0,
    activeProducts: 0,
    activeDrops: 0,
    totalOrders: 0,
    paidOrdersCount: 0,
    pendingOrdersCount: 0,
    grossSales: 0,
    discounts: 0,
    refunds: 0,
    refundCount: 0,
    netSales: 0,
    cogsProduction: 0,
    cogsShipping: 0,
    totalCogs: 0,
    marketingSpend: 0,
    otherExpenses: 0,
    contributionProfit: 0,
    contributionMarginPercent: 0,
    cashReceived: 0,
    accountsReceivablePending: 0,
    aov: 0,
    roas: 0,
    cac: 0,
    campaignsCount: 0,
    totalImpressions: 0,
    totalClicks: 0,
    totalConversions: 0,
    overallCtr: 0,
    overallCvr: 0,
    isWeekend: false,
    creativePauseExcused: true,
  });

  // Operational status evaluation
  const [statusEval, setStatusEval] = useState<StatusEvaluation>({
    verdict: 'ON_TRACK',
    score: 80,
    headline: 'VOIRE Brand Core Initialized',
    reason: 'Evaluating creative studio and commercial baseline.',
    badges: [],
  });

  // AI Facts and Strategic Audit
  const [aiFacts, setAiFacts] = useState<VoireAiFacts | null>(null);
  const [strategicAudit, setStrategicAudit] = useState<string>('');
  const [isAuditing, setIsAuditing] = useState(false);
  const [showRawFacts, setShowRawFacts] = useState(false);

  const refreshVoireData = useCallback(async () => {
    const calculatedKpis = await loadVoireKpiSummary();
    setKpis(calculatedKpis);

    const activeGoals = goals.filter((g) => g.pillarId === 'voire' && g.status === 'ACTIVE');
    const evaluation = evaluateVoireStatus(calculatedKpis, activeGoals);
    setStatusEval(evaluation);
  }, [goals]);

  useEffect(() => {
    refreshVoireData();
  }, [designs, products, drops, orders, orderItems, campaigns, periods, goals, refreshVoireData]);

  useDataChangeListener([
    STORES.VOIRE_DESIGNS,
    STORES.VOIRE_PRODUCTS,
    STORES.VOIRE_DROPS,
    STORES.VOIRE_ORDERS,
    STORES.VOIRE_ORDER_ITEMS,
    STORES.VOIRE_MARKETING,
    STORES.VOIRE_FINANCIAL_PERIODS,
    STORES.GOALS,
  ], refreshVoireData);

  const handleRunAiAudit = async () => {
    setIsAuditing(true);
    try {
      const facts = await buildVoireAiFacts();
      setAiFacts(facts);
      const auditText = generateOfflineVoireAudit(facts);
      setStrategicAudit(auditText);
      showToast('Brand performance audit updated', 'success');
    } catch (err) {
      showToast('Failed to generate audit', 'error');
    } finally {
      setIsAuditing(false);
    }
  };

  const voireEvents = (allEvents || [])
    .filter((e) => e.pillarId === 'voire')
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

  return (
    <div className="voire-container">
      {/* Brand Header Banner */}
      <div className="voire-banner">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.375rem' }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#ffffff', margin: 0 }}>
                VOIRE — Brand Operations
              </h1>
              <span className={`voire-weekend-pill ${kpis.isWeekend ? 'active' : 'weekday'}`}>
                {kpis.isWeekend ? 'Weekend Creative Sprint (Active)' : 'Weekday Operations (Creative Pause Excused)'}
              </span>
            </div>
            <p style={{ fontSize: '0.875rem', color: '#9ca3af', margin: 0, maxWidth: '42rem' }}>
              Direct-to-Consumer & Print-on-Demand Streetwear Brand. Creative concepts, product catalog, capsule drops, and authoritative bottom-up unit economics.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Operational Score</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: statusEval.score >= 70 ? '#34d399' : statusEval.score >= 45 ? '#fbbf24' : '#f87171' }}>
                {statusEval.score}<span style={{ fontSize: '1rem', color: '#6b7280' }}>/100</span>
              </div>
            </div>
            <button className="voire-btn-secondary" style={{ padding: '0.5rem 0.75rem' }} onClick={refreshVoireData} title="Refresh KPIs">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Status Line */}
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
          <span className={`voire-badge ${statusEval.verdict.toLowerCase().replace(/_/g, '-')}`}>
            {statusEval.verdict}
          </span>
          <strong style={{ color: '#ffffff' }}>{statusEval.headline}</strong>
          <span style={{ color: '#9ca3af' }}>— {statusEval.reason}</span>
        </div>
      </div>

      {/* Primary KPI Row */}
      <div className="voire-kpi-grid">
        <div className="voire-kpi-card">
          <div className="voire-kpi-label">
            <span>Net Sales</span>
            <DollarSign size={14} style={{ color: '#34d399' }} />
          </div>
          <div className="voire-kpi-val" style={{ color: '#34d399' }}>{formatINR(kpis.netSales)}</div>
          <div className="voire-kpi-sub">Gross: {formatINR(kpis.grossSales)} | Disc: {formatINR(kpis.discounts)}</div>
        </div>

        <div className="voire-kpi-card">
          <div className="voire-kpi-label">
            <span>Contribution Profit</span>
            <TrendingUp size={14} style={{ color: '#c084fc' }} />
          </div>
          <div className="voire-kpi-val" style={{ color: kpis.contributionProfit >= 0 ? '#34d399' : '#f87171' }}>
            {formatINR(kpis.contributionProfit)}
          </div>
          <div className="voire-kpi-sub">{kpis.contributionMarginPercent.toFixed(1)}% Contribution Margin</div>
        </div>

        <div className="voire-kpi-card">
          <div className="voire-kpi-label">
            <span>Cash in Bank vs AR</span>
            <ShieldCheck size={14} style={{ color: '#60a5fa' }} />
          </div>
          <div className="voire-kpi-val">{formatINR(kpis.cashReceived)}</div>
          <div className="voire-kpi-sub" style={{ color: '#facc15' }}>AR Pending: {formatINR(kpis.accountsReceivablePending)}</div>
        </div>

        <div className="voire-kpi-card">
          <div className="voire-kpi-label">
            <span>Studio & Catalog</span>
            <Palette size={14} style={{ color: '#a855f7' }} />
          </div>
          <div className="voire-kpi-val">{kpis.totalDesigns} <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#9ca3af' }}>designs</span></div>
          <div className="voire-kpi-sub">{kpis.activeProducts} active SKUs | {kpis.activeDrops} drops</div>
        </div>

        <div className="voire-kpi-card">
          <div className="voire-kpi-label">
            <span>Marketing & ROAS</span>
            <Megaphone size={14} style={{ color: '#f472b6' }} />
          </div>
          <div className="voire-kpi-val">{formatINR(kpis.marketingSpend)}</div>
          <div className="voire-kpi-sub">
            {kpis.roas > 0 ? `${kpis.roas.toFixed(2)}x Blended ROAS` : 'No paid conversions'}
          </div>
        </div>
      </div>

      {/* Tabs Navigation Bar */}
      <div className="voire-tabs-bar">
        {[
          { id: 'OVERVIEW', label: 'Overview', icon: TrendingUp },
          { id: 'DESIGNS', label: `Creative Studio (${designs.length})`, icon: Palette },
          { id: 'PRODUCTS', label: `Catalog (${products.length})`, icon: Package },
          { id: 'DROPS', label: `Drops (${drops.length})`, icon: Sparkles },
          { id: 'ORDERS', label: `Orders (${orders.length})`, icon: ShoppingCart },
          { id: 'MARKETING', label: `Marketing (${campaigns.length})`, icon: Megaphone },
          { id: 'FINANCIALS', label: 'Financials & P&L', icon: DollarSign },
          { id: 'GOALS', label: `Goals (${goals.filter((g) => g.pillarId === 'voire').length})`, icon: Target },
          { id: 'AI_AUDIT', label: 'AI Strategic Audit', icon: Sparkles },
          { id: 'ACTIVITY', label: `Ledger (${voireEvents.length})`, icon: Activity },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`tab-${tab.id.toLowerCase().replace(/_/g, '-')}`}
              className={`voire-tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id as TabType)}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      {activeTab === 'OVERVIEW' && (
        <div>
          {/* Funnel Pipeline */}
          <div style={{ background: 'rgba(24, 24, 37, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f3f4f6', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={18} style={{ color: '#a855f7' }} /> D2C Brand Operational Funnel
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>1. Creative Concepts</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff', marginTop: '0.25rem' }}>{kpis.totalDesigns}</div>
                <div style={{ fontSize: '0.75rem', color: '#c084fc' }}>{kpis.readyOrSampledDesigns} sampled / ready</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>2. Catalog SKUs</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff', marginTop: '0.25rem' }}>{kpis.activeProducts}</div>
                <div style={{ fontSize: '0.75rem', color: '#60a5fa' }}>Commercial grade</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>3. Capsule Drops</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff', marginTop: '0.25rem' }}>{kpis.activeDrops}</div>
                <div style={{ fontSize: '0.75rem', color: '#fbbf24' }}>Release windows</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>4. Paid Orders</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#34d399', marginTop: '0.25rem' }}>{kpis.paidOrdersCount}</div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>AOV: {formatINR(kpis.aov)}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>5. Contribution Realized</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: kpis.contributionProfit >= 0 ? '#34d399' : '#f87171', marginTop: '0.25rem' }}>
                  {formatINR(kpis.contributionProfit)}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#a855f7' }}>{kpis.contributionMarginPercent.toFixed(1)}% margin</div>
              </div>
            </div>
          </div>

          {/* Quick Actions & Recent Activity */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
            <div style={{ background: 'rgba(24, 24, 37, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '0.75rem', padding: '1.25rem' }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f3f4f6', marginBottom: '0.75rem' }}>Quick Navigation</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button className="voire-btn-secondary" style={{ justifyContent: 'space-between' }} onClick={() => setActiveTab('DESIGNS')}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Palette size={14} /> Creative Studio & Tech Packs</span>
                  <ChevronRight size={14} />
                </button>
                <button className="voire-btn-secondary" style={{ justifyContent: 'space-between' }} onClick={() => setActiveTab('PRODUCTS')}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Package size={14} /> Product Catalog & Unit Costs</span>
                  <ChevronRight size={14} />
                </button>
                <button className="voire-btn-secondary" style={{ justifyContent: 'space-between' }} onClick={() => setActiveTab('ORDERS')}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><ShoppingCart size={14} /> Record Orders & Revenue</span>
                  <ChevronRight size={14} />
                </button>
                <button className="voire-btn-secondary" style={{ justifyContent: 'space-between' }} onClick={() => setActiveTab('FINANCIALS')}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><DollarSign size={14} /> P&L Waterfall & Unit Economics</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            <div style={{ background: 'rgba(24, 24, 37, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '0.75rem', padding: '1.25rem' }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f3f4f6', marginBottom: '0.75rem' }}>Recent Brand Events</h4>
              {voireEvents.length === 0 ? (
                <p style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>No events recorded yet. Add a design, product, or order to initialize the activity stream.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                  {voireEvents.slice(0, 5).map((evt) => (
                    <div key={evt.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem', padding: '0.375rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <span style={{ color: '#f3f4f6' }}>{(evt.metadata?.title as string) || (evt.metadata?.name as string) || evt.eventType}</span>
                      <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{timeAgo(evt.occurredAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'DESIGNS' && <VoireDesignsTab designs={designs} />}
      {activeTab === 'PRODUCTS' && <VoireProductsTab products={products} designs={designs} />}
      {activeTab === 'DROPS' && <VoireDropsTab drops={drops} products={products} />}
      {activeTab === 'ORDERS' && (
        <VoireOrdersTab
          orders={orders}
          orderItems={orderItems}
          products={products}
          drops={drops}
          campaigns={campaigns}
        />
      )}
      {activeTab === 'MARKETING' && <VoireMarketingTab campaigns={campaigns} drops={drops} orders={orders} />}
      {activeTab === 'FINANCIALS' && <VoireFinancialsTab kpis={kpis} periods={periods} />}
      {activeTab === 'GOALS' && <VoireGoalsTab goals={goals} kpis={kpis} />}

      {activeTab === 'AI_AUDIT' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Layer 4 Live AI Pillar Audit */}
          <AIAnalysisCard
            mode="PILLAR"
            pillarScope="voire"
            title="Layer 4 AI Strategic Interpretation — Luxury Fashion & Brand"
            allowBrutal={true}
          />

          <div style={{ background: 'rgba(24, 24, 37, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={18} style={{ color: '#c084fc' }} /> Strategic Offline AI Brand Audit
              </h3>
              <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: '0.25rem 0 0 0' }}>
                Ground-truth evaluation consuming deterministic VOIRE KPIs, bottom-up P&L reality, and user-defined goals.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="voire-btn-secondary" onClick={() => setShowRawFacts(!showRawFacts)}>
                {showRawFacts ? 'Hide Raw Facts' : 'Inspect Raw Facts'}
              </button>
              <button className="voire-btn-primary" onClick={handleRunAiAudit} disabled={isAuditing}>
                {isAuditing ? 'Auditing...' : 'Run Brand Audit'}
              </button>
            </div>
          </div>

          {showRawFacts && aiFacts && (
            <div style={{ background: '#0a0910', border: '1px solid rgba(255,255,255,0.1)', padding: '1rem', borderRadius: '0.75rem', fontSize: '0.75rem', fontFamily: 'monospace', color: '#e5e7eb', overflowX: 'auto', maxHeight: '20rem' }}>
              <pre>{JSON.stringify(aiFacts, null, 2)}</pre>
            </div>
          )}

          {strategicAudit ? (
            <div style={{ background: 'rgba(24, 24, 37, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '0.75rem', padding: '1.5rem', whiteSpace: 'pre-line', fontSize: '0.875rem', color: '#e5e7eb', lineHeight: 1.7 }}>
              {strategicAudit}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '4rem 1rem', background: 'rgba(24, 24, 37, 0.5)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '0.75rem' }}>
              <Sparkles size={40} style={{ color: '#a855f7', opacity: 0.5, margin: '0 auto 0.75rem' }} />
              <p style={{ fontSize: '0.875rem', color: '#9ca3af', marginBottom: '1rem' }}>No audit generated yet</p>
              <button className="voire-btn-primary" onClick={handleRunAiAudit}>
                Generate Strategic Brand Audit Now
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'ACTIVITY' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ background: 'rgba(24, 24, 37, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '0.75rem', padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={18} style={{ color: '#a855f7' }} /> VOIRE Activity Ledger
            </h3>
            <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: '0.25rem 0 0 0' }}>
              Complete append-only audit trail for all Pillar 6 events.
            </p>
          </div>

          {voireEvents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'rgba(24, 24, 37, 0.5)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '0.75rem' }}>
              <Activity size={36} style={{ color: '#a855f7', opacity: 0.5, margin: '0 auto 0.75rem' }} />
              <p style={{ fontSize: '0.875rem', color: '#9ca3af' }}>No VOIRE activity events recorded yet</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {voireEvents.map((evt) => (
                <div
                  key={evt.id}
                  style={{ background: 'rgba(24, 24, 37, 0.6)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '0.5rem', padding: '0.875rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 700, color: '#ffffff', fontSize: '0.875rem' }}>{evt.eventType}</span>
                      <span style={{ fontSize: '0.75rem', color: '#a855f7', fontFamily: 'monospace' }}>{evt.entityRef?.type}</span>
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: '#d1d5db', marginTop: '0.125rem' }}>{(evt.metadata?.title as string) || (evt.metadata?.description as string) || evt.eventType}</div>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.125rem' }}>
                      Entity ID: <code style={{ color: '#93c5fd' }}>{evt.entityRef?.id}</code>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{timeAgo(evt.occurredAt)}</div>
                    <div style={{ fontSize: '0.6875rem', color: '#6b7280' }}>{formatDate(evt.occurredAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
