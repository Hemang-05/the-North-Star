// ============================================================================
// PERSONAL OS — VOIRE Drops & Capsule Campaigns Tab
// Limited-edition drops, release schedules, and target revenue.
// ============================================================================

import { useState } from 'react';
import { Sparkles, Plus, Trash2, Edit2, Calendar, Target } from 'lucide-react';
import type { VoireDrop, VoireDropStatus, VoireProduct } from '../../types/pillars';
import { dbPut, dbDelete, STORES } from '../../services/db';
import { logEvent, notifyDataChange } from '../../hooks/useDatabase';
import { showToast } from '../Toast';
import { formatINR, formatDate } from '../../utils/helpers';

interface VoireDropsTabProps {
  drops: VoireDrop[];
  products: VoireProduct[];
}

export function VoireDropsTab({ drops, products }: VoireDropsTabProps) {
  const [showModal, setShowModal] = useState(false);
  const [editingDrop, setEditingDrop] = useState<VoireDrop | null>(null);

  const [name, setName] = useState('');
  const [theme, setTheme] = useState('');
  const [status, setStatus] = useState<VoireDropStatus>('PLANNING');
  const [scheduledAt, setScheduledAt] = useState('');
  const [endedAt, setEndedAt] = useState('');
  const [targetRevenue, setTargetRevenue] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  const openCreateModal = () => {
    setEditingDrop(null);
    setName('');
    setTheme('');
    setStatus('PLANNING');
    setScheduledAt('');
    setEndedAt('');
    setTargetRevenue('');
    setNotes('');
    setSelectedProductIds([]);
    setShowModal(true);
  };

  const openEditModal = (drop: VoireDrop) => {
    setEditingDrop(drop);
    setName(drop.name);
    setTheme(drop.theme || '');
    setStatus(drop.status);
    setScheduledAt(drop.scheduledAt ? drop.scheduledAt.slice(0, 16) : '');
    setEndedAt(drop.endedAt ? drop.endedAt.slice(0, 16) : '');
    setTargetRevenue(drop.targetRevenue ?? '');
    setNotes(drop.notes || '');
    setSelectedProductIds(drop.productIds || []);
    setShowModal(true);
  };

  const toggleProduct = (prodId: string) => {
    if (selectedProductIds.includes(prodId)) {
      setSelectedProductIds(selectedProductIds.filter((id) => id !== prodId));
    } else {
      setSelectedProductIds([...selectedProductIds, prodId]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Drop name is required', 'warning');
      return;
    }

    const now = new Date().toISOString();
    const dropId = editingDrop ? editingDrop.id : `vd_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    const dropRecord: VoireDrop = {
      id: dropId,
      name: name.trim(),
      status,
      theme: theme.trim() || undefined,
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
      endedAt: endedAt ? new Date(endedAt).toISOString() : undefined,
      targetRevenue: typeof targetRevenue === 'number' ? targetRevenue : undefined,
      productIds: selectedProductIds,
      notes: notes.trim() || undefined,
      createdAt: editingDrop ? editingDrop.createdAt : now,
      updatedAt: now,
    };

    await dbPut(STORES.VOIRE_DROPS, dropRecord);

    // Activity Event Emission
    await logEvent({
      pillarId: 'voire',
      eventType: editingDrop ? 'VOIRE_DROP_UPDATED' : 'VOIRE_DROP_CREATED',
      entityRef: {
        type: 'VoireDrop',
        id: dropId,
      },
      metadata: { status, productCount: selectedProductIds.length, targetRevenue, name },
    });

    notifyDataChange(STORES.VOIRE_DROPS);
    showToast(editingDrop ? 'Drop updated' : 'Capsule drop created', 'success');
    setShowModal(false);
  };

  const handleDelete = async (id: string, dropName: string) => {
    if (!window.confirm(`Delete drop "${dropName}"?`)) return;
    await dbDelete(STORES.VOIRE_DROPS, id);
    notifyDataChange(STORES.VOIRE_DROPS);
    showToast('Drop deleted', 'info');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f9fafb', margin: 0 }}>Drops & Capsule Releases</h2>
          <p style={{ fontSize: '0.875rem', color: '#9ca3af', margin: '0.25rem 0 0 0' }}>
            Time-boxed streetwear releases, release hype, and revenue targets.
          </p>
        </div>
        <button className="voire-btn-primary" onClick={openCreateModal}>
          <Plus size={16} /> Plan New Drop
        </button>
      </div>

      {drops.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '0.75rem', border: '1px dashed rgba(255,255,255,0.1)' }}>
          <Sparkles size={40} style={{ color: '#a855f7', opacity: 0.6, margin: '0 auto 1rem' }} />
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#f3f4f6', marginBottom: '0.5rem' }}>No Drops Scheduled</h3>
          <p style={{ fontSize: '0.875rem', color: '#9ca3af', maxWidth: '24rem', margin: '0 auto 1.5rem' }}>
            Plan a capsule release window, assign products, and set revenue targets.
          </p>
          <button className="voire-btn-primary" onClick={openCreateModal}>
            <Plus size={16} /> Plan First Drop
          </button>
        </div>
      ) : (
        <div className="voire-table-wrapper">
          <table className="voire-table">
            <thead>
              <tr>
                <th>Drop Name</th>
                <th>Theme</th>
                <th>Status</th>
                <th>Assigned SKUs</th>
                <th>Release Schedule</th>
                <th>Target Revenue</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {drops.map((drop) => (
                <tr key={drop.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: '#ffffff' }}>{drop.name}</div>
                    {drop.notes && <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>{drop.notes}</div>}
                  </td>
                  <td>{drop.theme || '—'}</td>
                  <td>
                    <span className={`voire-badge ${drop.status.toLowerCase()}`}>
                      {drop.status}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.8125rem', color: '#a855f7', fontWeight: 600 }}>
                      {drop.productIds ? drop.productIds.length : 0} product(s)
                    </span>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.8125rem', color: '#e5e7eb' }}>
                      {drop.scheduledAt ? formatDate(drop.scheduledAt) : 'Unscheduled'}
                    </div>
                  </td>
                  <td style={{ fontWeight: 600, color: '#10b981' }}>
                    {drop.targetRevenue ? formatINR(drop.targetRevenue) : '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="voire-btn-secondary" style={{ padding: '0.375rem 0.5rem' }} onClick={() => openEditModal(drop)}>
                        <Edit2 size={14} />
                      </button>
                      <button className="voire-btn-danger" onClick={() => handleDelete(drop.id, drop.name)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
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
              {editingDrop ? 'Edit Capsule Drop' : 'Plan New Capsule Drop'}
            </h3>
            <form onSubmit={handleSave}>
              <div className="voire-form-group">
                <label className="voire-form-label">Drop Name *</label>
                <input
                  type="text"
                  className="voire-form-input"
                  placeholder="e.g. Genesis Drop 01 — Overcast"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="voire-form-group">
                  <label className="voire-form-label">Theme</label>
                  <input
                    type="text"
                    className="voire-form-input"
                    placeholder="e.g. Monolith / Brutalist"
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                  />
                </div>

                <div className="voire-form-group">
                  <label className="voire-form-label">Status</label>
                  <select
                    className="voire-form-select"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as VoireDropStatus)}
                  >
                    <option value="PLANNING">PLANNING</option>
                    <option value="SCHEDULED">SCHEDULED</option>
                    <option value="LIVE">LIVE</option>
                    <option value="ENDED">ENDED</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="voire-form-group">
                  <label className="voire-form-label">Scheduled Launch Date</label>
                  <input
                    type="datetime-local"
                    className="voire-form-input"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                  />
                </div>

                <div className="voire-form-group">
                  <label className="voire-form-label">Revenue Target (₹)</label>
                  <input
                    type="number"
                    className="voire-form-input"
                    placeholder="e.g. 150000"
                    value={targetRevenue}
                    onChange={(e) => setTargetRevenue(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="voire-form-group">
                <label className="voire-form-label">Assign Products to Drop</label>
                {products.length === 0 ? (
                  <div style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>No products available. Add products in the Products tab first.</div>
                ) : (
                  <div style={{ maxHeight: '140px', overflowY: 'auto', background: 'rgba(255,255,255,0.02)', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {products.map((p) => (
                      <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0', cursor: 'pointer', fontSize: '0.875rem' }}>
                        <input
                          type="checkbox"
                          checked={selectedProductIds.includes(p.id)}
                          onChange={() => toggleProduct(p.id)}
                        />
                        <span style={{ color: '#e5e7eb' }}>{p.name} ({p.sku}) — {formatINR(p.retailPrice)}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="voire-form-group">
                <label className="voire-form-label">Strategy Notes</label>
                <textarea
                  rows={2}
                  className="voire-form-textarea"
                  placeholder="Scarcity cap, marketing hook, pre-order window..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="voire-btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="voire-btn-primary">
                  {editingDrop ? 'Save Drop' : 'Create Drop'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
