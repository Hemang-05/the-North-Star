// ============================================================================
// PERSONAL OS — Forex Paper Trading Execution Tab
// Operational forward-testing journal tracking execution fidelity, R-multiples,
// and process discipline without live financial risk.
// ============================================================================

import { useState } from 'react';
import {
  LineChart, Plus, CheckCircle2, AlertTriangle, Trash2,
  TrendingUp, TrendingDown, Clock, ShieldCheck, ShieldAlert,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { useStore, logEvent } from '../../hooks/useDatabase';
import { STORES } from '../../services/db';
import type { ForexPaperTrade, ForexSetup, TradeMistake, PaperTradeResult } from '../../types';
import {
  ALL_TRADE_MISTAKES,
  SEVERE_TRADE_MISTAKES,
  type ForexKpiSummary,
} from '../../services/forexKpi';
import { generateId, now, formatDate, formatSafePercent } from '../../utils/helpers';
import { showToast } from '../Toast';

interface ForexPaperTradesTabProps {
  kpis: ForexKpiSummary;
}

const RESULT_COLORS: Record<PaperTradeResult, { bg: string; text: string }> = {
  WIN: { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981' },
  LOSS: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' },
  BREAKEVEN: { bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8' },
  OPEN: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6' },
};

export function ForexPaperTradesTab({ kpis }: ForexPaperTradesTabProps) {
  const { items: trades, add, remove } = useStore<ForexPaperTrade>(STORES.FOREX_PAPER_TRADES);
  const { items: setups } = useStore<ForexSetup>(STORES.FOREX_SETUPS);
  const [showModal, setShowModal] = useState(false);
  const [filterResult, setFilterResult] = useState<string>('ALL');

  const setupMap = Object.fromEntries(setups.map((s) => [s.id, s.name]));

  // Form State
  const [form, setForm] = useState({
    setupId: '',
    pair: 'EUR/USD',
    direction: 'LONG' as 'LONG' | 'SHORT',
    entryPrice: '',
    slPrice: '',
    tpPrice: '',
    exitPrice: '',
    rMultiple: '1.0',
    result: 'WIN' as PaperTradeResult,
    ruleAdhered: true,
    mistakeTag: 'NONE' as TradeMistake,
    entryReason: '',
    notes: '',
    tradedAt: new Date().toISOString().slice(0, 10),
  });

  const openModal = () => {
    setForm({
      setupId: setups.length > 0 ? setups[0].id : '',
      pair: 'EUR/USD',
      direction: 'LONG',
      entryPrice: '',
      slPrice: '',
      tpPrice: '',
      exitPrice: '',
      rMultiple: '1.0',
      result: 'WIN',
      ruleAdhered: true,
      mistakeTag: 'NONE',
      entryReason: '',
      notes: '',
      tradedAt: new Date().toISOString().slice(0, 10),
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.pair.trim()) {
      showToast('Please enter a currency pair', 'error');
      return;
    }

    const parsedR = form.rMultiple !== '' ? parseFloat(form.rMultiple) : undefined;

    const newTrade: ForexPaperTrade = {
      id: generateId('fx_trade'),
      setupId: form.setupId || (setups[0]?.id ?? undefined),
      pair: form.pair.trim().toUpperCase(),
      direction: form.direction,
      entryPrice: parseFloat(form.entryPrice) || 0,
      slPrice: parseFloat(form.slPrice) || 0,
      tpPrice: parseFloat(form.tpPrice) || 0,
      exitPrice: form.exitPrice !== '' ? parseFloat(form.exitPrice) : undefined,
      rMultiple: parsedR,
      result: form.result,
      ruleAdhered: form.ruleAdhered,
      mistakeTag: form.mistakeTag,
      entryReason: form.entryReason.trim() || undefined,
      notes: form.notes.trim() || undefined,
      tradedAt: new Date(form.tradedAt).toISOString(),
      createdAt: now(),
    };

    await add(newTrade);

    // Ledger Activity Event with full entity reference and metadata
    await logEvent('forex', 'FOREX_PAPER_TRADE', {
      quantity: 1,
      unit: 'trade',
      entityRefType: 'ForexPaperTrade',
      entityRefId: newTrade.id,
      metadata: {
        pair: newTrade.pair,
        direction: newTrade.direction,
        result: newTrade.result,
        rMultiple: newTrade.rMultiple,
        ruleAdhered: newTrade.ruleAdhered,
        mistakeTag: newTrade.mistakeTag,
        setupId: newTrade.setupId,
        setupName: newTrade.setupId ? setupMap[newTrade.setupId] : 'Unassigned',
      },
    });

    // If rules were violated or severe mistake made, also emit FOREX_RULE_VIOLATION event
    if (!newTrade.ruleAdhered || newTrade.mistakeTag !== 'NONE') {
      await logEvent('forex', 'FOREX_RULE_VIOLATION', {
        quantity: 1,
        unit: 'violation',
        entityRefType: 'ForexPaperTrade',
        entityRefId: newTrade.id,
        metadata: {
          pair: newTrade.pair,
          mistakeTag: newTrade.mistakeTag,
          ruleAdhered: newTrade.ruleAdhered,
          severe: SEVERE_TRADE_MISTAKES.includes(newTrade.mistakeTag),
        },
      });
    }

    showToast(`Logged paper trade: ${newTrade.pair} (${newTrade.result})`, 'success');
    setShowModal(false);
  };

  const handleDelete = async (id: string, pair: string) => {
    if (window.confirm(`Delete paper trade on ${pair}?`)) {
      await remove(id);
      showToast('Paper trade deleted', 'info');
    }
  };

  const filteredTrades = trades
    .filter((t) => filterResult === 'ALL' || t.result === filterResult)
    .sort((a, b) => (b.tradedAt || b.createdAt).localeCompare(a.tradedAt || a.createdAt));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Stat Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <LineChart size={14} style={{ color: '#f59e0b' }} /> Total Paper Trades
          </div>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
            {kpis.totalPaperTrades} <span style={{ fontSize: 'var(--text-sm)', fontWeight: 400 }}>trades</span>
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', marginTop: 4 }}>
            {kpis.tradesThisWeek} executed this week
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={14} style={{ color: '#10b981' }} /> Process Adherence (Primary)
          </div>
          <div
            style={{
              fontSize: 'var(--text-2xl)',
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
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', marginTop: 4 }}>
            {kpis.ruleAdheredCount} followed / {kpis.ruleViolatedCount} violated
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <TrendingUp size={14} style={{ color: '#3b82f6' }} /> Average R-Multiple
          </div>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: '#3b82f6' }}>
            {kpis.averageRMultiple !== null
              ? `${kpis.averageRMultiple > 0 ? '+' : ''}${kpis.averageRMultiple}R`
              : '—'}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', marginTop: 4 }}>
            Total: {kpis.totalRRealized > 0 ? '+' : ''}{kpis.totalRRealized}R realized
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={14} style={{ color: '#ec4899' }} /> Clean Streak
          </div>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: '#ec4899' }}>
            {kpis.cleanTradeStreak} <span style={{ fontSize: 'var(--text-sm)', fontWeight: 400 }}>trades</span>
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', marginTop: 4 }}>
            Consecutive error-free executions
          </div>
        </div>
      </div>

      {/* Filter & Action Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {(['ALL', 'WIN', 'LOSS', 'BREAKEVEN', 'OPEN'] as const).map((r) => (
            <button
              key={r}
              className={`btn btn-sm ${filterResult === r ? 'btn-primary' : 'btn-ghost'}`}
              style={
                filterResult === r
                  ? { background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', borderColor: '#f59e0b' }
                  : {}
              }
              onClick={() => setFilterResult(r)}
            >
              {r === 'ALL' ? `All Trades (${trades.length})` : r}
            </button>
          ))}
        </div>

        <button
          className="btn btn-primary"
          style={{ background: '#f59e0b', borderColor: '#f59e0b', color: '#000', fontWeight: 600 }}
          onClick={openModal}
        >
          <Plus size={16} /> Log Paper Trade
        </button>
      </div>

      {/* Trades List */}
      {filteredTrades.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <LineChart size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: 6 }}>
            No paper trades logged
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', maxWidth: 460, margin: '0 auto 16px' }}>
            Practice execution in live forward conditions with zero money at risk. Record rule adherence and mistake tags to build disciplined execution habits.
          </p>
          <button
            className="btn btn-primary btn-sm"
            style={{ background: '#f59e0b', borderColor: '#f59e0b', color: '#000' }}
            onClick={openModal}
          >
            <Plus size={14} /> Log First Paper Trade
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredTrades.map((trade) => {
            const resStyle = RESULT_COLORS[trade.result] || RESULT_COLORS.OPEN;
            const setupName = trade.setupId ? setupMap[trade.setupId] : null;
            const isSevereMistake = SEVERE_TRADE_MISTAKES.includes(trade.mistakeTag);

            return (
              <div
                key={trade.id}
                className="card"
                style={{
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  borderLeft: `4px solid ${trade.ruleAdhered ? '#10b981' : '#ef4444'}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>
                        {trade.pair}
                      </span>
                      <span
                        className="badge"
                        style={{
                          background: trade.direction === 'LONG' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: trade.direction === 'LONG' ? '#10b981' : '#ef4444',
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {trade.direction === 'LONG' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                        {trade.direction}
                      </span>
                      <span
                        className="badge"
                        style={{
                          background: resStyle.bg,
                          color: resStyle.text,
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {trade.result}
                      </span>
                      {trade.rMultiple !== undefined && trade.rMultiple !== null && trade.result !== 'OPEN' && (
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: 'var(--text-sm)',
                            color: trade.rMultiple > 0 ? '#10b981' : trade.rMultiple < 0 ? '#ef4444' : 'var(--text-muted)',
                          }}
                        >
                          {trade.rMultiple > 0 ? `+${trade.rMultiple}R` : `${trade.rMultiple}R`}
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <span>Date: {formatDate(trade.tradedAt || trade.createdAt)}</span>
                      {setupName && <span>Setup: {setupName}</span>}
                      {trade.entryPrice > 0 && <span>Entry: {trade.entryPrice}</span>}
                      {trade.slPrice > 0 && <span>SL: {trade.slPrice}</span>}
                      {trade.tpPrice > 0 && <span>TP: {trade.tpPrice}</span>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {trade.ruleAdhered ? (
                      <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontSize: 11, gap: 4 }}>
                        <ShieldCheck size={12} /> Rule Adhered
                      </span>
                    ) : (
                      <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontSize: 11, gap: 4 }}>
                        <ShieldAlert size={12} /> Rule Violated
                      </span>
                    )}

                    {trade.mistakeTag !== 'NONE' && (
                      <span
                        className="badge"
                        style={{
                          background: isSevereMistake ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                          color: isSevereMistake ? '#ef4444' : '#f59e0b',
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {trade.mistakeTag}
                      </span>
                    )}

                    <button
                      className="btn-icon"
                      style={{ color: 'var(--text-subtle)' }}
                      onClick={() => handleDelete(trade.id, trade.pair)}
                      title="Delete Trade"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {trade.entryReason && (
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-primary)', background: 'rgba(255,255,255,0.02)', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Entry Reason: </span>
                    {trade.entryReason}
                  </div>
                )}

                {trade.notes && (
                  <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    {trade.notes}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Log Trade Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <LineChart size={18} style={{ color: '#f59e0b' }} /> Log Paper Trade
              </h2>
              <button className="btn-icon" onClick={() => setShowModal(false)}>×</button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Setup / Strategy</label>
                  {setups.length > 0 ? (
                    <select
                      className="select"
                      value={form.setupId}
                      onChange={(e) => setForm({ ...form, setupId: e.target.value })}
                    >
                      <option value="">Unassigned</option>
                      {setups.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className="input"
                      placeholder="Optional setup name"
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

                <div>
                  <label className="form-label">Direction</label>
                  <select
                    className="select"
                    value={form.direction}
                    onChange={(e) => setForm({ ...form, direction: e.target.value as 'LONG' | 'SHORT' })}
                  >
                    <option value="LONG">LONG</option>
                    <option value="SHORT">SHORT</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label className="form-label">Entry Price</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="1.0850"
                    value={form.entryPrice}
                    onChange={(e) => setForm({ ...form, entryPrice: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label">Stop Loss</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="1.0830"
                    value={form.slPrice}
                    onChange={(e) => setForm({ ...form, slPrice: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label">Take Profit</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="1.0890"
                    value={form.tpPrice}
                    onChange={(e) => setForm({ ...form, tpPrice: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label">Exit Price</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="1.0890"
                    value={form.exitPrice}
                    onChange={(e) => setForm({ ...form, exitPrice: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Result *</label>
                  <select
                    className="select"
                    value={form.result}
                    onChange={(e) => setForm({ ...form, result: e.target.value as PaperTradeResult })}
                  >
                    <option value="WIN">WIN</option>
                    <option value="LOSS">LOSS</option>
                    <option value="BREAKEVEN">BREAKEVEN</option>
                    <option value="OPEN">OPEN</option>
                  </select>
                </div>

                <div>
                  <label className="form-label">R-Multiple</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="+2.0 or -1.0"
                    value={form.rMultiple}
                    onChange={(e) => setForm({ ...form, rMultiple: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label">Trade Date</label>
                  <input
                    type="date"
                    className="input"
                    value={form.tradedAt}
                    onChange={(e) => setForm({ ...form, tradedAt: e.target.value })}
                  />
                </div>
              </div>

              {/* Discipline Section */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: 14, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ShieldCheck size={14} /> Execution Discipline Audit (Primary KPI)
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr', gap: 12, alignItems: 'center' }}>
                  <div>
                    <label className="form-label" style={{ marginBottom: 6 }}>Followed All Rules?</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className={`btn btn-sm ${form.ruleAdhered ? 'btn-primary' : 'btn-ghost'}`}
                        style={form.ruleAdhered ? { background: '#10b981', borderColor: '#10b981', color: '#fff' } : {}}
                        onClick={() => setForm({ ...form, ruleAdhered: true })}
                      >
                        ✓ YES (Adhered)
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm ${!form.ruleAdhered ? 'btn-primary' : 'btn-ghost'}`}
                        style={!form.ruleAdhered ? { background: '#ef4444', borderColor: '#ef4444', color: '#fff' } : {}}
                        onClick={() => setForm({ ...form, ruleAdhered: false })}
                      >
                        ✕ NO (Violated)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="form-label">Behavioral / Mistake Tag</label>
                    <select
                      className="select"
                      value={form.mistakeTag}
                      onChange={(e) => setForm({ ...form, mistakeTag: e.target.value as TradeMistake })}
                    >
                      {ALL_TRADE_MISTAKES.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {!form.ruleAdhered && (
                  <div style={{ fontSize: 'var(--text-xs)', color: '#ef4444', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={12} /> Rule violation will be logged in your discipline ledger.
                  </div>
                )}
              </div>

              <div>
                <label className="form-label">Entry Reason / Confirmations</label>
                <textarea
                  className="textarea"
                  rows={2}
                  placeholder="e.g. 15m liquidity grab + 5m displacement into FVG"
                  value={form.entryReason}
                  onChange={(e) => setForm({ ...form, entryReason: e.target.value })}
                />
              </div>

              <div>
                <label className="form-label">Post-Trade Review & Lessons</label>
                <textarea
                  className="textarea"
                  rows={2}
                  placeholder="What went well? Any emotional hesitation or rush?"
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
                  Save Paper Trade
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
