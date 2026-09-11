// ============================================================================
// PERSONAL OS — VOIRE Creative Studio / Designs Tab
// Concept development, sampling lifecycle, tech-pack tracking.
// ============================================================================

import { useState } from 'react';
import { Palette, Plus, Trash2, Edit2, ExternalLink } from 'lucide-react';
import type { VoireDesign, VoireDesignStage } from '../../types/pillars';
import { dbPut, dbDelete, STORES } from '../../services/db';
import { logEvent, notifyDataChange } from '../../hooks/useDatabase';
import { showToast } from '../Toast';
import { formatINR } from '../../utils/helpers';

interface VoireDesignsTabProps {
  designs: VoireDesign[];
}

export function VoireDesignsTab({ designs }: VoireDesignsTabProps) {
  const [showModal, setShowModal] = useState(false);
  const [editingDesign, setEditingDesign] = useState<VoireDesign | null>(null);

  const [name, setName] = useState('');
  const [theme, setTheme] = useState('');
  const [status, setStatus] = useState<VoireDesignStage>('CONCEPT');
  const [techPackUrl, setTechPackUrl] = useState('');
  const [estimatedProductionCost, setEstimatedProductionCost] = useState<number | ''>('');
  const [notes, setNotes] = useState('');

  const openCreateModal = () => {
    setEditingDesign(null);
    setName('');
    setTheme('');
    setStatus('CONCEPT');
    setTechPackUrl('');
    setEstimatedProductionCost('');
    setNotes('');
    setShowModal(true);
  };

  const openEditModal = (design: VoireDesign) => {
    setEditingDesign(design);
    setName(design.name || design.title || '');
    setTheme(design.theme || '');
    setStatus((design.stage || design.status || 'CONCEPT') as VoireDesignStage);
    setTechPackUrl(design.techPackUrl || '');
    setEstimatedProductionCost(design.estimatedProductionCost !== undefined ? design.estimatedProductionCost : '');
    setNotes(design.notes || '');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Please enter a design concept name', 'warning');
      return;
    }

    const now = new Date().toISOString();
    const designId = editingDesign ? editingDesign.id : `vd_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    const designRecord: VoireDesign = {
      id: designId,
      name: name.trim(),
      status,
      theme: theme.trim() || undefined,
      notes: notes.trim() || undefined,
      techPackUrl: techPackUrl.trim() || undefined,
      estimatedProductionCost: typeof estimatedProductionCost === 'number' ? estimatedProductionCost : undefined,
      createdAt: editingDesign ? editingDesign.createdAt : now,
      updatedAt: now,
    };

    await dbPut(STORES.VOIRE_DESIGNS, designRecord);

    // Activity Event Emission
    await logEvent({
      pillarId: 'voire',
      eventType: editingDesign ? 'VOIRE_DESIGN_UPDATED' : 'VOIRE_DESIGN_CREATED',
      entityRef: {
        type: 'VoireDesign',
        id: designId,
      },
      metadata: { status, theme, estimatedProductionCost, name },
    });

    notifyDataChange(STORES.VOIRE_DESIGNS);
    showToast(editingDesign ? 'Design updated' : 'Design concept created', 'success');
    setShowModal(false);
  };

  const handleDelete = async (id: string, designName: string) => {
    if (!window.confirm(`Delete design "${designName}"?`)) return;
    await dbDelete(STORES.VOIRE_DESIGNS, id);
    notifyDataChange(STORES.VOIRE_DESIGNS);
    showToast('Design deleted', 'info');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f9fafb', margin: 0 }}>Creative Studio & Tech Packs</h2>
          <p style={{ fontSize: '0.875rem', color: '#9ca3af', margin: '0.25rem 0 0 0' }}>
            Ideation, graphic design assets, sampling pipeline, and manufacturing handoffs.
          </p>
        </div>
        <button className="voire-btn-primary" onClick={openCreateModal}>
          <Plus size={16} /> New Design
        </button>
      </div>

      {designs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '0.75rem', border: '1px dashed rgba(255,255,255,0.1)' }}>
          <Palette size={40} style={{ color: '#a855f7', opacity: 0.6, margin: '0 auto 1rem' }} />
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#f3f4f6', marginBottom: '0.5rem' }}>No Design Concepts Yet</h3>
          <p style={{ fontSize: '0.875rem', color: '#9ca3af', maxWidth: '24rem', margin: '0 auto 1.5rem' }}>
            Record graphic artwork, apparel silhouettes, and physical sampling progress.
          </p>
          <button className="voire-btn-primary" onClick={openCreateModal}>
            <Plus size={16} /> Create First Design
          </button>
        </div>
      ) : (
        <div className="voire-table-wrapper">
          <table className="voire-table">
            <thead>
              <tr>
                <th>Design Name</th>
                <th>Theme / Category</th>
                <th>Status</th>
                <th>Est. Unit Cost</th>
                <th>Tech Pack</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {designs.map((design) => (
                <tr key={design.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: '#ffffff' }}>{design.name || design.title || 'Untitled Design'}</div>
                    {design.notes && <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>{design.notes}</div>}
                  </td>
                  <td>{design.theme || '—'}</td>
                  <td>
                    <span className={`voire-badge ${(design.status || design.stage || 'CONCEPT').toLowerCase().replace(/_/g, '-')}`}>
                      {(design.status || design.stage || 'CONCEPT').replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td>{design.estimatedProductionCost ? formatINR(design.estimatedProductionCost) : '—'}</td>
                  <td>
                    {design.techPackUrl ? (
                      <a
                        href={design.techPackUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#a855f7', textDecoration: 'none', fontSize: '0.8125rem' }}
                      >
                        Spec File <ExternalLink size={12} />
                      </a>
                    ) : (
                      <span style={{ color: '#6b7280' }}>—</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="voire-btn-secondary" style={{ padding: '0.375rem 0.5rem' }} onClick={() => openEditModal(design)}>
                        <Edit2 size={14} />
                      </button>
                      <button className="voire-btn-danger" onClick={() => handleDelete(design.id, design.name || design.title || 'design')}>
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
              {editingDesign ? 'Edit Design Concept' : 'New Design Concept'}
            </h3>
            <form onSubmit={handleSave}>
              <div className="voire-form-group">
                <label className="voire-form-label">Concept / Artwork Name *</label>
                <input
                  type="text"
                  className="voire-form-input"
                  placeholder="e.g. Cyberpunk Heavyweight Hoodie"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="voire-form-group">
                <label className="voire-form-label">Theme / Collection</label>
                <input
                  type="text"
                  className="voire-form-input"
                  placeholder="e.g. Genesis Drop 01, Monolith FW26"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                />
              </div>

              <div className="voire-form-group">
                <label className="voire-form-label">Lifecycle Status</label>
                <select
                  className="voire-form-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as VoireDesignStage)}
                >
                  <option value="DRAFT">DRAFT (Ideation / Vector Art)</option>
                  <option value="SAMPLING">SAMPLING (Sample with Manufacturer)</option>
                  <option value="SAMPLE_APPROVED">SAMPLE APPROVED (Production Grade)</option>
                  <option value="SAMPLE_REJECTED">SAMPLE REJECTED (Revise Specs)</option>
                  <option value="READY_FOR_DROP">READY FOR DROP (Catalog Candidate)</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
              </div>

              <div className="voire-form-group">
                <label className="voire-form-label">Estimated Unit Production Cost (₹)</label>
                <input
                  type="number"
                  className="voire-form-input"
                  placeholder="e.g. 750"
                  value={estimatedProductionCost}
                  onChange={(e) => setEstimatedProductionCost(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>

              <div className="voire-form-group">
                <label className="voire-form-label">Tech Pack / Asset URL</label>
                <input
                  type="url"
                  className="voire-form-input"
                  placeholder="https://drive.google.com/..."
                  value={techPackUrl}
                  onChange={(e) => setTechPackUrl(e.target.value)}
                />
              </div>

              <div className="voire-form-group">
                <label className="voire-form-label">Design & Fabric Notes</label>
                <textarea
                  rows={3}
                  className="voire-form-textarea"
                  placeholder="Fabric specs, GSM, puff print dimensions, colorways..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="voire-btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="voire-btn-primary">
                  {editingDesign ? 'Save Changes' : 'Create Concept'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
