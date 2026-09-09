// ============================================================================
// PERSONAL OS — Career Capital & Assets View
// Catalog and maintain leverage assets: portfolio projects, GitHub repos,
// tailored resume versions, technical articles, and interview prep assets.
// ============================================================================

import { useState } from 'react';
import {
  Sparkles,
  Plus,
  FolderGit2,
  ExternalLink,
  Edit2,
  Trash2,
  FileText,
  Code2,
  BookOpen,
  Award,
} from 'lucide-react';
import { useStore, logEvent, notifyDataChange } from '../../hooks/useDatabase';
import { dbPut, dbDelete, STORES } from '../../services/db';
import type { CareerCapital, CareerAssetType, CareerAssetStatus } from '../../types';
import { generateId, now, timeAgo } from '../../utils/helpers';
import { showToast } from '../Toast';

const ASSET_TYPES: { type: CareerAssetType; label: string; icon: any }[] = [
  { type: 'PORTFOLIO_PROJECT', label: 'Portfolio Project', icon: Code2 },
  { type: 'GITHUB_REPO', label: 'GitHub Repository', icon: FolderGit2 },
  { type: 'RESUME_VERSION', label: 'Resume Version', icon: FileText },
  { type: 'ARTICLE', label: 'Technical Article', icon: BookOpen },
  { type: 'OPEN_SOURCE', label: 'Open Source PR', icon: FolderGit2 },
  { type: 'INTERVIEW_PREP', label: 'Interview Prep Sheet', icon: Award },
];

const STATUS_CONFIG: Record<CareerAssetStatus, { label: string; color: string; bg: string }> = {
  ACTIVE: { label: 'Active / Live', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)' },
  IN_PROGRESS: { label: 'In Progress', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.15)' },
  PLANNED: { label: 'Planned', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
  ARCHIVED: { label: 'Archived', color: '#71717a', bg: 'rgba(113, 113, 122, 0.15)' },
};

export function CareerCapitalView() {
  const { items: assets, loading } = useStore<CareerCapital>(STORES.CAREER_CAPITAL);

  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<CareerCapital | null>(null);

  // Form fields
  const [title, setTitle] = useState('');
  const [assetType, setAssetType] = useState<CareerAssetType>('PORTFOLIO_PROJECT');
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<CareerAssetStatus>('ACTIVE');
  const [notes, setNotes] = useState('');

  const resetForm = () => {
    setTitle('');
    setAssetType('PORTFOLIO_PROJECT');
    setUrl('');
    setStatus('ACTIVE');
    setNotes('');
    setEditingAsset(null);
  };

  const openAdd = () => {
    resetForm();
    setShowAddModal(true);
  };

  const openEdit = (a: CareerCapital) => {
    setEditingAsset(a);
    setTitle(a.title);
    setAssetType(a.assetType);
    setUrl(a.url || '');
    setStatus(a.status);
    setNotes(a.notes || '');
    setShowAddModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('Title is required', 'warning');
      return;
    }

    try {
      const timestamp = now();
      if (editingAsset) {
        const updated: CareerCapital = {
          ...editingAsset,
          title: title.trim(),
          assetType,
          url: url.trim() || undefined,
          status,
          notes: notes.trim() || undefined,
          lastUpdatedAt: timestamp,
        };
        await dbPut(STORES.CAREER_CAPITAL, updated);
        showToast('Asset updated', 'success');
      } else {
        const newId = generateId('asset');
        const newAsset: CareerCapital = {
          id: newId,
          title: title.trim(),
          assetType,
          url: url.trim() || undefined,
          status,
          notes: notes.trim() || undefined,
          lastUpdatedAt: timestamp,
        };
        await dbPut(STORES.CAREER_CAPITAL, newAsset);

        await logEvent(
          'job_hunt',
          'CAREER_CAPITAL_CREATED',
          1,
          'assets',
          'CAREER_CAPITAL',
          newId,
          { title: title.trim(), assetType, status }
        );
        showToast('Career asset added', 'success');
      }

      notifyDataChange();
      setShowAddModal(false);
      resetForm();
    } catch (err) {
      console.error(err);
      showToast('Failed to save asset', 'error');
    }
  };

  const handleDelete = async (id: string, assetTitle: string) => {
    if (confirm(`Delete "${assetTitle}"?`)) {
      await dbDelete(STORES.CAREER_CAPITAL, id);
      notifyDataChange();
      showToast('Asset deleted', 'info');
    }
  };

  const filtered = assets.filter((a) => {
    const matchesType = selectedType === 'ALL' || a.assetType === selectedType;
    const matchesStatus = selectedStatus === 'ALL' || a.status === selectedStatus;
    return matchesType && matchesStatus;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={20} style={{ color: '#06b6d4' }} />
              Career Capital & Proof of Work
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
              Maintain tangible artifacts that convert opportunities into interviews and offers
            </p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>
            <Plus size={16} /> Add Asset
          </button>
        </div>

        {/* Counts summary */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: 12,
          marginTop: 16,
          paddingTop: 16,
          borderTop: '1px solid var(--border-subtle)',
        }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Assets</div>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{assets.length}</div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Active & Live</div>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#22c55e' }}>
              {assets.filter((a) => a.status === 'ACTIVE').length}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>In Development</div>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#6366f1' }}>
              {assets.filter((a) => a.status === 'IN_PROGRESS').length}
            </div>
          </div>
        </div>
      </div>

      {/* Filter row */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={() => setSelectedType('ALL')}
          className="btn btn-sm"
          style={{
            fontSize: '11px',
            borderRadius: 'var(--radius-full)',
            background: selectedType === 'ALL' ? '#06b6d4' : 'var(--bg-card)',
            color: selectedType === 'ALL' ? '#fff' : 'var(--text-secondary)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          All Types
        </button>
        {ASSET_TYPES.map((t) => (
          <button
            key={t.type}
            onClick={() => setSelectedType(t.type)}
            className="btn btn-sm"
            style={{
              fontSize: '11px',
              borderRadius: 'var(--radius-full)',
              background: selectedType === t.type ? '#06b6d4' : 'var(--bg-card)',
              color: selectedType === t.type ? '#fff' : 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Assets Grid */}
      {loading ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading assets...
        </div>
      ) : filtered.length === 0 ? (
        <div className="card empty-state" style={{ padding: 40 }}>
          <FolderGit2 size={36} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
          <div className="empty-state-title">No career capital tracked</div>
          <div className="empty-state-text">
            Add your portfolio projects, key GitHub repositories, tailored resume links, or technical writeups.
          </div>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 16 }} onClick={openAdd}>
            <Plus size={14} /> Add First Asset
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
          {filtered.map((asset) => {
            const typeConfig = ASSET_TYPES.find((t) => t.type === asset.assetType) || ASSET_TYPES[0];
            const Icon = typeConfig.icon;
            const statusConfig = STATUS_CONFIG[asset.status] || STATUS_CONFIG.ACTIVE;

            return (
              <div
                key={asset.id}
                className="card"
                style={{
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: '10px',
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: 'rgba(6, 182, 212, 0.15)',
                      color: '#06b6d4',
                      fontWeight: 600,
                    }}>
                      <Icon size={12} /> {typeConfig.label}
                    </span>

                    <span style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: statusConfig.bg,
                      color: statusConfig.color,
                      fontWeight: 700,
                    }}>
                      {statusConfig.label}
                    </span>
                  </div>

                  <h4 style={{ margin: '0 0 4px', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                    {asset.title}
                  </h4>

                  {asset.notes && (
                    <p style={{
                      margin: '4px 0 0',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.4,
                    }}>
                      {asset.notes}
                    </p>
                  )}
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: 10,
                  borderTop: '1px solid var(--border-subtle)',
                  marginTop: 6,
                }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {asset.url ? (
                      <a
                        href={asset.url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '11px', padding: '3px 8px', gap: 4 }}
                      >
                        <ExternalLink size={12} /> Open
                      </a>
                    ) : (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Updated {timeAgo(asset.lastUpdatedAt)}</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      className="btn-icon"
                      style={{ width: 26, height: 26, padding: 4 }}
                      onClick={() => openEdit(asset)}
                      title="Edit"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      className="btn-icon"
                      style={{ width: 26, height: 26, padding: 4, color: '#ef4444' }}
                      onClick={() => handleDelete(asset.id, asset.title)}
                      title="Delete"
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

      {/* Add / Edit Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 'var(--text-lg)' }}>
              {editingAsset ? 'Edit Career Asset' : 'Add Career Capital Asset'}
            </h3>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Asset Title *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Distributed Cache in Rust, Tailored Full-Stack Resume"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Asset Type</label>
                  <select
                    className="form-input"
                    value={assetType}
                    onChange={(e) => setAssetType(e.target.value as CareerAssetType)}
                  >
                    {ASSET_TYPES.map((t) => (
                      <option key={t.type} value={t.type}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Status</label>
                  <select
                    className="form-input"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as CareerAssetStatus)}
                  >
                    <option value="ACTIVE">Active / Live</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="PLANNED">Planned</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">URL / Repository / Doc Link</label>
                <input
                  type="url"
                  className="form-input"
                  placeholder="https://github.com/... or https://..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label">Description / Highlight</label>
                <textarea
                  className="form-input"
                  rows={2}
                  placeholder="Key talking points, tech stack used, metrics or stars..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingAsset ? 'Update Asset' : 'Save Asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
