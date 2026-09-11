// ============================================================================
// PERSONAL OS — SaaS User Metrics View (Traction & Economics)
// Periodic observations of users, paying conversion, churn, and MRR.
// ============================================================================

import { useState } from 'react';
import {
  Plus,
  Trash2, X,
} from 'lucide-react';
import { useStore, logEvent } from '../../hooks/useDatabase';
import { STORES } from '../../services/db';
import type { SaasUserMetricSnapshot } from '../../types';
import { generateId, now, formatDate, formatINR, formatSafePercent } from '../../utils/helpers';
import { showToast } from '../Toast';

interface UserMetricsViewProps {
  snapshots: SaasUserMetricSnapshot[];
}

export function UserMetricsView({ snapshots }: UserMetricsViewProps) {
  const { add, remove } = useStore<SaasUserMetricSnapshot>(STORES.SAAS_USER_SNAPSHOTS);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form state
  const [form, setForm] = useState({
    totalUsers: '',
    activeUsers: '',
    newUsers: '',
    payingUsers: '',
    churnedUsers: '',
    revenue: '',
    recurringRevenue: '',
    recordedAt: new Date().toISOString().split('T')[0],
  });

  const handleRecordSnapshot = async () => {
    const total = Number(form.totalUsers) || 0;
    const active = Number(form.activeUsers) || 0;
    const paying = Number(form.payingUsers) || 0;
    const churned = Number(form.churnedUsers) || 0;
    const rev = Number(form.revenue) || 0;
    const mrr = Number(form.recurringRevenue) || 0;

    const snapshot: SaasUserMetricSnapshot = {
      id: generateId('snap'),
      totalUsers: total,
      activeUsers: active,
      newUsers: Number(form.newUsers) || 0,
      payingUsers: paying,
      churnedUsers: churned,
      revenue: rev,
      recurringRevenue: mrr,
      activationRate: total > 0 ? (active / total) * 100 : undefined,
      retentionRate: total > 0 ? ((total - churned) / total) * 100 : undefined,
      recordedAt: form.recordedAt || now(),
      createdAt: now(),
    };

    await add(snapshot);
    await logEvent('trading_os', 'SAAS_USER_METRIC_RECORDED', {
      entityRefType: 'SaasUserMetricSnapshot',
      entityRefId: snapshot.id,
      metadata: {
        totalUsers: snapshot.totalUsers,
        activeUsers: snapshot.activeUsers,
        payingUsers: snapshot.payingUsers,
        recurringRevenue: snapshot.recurringRevenue,
        revenue: snapshot.revenue,
      },
    });

    showToast(`User metric snapshot recorded: ${snapshot.totalUsers} users (${snapshot.payingUsers} paying)`, 'success');
    setShowAddModal(false);
    setForm({
      totalUsers: '',
      activeUsers: '',
      newUsers: '',
      payingUsers: '',
      churnedUsers: '',
      revenue: '',
      recurringRevenue: '',
      recordedAt: new Date().toISOString().split('T')[0],
    });
  };

  const handleDelete = async (snap: SaasUserMetricSnapshot) => {
    if (confirm('Delete this user metrics snapshot?')) {
      await remove(snap.id);
      showToast('Snapshot deleted', 'info');
    }
  };

  // Sort descending
  const sortedSnapshots = [...snapshots].sort((a, b) => {
    const timeA = new Date(a.recordedAt || a.createdAt).getTime();
    const timeB = new Date(b.recordedAt || b.createdAt).getTime();
    return timeB - timeA;
  });

  const latest = sortedSnapshots[0] || null;
  const conversionRate = latest && latest.totalUsers > 0
    ? (latest.payingUsers / latest.totalUsers) * 100
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* LATEST METRIC HIGHLIGHTS */}
      {latest ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div className="card" style={{ padding: 16, background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
            <div style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 600, marginBottom: 2 }}>
              TOTAL USERS
            </div>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
              {latest.totalUsers}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 2 }}>
              {latest.activeUsers} active ({formatSafePercent(latest.activationRate ?? null)})
            </div>
          </div>

          <div className="card" style={{ padding: 16, background: 'rgba(34, 197, 94, 0.05)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
            <div style={{ fontSize: '11px', color: '#22c55e', fontWeight: 600, marginBottom: 2 }}>
              PAYING CUSTOMERS
            </div>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#22c55e' }}>
              {latest.payingUsers}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 2 }}>
              Conversion: {formatSafePercent(conversionRate)}
            </div>
          </div>

          <div className="card" style={{ padding: 16, background: 'rgba(139, 92, 246, 0.05)', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
            <div style={{ fontSize: '11px', color: '#8b5cf6', fontWeight: 600, marginBottom: 2 }}>
              RECURRING REVENUE (MRR)
            </div>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#8b5cf6' }}>
              {formatINR(latest.recurringRevenue)}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 2 }}>
              Total Revenue: {formatINR(latest.revenue)}
            </div>
          </div>

          <div className="card" style={{ padding: 16, background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
            <div style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 600, marginBottom: 2 }}>
              CHURNED USERS
            </div>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: latest.churnedUsers > 0 ? '#ef4444' : 'var(--text-muted)' }}>
              {latest.churnedUsers}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 2 }}>
              Retention: {formatSafePercent(latest.retentionRate ?? null)}
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
          No user metric observations recorded yet. Click "Record Snapshot" below to log real user counts and revenue.
        </div>
      )}

      {/* TOOLBAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
            Historical Observation Snapshots
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Observed real-world metrics. No fabricated estimations.
          </div>
        </div>

        <button
          className="btn btn-primary btn-sm"
          onClick={() => setShowAddModal(true)}
          style={{ gap: 6 }}
        >
          <Plus size={14} /> Record Snapshot
        </button>
      </div>

      {/* SNAPSHOTS TABLE */}
      <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px' }}>Date</th>
              <th style={{ padding: '12px 16px' }}>Total Users</th>
              <th style={{ padding: '12px 16px' }}>Active Users</th>
              <th style={{ padding: '12px 16px' }}>Paying Users</th>
              <th style={{ padding: '12px 16px' }}>Conversion %</th>
              <th style={{ padding: '12px 16px' }}>MRR</th>
              <th style={{ padding: '12px 16px' }}>Churned</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedSnapshots.map((s) => {
              const conv = s.totalUsers > 0 ? (s.payingUsers / s.totalUsers) * 100 : null;
              return (
                <tr key={s.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {formatDate(s.recordedAt)}
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)' }}>
                    {s.totalUsers} {s.newUsers > 0 && <span style={{ color: '#22c55e', fontSize: '10px' }}>(+{s.newUsers})</span>}
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    {s.activeUsers}
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', color: '#22c55e', fontWeight: 600 }}>
                    {s.payingUsers}
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    {formatSafePercent(conv)}
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', color: '#8b5cf6', fontWeight: 600 }}>
                    {formatINR(s.recurringRevenue)}
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', color: s.churnedUsers > 0 ? '#ef4444' : 'var(--text-muted)' }}>
                    {s.churnedUsers}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <button
                      className="btn-icon btn-ghost"
                      onClick={() => handleDelete(s)}
                      title="Delete snapshot"
                    >
                      <Trash2 size={14} style={{ color: '#ef4444' }} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {sortedSnapshots.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No snapshots recorded. Log observations periodically as users sign up and pay.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* RECORD SNAPSHOT MODAL */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>Record User Metric Snapshot</h3>
              <button className="btn-icon btn-ghost" onClick={() => setShowAddModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="label">Observation Date</label>
                <input
                  type="date"
                  className="input"
                  value={form.recordedAt}
                  onChange={(e) => setForm({ ...form, recordedAt: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="label">Total Registered Users *</label>
                  <input
                    type="number"
                    placeholder="e.g. 10"
                    className="input"
                    value={form.totalUsers}
                    onChange={(e) => setForm({ ...form, totalUsers: e.target.value })}
                    autoFocus
                  />
                </div>

                <div>
                  <label className="label">Active Users (7d / 30d)</label>
                  <input
                    type="number"
                    placeholder="e.g. 7"
                    className="input"
                    value={form.activeUsers}
                    onChange={(e) => setForm({ ...form, activeUsers: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="label">Paying Users</label>
                  <input
                    type="number"
                    placeholder="e.g. 1"
                    className="input"
                    value={form.payingUsers}
                    onChange={(e) => setForm({ ...form, payingUsers: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">Churned Users</label>
                  <input
                    type="number"
                    placeholder="e.g. 0"
                    className="input"
                    value={form.churnedUsers}
                    onChange={(e) => setForm({ ...form, churnedUsers: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="label">Recurring Revenue (MRR) (₹)</label>
                  <input
                    type="number"
                    placeholder="e.g. 100"
                    className="input"
                    value={form.recurringRevenue}
                    onChange={(e) => setForm({ ...form, recurringRevenue: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">Total Revenue (₹)</label>
                  <input
                    type="number"
                    placeholder="e.g. 100"
                    className="input"
                    value={form.revenue}
                    onChange={(e) => setForm({ ...form, revenue: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={handleRecordSnapshot}>
                  Record Snapshot
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
