// ============================================================================
// PERSONAL OS — Forex Backtesting Rigor Tab
// Tracks historical sample batches, win rates, and recorded expectancy.
// Clearly distinguishes recorded/entered statistics from system-calculated metrics.
// ============================================================================

import { useState } from 'react';
import {
  Microscope, Plus, CheckCircle2, AlertTriangle, Trash2,
  TrendingUp, Calendar, Clock, BarChart3, HelpCircle,
} from 'lucide-react';
import { useStore, logEvent } from '../../hooks/useDatabase';
import { STORES } from '../../services/db';
import type { ForexBacktestBatch, ForexSetup } from '../../types';
import type { ForexKpiSummary } from '../../services/forexKpi';
import { generateId, now, formatDate, safePct, formatSafePercent } from '../../utils/helpers';
import { showToast } from '../Toast';

interface ForexBacktestTabProps {
  kpis: ForexKpiSummary;
}

export function ForexBacktestTab({ kpis }: ForexBacktestTabProps) {
  const { items: batches, add, remove } = useStore<ForexBacktestBatch>(STORES.FOREX_BACKTESTS);
  const { items: setups } = useStore<ForexSetup>(STORES.FOREX_SETUPS);
  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState({
    setupId: '',
    pair: 'EUR/USD',
    timeframe: '15m',
    startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    sampleSize: 30,
    wins: 18,
    losses: 12,
    breakevens: 0,
    recordedExpectancyR: '1.5',
    ruleViolations: 0,
    notes: '',
  });

  const setupMap = Object.fromEntries(setups.map((s) => [s.id, s.name]));

  const openModal = () => {
    setForm({
      setupId: setups.length > 0 ? setups[0].id : '',
      pair: 'EUR/USD',
      timeframe: '15m',
      startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
      sampleSize: 30,
      wins: 18,
      losses: 12,
      breakevens: 0,
      recordedExpectancyR: '1.5',
      ruleViolations: 0,
      notes: '',
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const sample = Number(form.sampleSize) || 0;
    const wins = Number(form.wins) || 0;
    const losses = Number(form.losses) || 0;
    const breakevens = Number(form.breakevens) || 0;

    if (sample <= 0) {
      showToast('Sample size must be greater than 0', 'error');
      return;
    }

    if (wins + losses + breakevens > sample) {
      showToast('Wins + Losses + Breakevens cannot exceed total sample size', 'error');
      return;
    }

    const calculatedWinRate = safePct(wins, sample);
    const parsedExpectancy = form.recordedExpectancyR !== '' ? parseFloat(form.recordedExpectancyR) : undefined;

    const newBatch: ForexBacktestBatch = {
      id: generateId('fx_bt'),
      setupId: form.setupId || (setups[0]?.id ?? 'unassigned'),
      pair: form.pair.trim().toUpperCase(),
      timeframe: form.timeframe.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      sampleSize: sample,
      wins,
      losses,
      breakevens,
      winRate: calculatedWinRate, // system-calculated
      recordedExpectancyR: parsedExpectancy, // explicitly entered
      expectancyR: parsedExpectancy,
      ruleViolations: Number(form.ruleViolations) || 0,
      notes: form.notes.trim() || undefined,
      backtestedAt: now(),
      createdAt: now(),
    };

    await add(newBatch);

    // Ledger Activity Event with full entity reference and metadata
    await logEvent('forex', 'FOREX_BACKTEST_RUN', {
      quantity: newBatch.sampleSize,
      unit: 'trades',
      entityRefType: 'ForexBacktestBatch',
      entityRefId: newBatch.id,
      metadata: {
        setupId: newBatch.setupId,
        setupName: setupMap[newBatch.setupId] || 'Unassigned',
        pair: newBatch.pair,
        sampleSize: newBatch.sampleSize,
        winRate: newBatch.winRate,
        recordedExpectancyR: newBatch.recordedExpectancyR,
      },
    });

    showToast(`Recorded backtest batch: ${newBatch.pair} (${newBatch.sampleSize} trades)`, 'success');
    setShowModal(false);
  };

  const handleDelete = async (id: string, pair: string) => {
    if (window.confirm(`Delete backtest batch for ${pair}?`)) {
      await remove(id);
      showToast('Backtest batch deleted', 'info');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Stat Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Microscope size={14} style={{ color: '#3b82f6' }} /> Total Sample Size
          </div>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: '#3b82f6' }}>
            {kpis.totalBacktestedTrades} <span style={{ fontSize: 'var(--text-sm)', fontWeight: 400 }}>trades</span>
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', marginTop: 4 }}>
            Across {kpis.totalBacktestBatches} batch(es)
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <TrendingUp size={14} style={{ color: '#10b981' }} /> Weighted Win Rate
          </div>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: '#10b981' }}>
            {formatSafePercent(kpis.weightedBacktestWinRate)}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', marginTop: 4 }}>
            System-calculated ({kpis.totalBacktestWins}W / {kpis.totalBacktestLosses}L)
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <BarChart3 size={14} style={{ color: '#f59e0b' }} /> Avg Recorded Expectancy
          </div>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: '#f59e0b' }}>
            {kpis.averageRecordedExpectancyR !== null ? `${kpis.averageRecordedExpectancyR > 0 ? '+' : ''}${kpis.averageRecordedExpectancyR}R` : '—'}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', marginTop: 4 }}>
            Entered statistic (from {kpis.recordedBatchesWithExpectancy} logs)
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <HelpCircle size={14} style={{ color: '#ec4899' }} /> Statistical Confidence
          </div>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: kpis.totalBacktestedTrades >= 50 ? '#10b981' : kpis.totalBacktestedTrades >= 20 ? '#f59e0b' : '#ef4444' }}>
            {kpis.totalBacktestedTrades >= 50
              ? 'Robust (50+)'
              : kpis.totalBacktestedTrades >= 20
              ? 'Moderate (20-49)'
              : 'Deficit (< 20)'}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', marginTop: 4 }}>
            {kpis.totalBacktestedTrades >= 20 ? 'Sufficient historical sample' : 'Need ≥ 20 sample trades'}
          </div>
        </div>
      </div>

      {/* Action Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 600, margin: 0 }}>
            Backtesting History & Batches
          </h2>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Record statistical samples of your trading setups. Expectancy and win rates are validated here before forward paper trading.
          </p>
        </div>

        <button
          className="btn btn-primary"
          style={{ background: '#f59e0b', borderColor: '#f59e0b', color: '#000', fontWeight: 600 }}
          onClick={openModal}
        >
          <Plus size={16} /> Record Backtest Batch
        </button>
      </div>

      {/* Batches Table / Cards */}
      {batches.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <Microscope size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: 6 }}>
            No backtest batches recorded
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', maxWidth: 460, margin: '0 auto 16px' }}>
            Test your documented setups against 20 to 50 historical trade occurrences. Log the resulting win rate and expectancy to verify statistical edge.
          </p>
          <button
            className="btn btn-primary btn-sm"
            style={{ background: '#f59e0b', borderColor: '#f59e0b', color: '#000' }}
            onClick={openModal}
          >
            <Plus size={14} /> Record First Batch
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {batches.map((batch) => {
            const setupName = setupMap[batch.setupId] || 'General / Unlinked';
            const sampleQuality =
              batch.sampleSize >= 50 ? 'Robust (50+)' : batch.sampleSize >= 20 ? 'Standard (20-49)' : 'Small (< 20)';
            const sampleColor =
              batch.sampleSize >= 50 ? '#10b981' : batch.sampleSize >= 20 ? '#f59e0b' : '#ef4444';

            return (
              <div
                key={batch.id}
                className="card"
                style={{
                  padding: 18,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>
                        {batch.pair}
                      </span>
                      <span className="badge" style={{ fontSize: 11, background: 'rgba(255,255,255,0.06)' }}>
                        {batch.timeframe}
                      </span>
                      <span className="badge" style={{ fontSize: 11, background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                        Setup: {setupName}
                      </span>
                      <span className="badge" style={{ fontSize: 11, color: sampleColor, border: `1px solid ${sampleColor}40` }}>
                        Sample: {batch.sampleSize} trades ({sampleQuality})
                      </span>
                    </div>

                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 4 }}>
                      Historical window: {batch.startDate} to {batch.endDate}
                    </div>
                  </div>

                  <button
                    className="btn-icon"
                    style={{ color: 'var(--text-subtle)' }}
                    onClick={() => handleDelete(batch.id, batch.pair)}
                    title="Delete Batch"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Metrics Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, background: 'rgba(255,255,255,0.02)', padding: '12px 14px', borderRadius: 'var(--radius-sm)' }}>
                  <div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Win Rate</div>
                    <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: '#10b981' }}>
                      {formatSafePercent(batch.winRate)}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-subtle)' }}>
                      {batch.wins}W / {batch.losses}L / {batch.breakevens}BE
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                      Recorded Expectancy <span style={{ fontSize: 10, color: '#f59e0b' }}>(entered)</span>
                    </div>
                    <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: '#f59e0b' }}>
                      {batch.recordedExpectancyR !== undefined && batch.recordedExpectancyR !== null
                        ? `${batch.recordedExpectancyR > 0 ? '+' : ''}${batch.recordedExpectancyR}R`
                        : 'Not logged'}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-subtle)' }}>From backtest journal</div>
                  </div>

                  <div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Rule Violations</div>
                    <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: batch.ruleViolations > 0 ? '#ef4444' : '#10b981' }}>
                      {batch.ruleViolations}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-subtle)' }}>
                      {batch.sampleSize > 0
                        ? `${formatSafePercent(safePct(batch.sampleSize - batch.ruleViolations, batch.sampleSize))} adherence`
                        : '—'}
                    </div>
                  </div>
                </div>

                {batch.notes && (
                  <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    {batch.notes}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Record Backtest Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Microscope size={18} style={{ color: '#f59e0b' }} /> Record Backtest Batch
              </h2>
              <button className="btn-icon" onClick={() => setShowModal(false)}>×</button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Setup / Strategy *</label>
                  {setups.length > 0 ? (
                    <select
                      className="select"
                      value={form.setupId}
                      onChange={(e) => setForm({ ...form, setupId: e.target.value })}
                    >
                      {setups.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.status})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. London Sweep"
                      value={form.setupId}
                      onChange={(e) => setForm({ ...form, setupId: e.target.value })}
                    />
                  )}
                </div>

                <div>
                  <label className="form-label">Pair *</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="EUR/USD"
                    value={form.pair}
                    onChange={(e) => setForm({ ...form, pair: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Timeframe</label>
                  <input
                    type="text"
                    className="input"
                    value={form.timeframe}
                    onChange={(e) => setForm({ ...form, timeframe: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label">Start Date</label>
                  <input
                    type="date"
                    className="input"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label">End Date</label>
                  <input
                    type="date"
                    className="input"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label className="form-label">Sample Size *</label>
                  <input
                    type="number"
                    min="1"
                    className="input"
                    value={form.sampleSize}
                    onChange={(e) => setForm({ ...form, sampleSize: parseInt(e.target.value, 10) || 0 })}
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Wins</label>
                  <input
                    type="number"
                    min="0"
                    className="input"
                    value={form.wins}
                    onChange={(e) => setForm({ ...form, wins: parseInt(e.target.value, 10) || 0 })}
                  />
                </div>

                <div>
                  <label className="form-label">Losses</label>
                  <input
                    type="number"
                    min="0"
                    className="input"
                    value={form.losses}
                    onChange={(e) => setForm({ ...form, losses: parseInt(e.target.value, 10) || 0 })}
                  />
                </div>

                <div>
                  <label className="form-label">Breakevens</label>
                  <input
                    type="number"
                    min="0"
                    className="input"
                    value={form.breakevens}
                    onChange={(e) => setForm({ ...form, breakevens: parseInt(e.target.value, 10) || 0 })}
                  />
                </div>
              </div>

              {/* Calculated Win Rate Preview */}
              <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(16, 185, 129, 0.2)', fontSize: 'var(--text-xs)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#10b981', fontWeight: 600 }}>System-Calculated Win Rate:</span>
                <span style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: '#10b981' }}>
                  {form.sampleSize > 0 ? `${Math.round((form.wins / form.sampleSize) * 100)}%` : '0%'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">
                    Recorded Expectancy (R)
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block' }}>
                      Entered from external log
                    </span>
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. 1.8"
                    value={form.recordedExpectancyR}
                    onChange={(e) => setForm({ ...form, recordedExpectancyR: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label">
                    Rule Violations
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block' }}>
                      Historical deviations
                    </span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="input"
                    value={form.ruleViolations}
                    onChange={(e) => setForm({ ...form, ruleViolations: parseInt(e.target.value, 10) || 0 })}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Notes & Observations</label>
                <textarea
                  className="textarea"
                  rows={2}
                  placeholder="e.g. Tested across 3 months of NY session data. Most losses occurred on CPI news days."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>

              <div className="modal-footer" style={{ marginTop: 6 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ background: '#f59e0b', borderColor: '#f59e0b', color: '#000', fontWeight: 600 }}
                >
                  Save Backtest Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
