// ============================================================================
// PERSONAL OS — Forex Strategy & Setup Development Tab
// Manages the setup lifecycle: DRAFT → BACKTESTING → PAPER_TRADING → VALIDATED
// ============================================================================

import { useState } from 'react';
import {
  Compass, Plus, Trash2,
  Edit2, Clock, ShieldCheck, Target,
} from 'lucide-react';
import { useStore, logEvent } from '../../hooks/useDatabase';
import { STORES } from '../../services/db';
import type { ForexSetup, SetupStatus } from '../../types';
import { ALL_SETUP_STATUSES, type ForexKpiSummary } from '../../services/forexKpi';
import { generateId, now } from '../../utils/helpers';
import { showToast } from '../Toast';

interface ForexSetupsTabProps {
  kpis: ForexKpiSummary;
}

const STATUS_COLORS: Record<SetupStatus, { bg: string; text: string; border: string }> = {
  DRAFT: { bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8', border: '#475569' },
  BACKTESTING: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6', border: '#1d4ed8' },
  PAPER_TRADING: { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', border: '#b45309' },
  VALIDATED: { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981', border: '#059669' },
  REJECTED: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', border: '#b91c1c' },
};

export function ForexSetupsTab({ kpis }: ForexSetupsTabProps) {
  const { items: setups, add, update, remove } = useStore<ForexSetup>(STORES.FOREX_SETUPS);
  const [showModal, setShowModal] = useState(false);
  const [editingSetup, setEditingSetup] = useState<ForexSetup | null>(null);

  const [form, setForm] = useState({
    name: '',
    marketContext: 'Trend Continuation',
    timeframe: '15m',
    entryRules: '',
    slRules: '',
    tpRules: '',
    status: 'DRAFT' as SetupStatus,
    notes: '',
  });

  const openCreateModal = () => {
    setEditingSetup(null);
    setForm({
      name: '',
      marketContext: 'Trend Continuation',
      timeframe: '15m',
      entryRules: '',
      slRules: '',
      tpRules: '',
      status: 'DRAFT',
      notes: '',
    });
    setShowModal(true);
  };

  const openEditModal = (setup: ForexSetup) => {
    setEditingSetup(setup);
    setForm({
      name: setup.name,
      marketContext: setup.marketContext,
      timeframe: setup.timeframe,
      entryRules: setup.entryRules,
      slRules: setup.slRules,
      tpRules: setup.tpRules,
      status: setup.status,
      notes: setup.notes || '',
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.entryRules.trim()) {
      showToast('Please enter setup name and entry rules', 'error');
      return;
    }

    if (editingSetup) {
      const updated: ForexSetup = {
        ...editingSetup,
        name: form.name.trim(),
        marketContext: form.marketContext.trim(),
        timeframe: form.timeframe.trim(),
        entryRules: form.entryRules.trim(),
        slRules: form.slRules.trim(),
        tpRules: form.tpRules.trim(),
        status: form.status,
        notes: form.notes.trim() || undefined,
        updatedAt: now(),
      };
      await update(updated);
      showToast(`Updated setup: ${updated.name}`, 'success');
    } else {
      const newSetup: ForexSetup = {
        id: generateId('fx_setup'),
        name: form.name.trim(),
        marketContext: form.marketContext.trim(),
        timeframe: form.timeframe.trim(),
        entryRules: form.entryRules.trim(),
        slRules: form.slRules.trim(),
        tpRules: form.tpRules.trim(),
        status: form.status,
        notes: form.notes.trim() || undefined,
        createdAt: now(),
        updatedAt: now(),
      };
      await add(newSetup);

      // Log activity event
      await logEvent('forex', 'FOREX_SETUP_DOCUMENTED', {
        quantity: 1,
        unit: 'setup',
        entityRefType: 'ForexSetup',
        entityRefId: newSetup.id,
        metadata: {
          name: newSetup.name,
          timeframe: newSetup.timeframe,
          marketContext: newSetup.marketContext,
          status: newSetup.status,
        },
      });

      showToast(`Documented new setup: ${newSetup.name}`, 'success');
    }

    setShowModal(false);
  };

  const handleStatusChange = async (setup: ForexSetup, nextStatus: SetupStatus) => {
    const updated: ForexSetup = {
      ...setup,
      status: nextStatus,
      updatedAt: now(),
    };
    await update(updated);

    await logEvent('forex', 'FOREX_SETUP_DOCUMENTED', {
      quantity: 1,
      unit: 'setup',
      entityRefType: 'ForexSetup',
      entityRefId: setup.id,
      metadata: {
        name: setup.name,
        previousStatus: setup.status,
        status: nextStatus,
      },
    });

    showToast(`Setup status updated to ${nextStatus}`, 'info');
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Delete setup "${name}"?`)) {
      await remove(id);
      showToast('Setup deleted', 'info');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Stat Ribbon */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 4 }}>
            Total Setups
          </div>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
            {kpis.totalSetups}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', marginTop: 4 }}>
            Documented playbooks
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={14} style={{ color: '#10b981' }} /> Validated Setups
          </div>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: '#10b981' }}>
            {kpis.setupsValidated}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', marginTop: 4 }}>
            Proven edge & discipline
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={14} style={{ color: '#3b82f6' }} /> In Backtesting
          </div>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: '#3b82f6' }}>
            {kpis.setupsBacktesting}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', marginTop: 4 }}>
            Collecting sample size
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Target size={14} style={{ color: '#f59e0b' }} /> In Paper Trading
          </div>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: '#f59e0b' }}>
            {kpis.setupsPaperTrading}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', marginTop: 4 }}>
            Forward-testing execution
          </div>
        </div>
      </div>

      {/* Action Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 600, margin: 0 }}>
            Trading Setups & Playbooks
          </h2>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Explicit entry, stop-loss, and target rules. Setups must be validated through backtesting before forward paper trading.
          </p>
        </div>

        <button
          className="btn btn-primary"
          style={{ background: '#f59e0b', borderColor: '#f59e0b', color: '#000', fontWeight: 600 }}
          onClick={openCreateModal}
        >
          <Plus size={16} /> Document Setup
        </button>
      </div>

      {/* Setups List */}
      {setups.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <Compass size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: 6 }}>
            No trading setups defined yet
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', maxWidth: 460, margin: '0 auto 16px' }}>
            Define an explicit setup (e.g. London Session Liquidity Sweep, Fair Value Gap Reversal) with precise rules to guide your backtesting and paper trading.
          </p>
          <button
            className="btn btn-primary btn-sm"
            style={{ background: '#f59e0b', borderColor: '#f59e0b', color: '#000' }}
            onClick={openCreateModal}
          >
            <Plus size={14} /> Document First Setup
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {setups.map((setup) => {
            const statusStyle = STATUS_COLORS[setup.status] || STATUS_COLORS.DRAFT;
            return (
              <div
                key={setup.id}
                className="card"
                style={{
                  padding: 18,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  borderTop: `3px solid ${statusStyle.text}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, margin: 0 }}>
                      {setup.name}
                    </h3>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                      <span className="badge" style={{ fontSize: 11, background: 'rgba(255,255,255,0.06)' }}>
                        {setup.timeframe}
                      </span>
                      <span className="badge" style={{ fontSize: 11, background: 'rgba(255,255,255,0.06)' }}>
                        {setup.marketContext}
                      </span>
                    </div>
                  </div>

                  <span
                    className="badge"
                    style={{
                      background: statusStyle.bg,
                      color: statusStyle.text,
                      border: `1px solid ${statusStyle.border}`,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {setup.status}
                  </span>
                </div>

                {/* Rules Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 'var(--text-xs)' }}>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontWeight: 600, color: '#10b981' }}>Entry: </span>
                    <span style={{ color: 'var(--text-primary)' }}>{setup.entryRules}</span>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontWeight: 600, color: '#ef4444' }}>Stop Loss: </span>
                    <span style={{ color: 'var(--text-primary)' }}>{setup.slRules || 'Defined per setup structure'}</span>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontWeight: 600, color: '#3b82f6' }}>Target / Exit: </span>
                    <span style={{ color: 'var(--text-primary)' }}>{setup.tpRules || 'Minimum 1.5R target'}</span>
                  </div>
                </div>

                {setup.notes && (
                  <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    {setup.notes}
                  </p>
                )}

                {/* Lifecycle Transitions & Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {setup.status === 'DRAFT' && (
                      <button
                        className="btn btn-xs btn-ghost"
                        style={{ color: '#3b82f6' }}
                        onClick={() => handleStatusChange(setup, 'BACKTESTING')}
                      >
                        → Backtest
                      </button>
                    )}
                    {setup.status === 'BACKTESTING' && (
                      <button
                        className="btn btn-xs btn-ghost"
                        style={{ color: '#f59e0b' }}
                        onClick={() => handleStatusChange(setup, 'PAPER_TRADING')}
                      >
                        → Paper Trade
                      </button>
                    )}
                    {setup.status === 'PAPER_TRADING' && (
                      <button
                        className="btn btn-xs btn-ghost"
                        style={{ color: '#10b981' }}
                        onClick={() => handleStatusChange(setup, 'VALIDATED')}
                      >
                        ✓ Validate
                      </button>
                    )}
                    {setup.status !== 'REJECTED' && (
                      <button
                        className="btn btn-xs btn-ghost"
                        style={{ color: '#ef4444' }}
                        onClick={() => handleStatusChange(setup, 'REJECTED')}
                      >
                        Reject
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="btn-icon"
                      style={{ color: 'var(--text-subtle)' }}
                      onClick={() => openEditModal(setup)}
                      title="Edit Setup"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      className="btn-icon"
                      style={{ color: 'var(--text-subtle)' }}
                      onClick={() => handleDelete(setup.id, setup.name)}
                      title="Delete Setup"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Setup Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Compass size={18} style={{ color: '#f59e0b' }} /> {editingSetup ? 'Edit Setup' : 'Document Trading Setup'}
              </h2>
              <button className="btn-icon" onClick={() => setShowModal(false)}>×</button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Setup Name *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. London Session Liquidity Breakout"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  autoFocus
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Timeframe</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. 15m, 1h, 4h"
                    value={form.timeframe}
                    onChange={(e) => setForm({ ...form, timeframe: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label">Market Context</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Trend Continuation, Range Reversal"
                    value={form.marketContext}
                    onChange={(e) => setForm({ ...form, marketContext: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Entry Rules *</label>
                <textarea
                  className="textarea"
                  rows={3}
                  placeholder="Exact triggers required for valid entry (e.g. Asian high swept + 15m market structure shift + retest of FVG)"
                  value={form.entryRules}
                  onChange={(e) => setForm({ ...form, entryRules: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Stop Loss Rules</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Beyond swing high + 2 pips buffer"
                    value={form.slRules}
                    onChange={(e) => setForm({ ...form, slRules: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label">Target / Exit Rules</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Opposing liquidity pool / 2.0R"
                    value={form.tpRules}
                    onChange={(e) => setForm({ ...form, tpRules: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Lifecycle Stage</label>
                  <select
                    className="select"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as SetupStatus })}
                  >
                    {ALL_SETUP_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">Notes & Guidelines</label>
                <textarea
                  className="textarea"
                  rows={2}
                  placeholder="Key observations, high-spread times to avoid, news filters..."
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
                  {editingSetup ? 'Save Changes' : 'Save Setup'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
