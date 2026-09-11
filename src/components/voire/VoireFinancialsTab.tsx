// ============================================================================
// PERSONAL OS — VOIRE Financial Reality & Unit Economics Tab
// Authoritative bottom-up P&L, contribution profit, cash received vs AR, and reporting periods.
// ============================================================================

import { useState } from 'react';
import { DollarSign, Plus, Calendar, FileText } from 'lucide-react';
import type {
  VoireKpiSummary,
  VoireFinancialPeriod,
} from '../../types/pillars';
import { dbPut, STORES } from '../../services/db';
import { logEvent, notifyDataChange } from '../../hooks/useDatabase';
import { showToast } from '../Toast';
import { formatINR } from '../../utils/helpers';

interface VoireFinancialsTabProps {
  kpis: VoireKpiSummary;
  periods: VoireFinancialPeriod[];
}

export function VoireFinancialsTab({ kpis, periods }: VoireFinancialsTabProps) {
  const [showModal, setShowModal] = useState(false);
  const [periodName, setPeriodName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [otherExpenses, setOtherExpenses] = useState<number | ''>('');
  const [notes, setNotes] = useState('');

  const handleCreatePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!periodName.trim() || !startDate || !endDate) {
      showToast('Period name, start date, and end date are required', 'warning');
      return;
    }

    const now = new Date().toISOString();
    const periodId = `vfp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    const periodRecord: VoireFinancialPeriod = {
      id: periodId,
      periodName: periodName.trim(),
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      otherExpenses: typeof otherExpenses === 'number' ? otherExpenses : 0,
      notes: notes.trim() || undefined,
      isClosed: false,
      createdAt: now,
      updatedAt: now,
    };

    await dbPut(STORES.VOIRE_FINANCIAL_PERIODS, periodRecord);

    // Activity Event Emission
    await logEvent({
      pillarId: 'voire',
      eventType: 'VOIRE_FINANCIAL_PERIOD_LOGGED',
      entityRef: {
        type: 'VoireFinancialPeriod',
        id: periodId,
      },
      metadata: { periodName, otherExpenses },
    });

    notifyDataChange(STORES.VOIRE_FINANCIAL_PERIODS);
    showToast(`Financial period "${periodName}" logged`, 'success');
    setShowModal(false);
  };

  const handleToggleClosePeriod = async (period: VoireFinancialPeriod) => {
    const now = new Date().toISOString();
    const updated: VoireFinancialPeriod = {
      ...period,
      isClosed: !period.isClosed,
      updatedAt: now,
    };

    await dbPut(STORES.VOIRE_FINANCIAL_PERIODS, updated);
    notifyDataChange(STORES.VOIRE_FINANCIAL_PERIODS);
    showToast(`Period "${period.periodName}" marked as ${updated.isClosed ? 'Closed' : 'Open'}`, 'info');
  };

  const grossProfit = kpis.netSales - kpis.totalCogs;
  const grossMarginPercent = kpis.netSales > 0 ? (grossProfit / kpis.netSales) * 100 : 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f9fafb', margin: 0 }}>Financial Reality & Unit Economics</h2>
          <p style={{ fontSize: '0.875rem', color: '#9ca3af', margin: '0.25rem 0 0 0' }}>
            Bottom-up calculated P&L derived deterministically from order items, ad spend, and historical cost snapshots.
          </p>
        </div>
        <button className="voire-btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} /> Log Reporting Cycle
        </button>
      </div>

      {/* Primary Financial Waterfall */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Waterfall Card */}
        <div style={{ background: 'rgba(24, 24, 37, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '0.75rem', padding: '1.5rem', backdropFilter: 'blur(12px)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f3f4f6', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <DollarSign size={18} style={{ color: '#34d399' }} /> P&L Waterfall Breakdown
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#9ca3af' }}>Gross Sales (Recorded Orders)</span>
              <span style={{ fontWeight: 600, color: '#f9fafb' }}>{formatINR(kpis.grossSales)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '0.75rem' }}>
              <span style={{ color: '#ef4444' }}>(-) Discounts & Promotions</span>
              <span style={{ color: '#f87171' }}>-{formatINR(kpis.discounts)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '0.75rem' }}>
              <span style={{ color: '#ef4444' }}>(-) Customer Refunds</span>
              <span style={{ color: '#f87171' }}>-{formatINR(kpis.refunds)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.5rem', fontWeight: 700 }}>
              <span style={{ color: '#ffffff' }}>(=) Net Sales</span>
              <span style={{ color: '#34d399' }}>{formatINR(kpis.netSales)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '0.75rem' }}>
              <span style={{ color: '#f59e0b' }}>(-) COGS — Production (Snapshots)</span>
              <span style={{ color: '#fbbf24' }}>-{formatINR(kpis.cogsProduction)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '0.75rem' }}>
              <span style={{ color: '#f59e0b' }}>(-) COGS — Shipping & Fulfillment</span>
              <span style={{ color: '#fbbf24' }}>-{formatINR(kpis.cogsShipping)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.5rem', fontWeight: 600 }}>
              <span style={{ color: '#d1d5db' }}>(=) Gross Profit ({grossMarginPercent.toFixed(1)}% Margin)</span>
              <span style={{ color: grossProfit >= 0 ? '#10b981' : '#f87171' }}>{formatINR(grossProfit)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '0.75rem' }}>
              <span style={{ color: '#ec4899' }}>(-) Marketing & Ad Spend (Campaigns)</span>
              <span style={{ color: '#f472b6' }}>-{formatINR(kpis.marketingSpend)}</span>
            </div>
            {kpis.otherExpenses > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '0.75rem' }}>
                <span style={{ color: '#9ca3af' }}>(-) Other Operating Expenses</span>
                <span style={{ color: '#9ca3af' }}>-{formatINR(kpis.otherExpenses)}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid rgba(168,85,247,0.3)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: '#c084fc' }}>
                (=) Contribution Profit ({kpis.contributionMarginPercent.toFixed(1)}%)
              </span>
              <span style={{ fontSize: '1.125rem', fontWeight: 700, color: kpis.contributionProfit >= 0 ? '#34d399' : '#f87171' }}>
                {formatINR(kpis.contributionProfit)}
              </span>
            </div>
          </div>
        </div>

        {/* Cash Realization vs AR & Efficiency Metrics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ background: 'rgba(24, 24, 37, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '0.75rem', padding: '1.25rem' }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
              Cash Flow Realization
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Cash Collected (PAID)</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#34d399', marginTop: '0.25rem' }}>
                  {formatINR(kpis.cashReceived)}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.125rem' }}>{kpis.paidOrdersCount} order(s)</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Pending Receivables (AR)</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#facc15', marginTop: '0.25rem' }}>
                  {formatINR(kpis.accountsReceivablePending)}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.125rem' }}>{kpis.pendingOrdersCount} order(s)</div>
              </div>
            </div>
          </div>

          <div style={{ background: 'rgba(24, 24, 37, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '0.75rem', padding: '1.25rem' }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
              Customer Unit Economics
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Average Order Value (AOV)</div>
                <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#ffffff', marginTop: '0.25rem' }}>
                  {formatINR(kpis.aov)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Customer Acquisition Cost (CAC)</div>
                <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#ffffff', marginTop: '0.25rem' }}>
                  {kpis.cac > 0 ? formatINR(kpis.cac) : '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Blended ROAS</div>
                <div style={{ fontSize: '1.125rem', fontWeight: 700, color: kpis.roas >= 2.5 ? '#34d399' : '#fbbf24', marginTop: '0.25rem' }}>
                  {kpis.roas > 0 ? `${kpis.roas.toFixed(2)}x` : '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Historical COGS Invariant</div>
                <div style={{ fontSize: '0.8125rem', color: '#34d399', fontWeight: 600, marginTop: '0.25rem' }}>
                  🔒 Active & Immutable
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reporting Periods Table */}
      <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f3f4f6', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Calendar size={18} style={{ color: '#a855f7' }} /> Financial Reporting Cycles
      </h3>

      {periods.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '0.75rem', border: '1px dashed rgba(255,255,255,0.08)' }}>
          <FileText size={32} style={{ color: '#a855f7', opacity: 0.5, margin: '0 auto 0.75rem' }} />
          <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
            No reporting cycles logged yet. Create weekly or monthly cycles to review brand accounting boundaries.
          </div>
        </div>
      ) : (
        <div className="voire-table-wrapper">
          <table className="voire-table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Cycle Dates</th>
                <th>Additional Expenses</th>
                <th>Cycle Notes</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600, color: '#ffffff' }}>{p.periodName}</td>
                  <td style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>
                    {new Date(p.startDate).toLocaleDateString()} – {new Date(p.endDate).toLocaleDateString()}
                  </td>
                  <td>{p.otherExpenses ? formatINR(p.otherExpenses) : '—'}</td>
                  <td style={{ fontSize: '0.8125rem', color: '#d1d5db' }}>{p.notes || '—'}</td>
                  <td>
                    <span className={`voire-badge ${p.isClosed ? 'completed' : 'active'}`}>
                      {p.isClosed ? 'CLOSED' : 'OPEN'}
                    </span>
                  </td>
                  <td>
                    <button
                      className="voire-btn-secondary"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                      onClick={() => handleToggleClosePeriod(p)}
                    >
                      {p.isClosed ? 'Reopen' : 'Close Cycle'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="voire-modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="voire-modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f9fafb', marginBottom: '1.25rem' }}>
              Log Financial Reporting Period
            </h3>
            <form onSubmit={handleCreatePeriod}>
              <div className="voire-form-group">
                <label className="voire-form-label">Period Name *</label>
                <input
                  type="text"
                  className="voire-form-input"
                  placeholder="e.g. September 2026 Cycle, Drop 01 Window"
                  value={periodName}
                  onChange={(e) => setPeriodName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="voire-form-group">
                  <label className="voire-form-label">Start Date *</label>
                  <input
                    type="date"
                    className="voire-form-input"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>
                <div className="voire-form-group">
                  <label className="voire-form-label">End Date *</label>
                  <input
                    type="date"
                    className="voire-form-input"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="voire-form-group">
                <label className="voire-form-label">Additional Overhead / Operating Expenses (₹)</label>
                <input
                  type="number"
                  className="voire-form-input"
                  placeholder="e.g. Shopify plan, packaging, software"
                  value={otherExpenses}
                  onChange={(e) => setOtherExpenses(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>

              <div className="voire-form-group">
                <label className="voire-form-label">Executive Notes</label>
                <textarea
                  rows={2}
                  className="voire-form-textarea"
                  placeholder="Summary of drop performance, payment gateway reconciliations..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="voire-btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="voire-btn-primary">
                  Log Period
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
