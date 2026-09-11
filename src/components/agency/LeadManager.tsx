// ============================================================================
// PERSONAL OS — Lead Manager (Pipeline Kanban + Table)
// Visual lead pipeline with stage progression and convert-to-client flow.
// ============================================================================

import { useState } from 'react';
import {
  Plus, Users, ArrowRight, UserCheck, X, Trash2,
} from 'lucide-react';
import { useStore, logEvent } from '../../hooks/useDatabase';
import { STORES } from '../../services/db';
import type { AgencyLead, AgencyClient, LeadStage } from '../../types';
import { ALL_LEAD_STAGES, ACTIVE_LEAD_STAGES } from '../../services/agencyKpi';
import { generateId, now, formatINR, timeAgo } from '../../utils/helpers';
import { showToast } from '../Toast';

interface LeadManagerProps {
  leads: AgencyLead[];
  clients: AgencyClient[];
  onConvertToClient: (lead: AgencyLead) => void;
}

// Ordered pipeline columns for Kanban
const PIPELINE_COLUMNS: { stage: LeadStage; label: string; color: string }[] = [
  { stage: 'LEAD_FOUND', label: 'Lead Found', color: '#64748b' },
  { stage: 'CONTACTED', label: 'Contacted', color: '#06b6d4' },
  { stage: 'CALL', label: 'Call / Meeting', color: '#f59e0b' },
  { stage: 'PROPOSAL', label: 'Proposal', color: '#ec4899' },
  { stage: 'NEGOTIATION', label: 'Negotiation', color: '#6366f1' },
  { stage: 'WON', label: 'Won ✓', color: '#22c55e' },
];

export function LeadManager({ leads, clients: _clients, onConvertToClient }: LeadManagerProps) {
  const { add, update, remove } = useStore<AgencyLead>(STORES.AGENCY_LEADS);
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewMode, setViewMode] = useState<'KANBAN' | 'TABLE'>('KANBAN');
  const [selectedLead, setSelectedLead] = useState<AgencyLead | null>(null);

  // New lead form state
  const [newLead, setNewLead] = useState({
    companyName: '',
    contactPerson: '',
    email: '',
    source: '',
    estimatedDealValue: '',
    dealProbability: '50',
    problemStatement: '',
    proposedService: '',
    notes: '',
  });

  const handleAddLead = async () => {
    if (!newLead.companyName.trim()) {
      showToast('Company name is required', 'error');
      return;
    }
    const lead: AgencyLead = {
      id: generateId('lead'),
      companyName: newLead.companyName.trim(),
      contactPerson: newLead.contactPerson || undefined,
      email: newLead.email || undefined,
      source: newLead.source || 'Direct',
      estimatedDealValue: newLead.estimatedDealValue ? Number(newLead.estimatedDealValue) : undefined,
      dealProbability: Number(newLead.dealProbability) || 50,
      problemStatement: newLead.problemStatement || undefined,
      proposedService: newLead.proposedService || undefined,
      stage: 'LEAD_FOUND',
      discoveredAt: now(),
      notes: newLead.notes || undefined,
      createdAt: now(),
      updatedAt: now(),
    };
    await add(lead);
    await logEvent('agency', 'AGENCY_LEAD_FOUND', {
      entityRefType: 'AgencyLead',
      entityRefId: lead.id,
      metadata: { company: lead.companyName, source: lead.source },
    });
    showToast(`Lead added: ${lead.companyName}`, 'success');
    setShowAddModal(false);
    setNewLead({ companyName: '', contactPerson: '', email: '', source: '', estimatedDealValue: '', dealProbability: '50', problemStatement: '', proposedService: '', notes: '' });
  };

  const handleStageChange = async (lead: AgencyLead, newStage: LeadStage) => {
    const updated = { ...lead, stage: newStage, updatedAt: now() };
    await update(updated);
    await logEvent('agency', `AGENCY_LEAD_${newStage}`, {
      entityRefType: 'AgencyLead',
      entityRefId: lead.id,
      metadata: { company: lead.companyName, from: lead.stage, to: newStage },
    });
    showToast(`${lead.companyName} → ${newStage.replace(/_/g, ' ')}`, 'success');

    // If WON, prompt convert to client
    if (newStage === 'WON') {
      onConvertToClient(updated);
    }
  };

  const handleDeleteLead = async (lead: AgencyLead) => {
    await remove(lead.id);
    showToast(`Lead deleted: ${lead.companyName}`, 'success');
    setSelectedLead(null);
  };

  // Get next stage for a lead
  const getNextStage = (currentStage: LeadStage): LeadStage | null => {
    const order: LeadStage[] = ['LEAD_FOUND', 'CONTACTED', 'CALL', 'PROPOSAL', 'NEGOTIATION', 'WON'];
    const idx = order.indexOf(currentStage);
    if (idx >= 0 && idx < order.length - 1) return order[idx + 1];
    return null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600 }}>
            Sales Pipeline
          </h3>
          <span style={{
            fontSize: '11px', padding: '2px 8px', borderRadius: 8,
            background: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa',
          }}>
            {leads.filter(l => ACTIVE_LEAD_STAGES.has(l.stage)).length} active
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{
            display: 'flex', borderRadius: 'var(--radius-sm)', overflow: 'hidden',
            border: '1px solid var(--border-subtle)',
          }}>
            {(['KANBAN', 'TABLE'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  padding: '6px 12px', border: 'none', fontSize: '11px', cursor: 'pointer',
                  background: viewMode === mode ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                  color: viewMode === mode ? '#a78bfa' : 'var(--text-muted)',
                  fontWeight: viewMode === mode ? 600 : 400,
                }}
              >
                {mode === 'KANBAN' ? 'Pipeline' : 'Table'}
              </button>
            ))}
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
            <Plus size={14} /> New Lead
          </button>
        </div>
      </div>

      {/* KANBAN VIEW */}
      {viewMode === 'KANBAN' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${PIPELINE_COLUMNS.length}, minmax(180px, 1fr))`,
          gap: 12,
          overflowX: 'auto',
          paddingBottom: 8,
        }}>
          {PIPELINE_COLUMNS.map(col => {
            const columnLeads = leads.filter(l => l.stage === col.stage);
            return (
              <div key={col.stage} style={{
                minHeight: 200,
                background: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                padding: '12px',
              }}>
                {/* Column Header */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 12, paddingBottom: 8, borderBottom: `2px solid ${col.color}`,
                }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: col.color }}>
                    {col.label}
                  </span>
                  <span style={{
                    fontSize: '10px', padding: '1px 6px', borderRadius: 8,
                    background: `${col.color}20`, color: col.color,
                  }}>
                    {columnLeads.length}
                  </span>
                </div>

                {/* Lead Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {columnLeads.map(lead => {
                    const nextStage = getNextStage(lead.stage);
                    return (
                      <div
                        key={lead.id}
                        onClick={() => setSelectedLead(lead)}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--bg-primary)',
                          border: '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                          transition: 'border-color 0.15s ease',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = col.color)}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
                      >
                        <div style={{ fontWeight: 600, fontSize: '12px', marginBottom: 4 }}>
                          {lead.companyName}
                        </div>
                        {lead.contactPerson && (
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: 4 }}>
                            {lead.contactPerson}
                          </div>
                        )}
                        {lead.estimatedDealValue && (
                          <div style={{
                            fontSize: '11px', fontFamily: 'var(--font-mono)',
                            color: '#22c55e', marginBottom: 6,
                          }}>
                            {formatINR(lead.estimatedDealValue)}
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            {lead.source}
                          </span>
                          {nextStage && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStageChange(lead, nextStage);
                              }}
                              style={{
                                padding: '2px 6px', borderRadius: 4, border: 'none',
                                background: `${col.color}20`, color: col.color,
                                fontSize: '10px', cursor: 'pointer', display: 'flex',
                                alignItems: 'center', gap: 2,
                              }}
                            >
                              <ArrowRight size={10} />
                            </button>
                          )}
                          {lead.stage === 'WON' && !lead.clientId && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onConvertToClient(lead);
                              }}
                              style={{
                                padding: '2px 8px', borderRadius: 4, border: 'none',
                                background: 'rgba(34, 197, 94, 0.2)', color: '#22c55e',
                                fontSize: '10px', cursor: 'pointer', fontWeight: 600,
                                display: 'flex', alignItems: 'center', gap: 4,
                              }}
                            >
                              <UserCheck size={10} /> Convert
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TABLE VIEW */}
      {viewMode === 'TABLE' && (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                {['Company', 'Contact', 'Source', 'Stage', 'Deal Value', 'Probability', 'Discovered', 'Actions'].map(h => (
                  <th key={h} style={{
                    padding: '10px 12px', textAlign: 'left', fontSize: '11px',
                    color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase',
                    letterSpacing: '0.03em',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...leads].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(lead => {
                const stageInfo = ALL_LEAD_STAGES.find(s => s.stage === lead.stage);
                const nextStage = getNextStage(lead.stage);
                return (
                  <tr key={lead.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{lead.companyName}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{lead.contactPerson || '—'}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{lead.source}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 8, fontSize: '10px', fontWeight: 600,
                        background: `${stageInfo?.color || '#64748b'}20`,
                        color: stageInfo?.color || '#64748b',
                      }}>
                        {stageInfo?.label || lead.stage}
                      </span>
                    </td>
                    <td style={{
                      padding: '10px 12px', fontFamily: 'var(--font-mono)',
                      color: lead.estimatedDealValue ? '#22c55e' : 'var(--text-muted)',
                    }}>
                      {lead.estimatedDealValue ? formatINR(lead.estimatedDealValue) : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                      {lead.dealProbability != null ? `${lead.dealProbability}%` : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: '11px' }}>
                      {timeAgo(lead.discoveredAt)}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {nextStage && (
                          <button
                            className="btn btn-sm"
                            style={{ padding: '3px 8px', fontSize: '10px', gap: 4 }}
                            onClick={() => handleStageChange(lead, nextStage)}
                          >
                            <ArrowRight size={10} /> Advance
                          </button>
                        )}
                        <button
                          className="btn btn-sm"
                          style={{ padding: '3px 6px', color: '#ef4444' }}
                          onClick={() => handleDeleteLead(lead)}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {leads.length === 0 && (
            <div className="empty-state" style={{ padding: '40px 20px' }}>
              <Users size={32} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
              <div className="empty-state-title">No leads yet</div>
              <div className="empty-state-text">Add your first lead to start building the sales pipeline.</div>
            </div>
          )}
        </div>
      )}

      {/* Lead Detail Panel */}
      {selectedLead && (
        <div className="modal-backdrop" onClick={() => setSelectedLead(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>{selectedLead.companyName}</h3>
              <button className="btn-icon" onClick={() => setSelectedLead(null)}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: '12px' }}>
              <div><span style={{ color: 'var(--text-muted)' }}>Contact:</span> {selectedLead.contactPerson || '—'}</div>
              <div><span style={{ color: 'var(--text-muted)' }}>Email:</span> {selectedLead.email || '—'}</div>
              <div><span style={{ color: 'var(--text-muted)' }}>Source:</span> {selectedLead.source}</div>
              <div><span style={{ color: 'var(--text-muted)' }}>Stage:</span> {selectedLead.stage.replace(/_/g, ' ')}</div>
              <div><span style={{ color: 'var(--text-muted)' }}>Deal Value:</span> {selectedLead.estimatedDealValue ? formatINR(selectedLead.estimatedDealValue) : '—'}</div>
              <div><span style={{ color: 'var(--text-muted)' }}>Probability:</span> {selectedLead.dealProbability || 0}%</div>
            </div>
            {selectedLead.problemStatement && (
              <div style={{ marginTop: 12, fontSize: '12px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Problem:</span> {selectedLead.problemStatement}
              </div>
            )}
            {selectedLead.notes && (
              <div style={{ marginTop: 8, fontSize: '12px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Notes:</span> {selectedLead.notes}
              </div>
            )}
            {/* Stage quick-select */}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: 8 }}>Move to stage:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {ALL_LEAD_STAGES.map(s => (
                  <button
                    key={s.stage}
                    className="btn btn-sm"
                    disabled={s.stage === selectedLead.stage}
                    style={{
                      padding: '4px 10px', fontSize: '10px',
                      background: s.stage === selectedLead.stage ? `${s.color}30` : 'transparent',
                      color: s.color, borderColor: `${s.color}40`,
                      opacity: s.stage === selectedLead.stage ? 1 : 0.7,
                    }}
                    onClick={() => {
                      handleStageChange(selectedLead, s.stage);
                      setSelectedLead({ ...selectedLead, stage: s.stage });
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button className="btn btn-secondary btn-sm" style={{ color: '#ef4444' }} onClick={() => handleDeleteLead(selectedLead)}>
                <Trash2 size={14} /> Delete
              </button>
              {selectedLead.stage === 'WON' && !selectedLead.clientId && (
                <button className="btn btn-primary btn-sm" onClick={() => {
                  onConvertToClient(selectedLead);
                  setSelectedLead(null);
                }}>
                  <UserCheck size={14} /> Convert to Client
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Lead Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 'var(--text-lg)' }}>Add New Lead</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="text"
                className="input"
                placeholder="Company Name *"
                value={newLead.companyName}
                onChange={e => setNewLead({ ...newLead, companyName: e.target.value })}
                autoFocus
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input
                  type="text"
                  className="input"
                  placeholder="Contact Person"
                  value={newLead.contactPerson}
                  onChange={e => setNewLead({ ...newLead, contactPerson: e.target.value })}
                />
                <input
                  type="email"
                  className="input"
                  placeholder="Email"
                  value={newLead.email}
                  onChange={e => setNewLead({ ...newLead, email: e.target.value })}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <select
                  className="input"
                  value={newLead.source}
                  onChange={e => setNewLead({ ...newLead, source: e.target.value })}
                >
                  <option value="">Source</option>
                  <option value="LinkedIn">LinkedIn</option>
                  <option value="Referral">Referral</option>
                  <option value="Cold Outreach">Cold Outreach</option>
                  <option value="Website">Website</option>
                  <option value="Twitter">Twitter</option>
                  <option value="Upwork">Upwork</option>
                  <option value="Community">Community</option>
                  <option value="Other">Other</option>
                </select>
                <input
                  type="number"
                  className="input"
                  placeholder="Deal Value (₹)"
                  value={newLead.estimatedDealValue}
                  onChange={e => setNewLead({ ...newLead, estimatedDealValue: e.target.value })}
                />
                <input
                  type="number"
                  className="input"
                  placeholder="Probability %"
                  min="0" max="100"
                  value={newLead.dealProbability}
                  onChange={e => setNewLead({ ...newLead, dealProbability: e.target.value })}
                />
              </div>
              <input
                type="text"
                className="input"
                placeholder="Problem Statement"
                value={newLead.problemStatement}
                onChange={e => setNewLead({ ...newLead, problemStatement: e.target.value })}
              />
              <input
                type="text"
                className="input"
                placeholder="Proposed Service"
                value={newLead.proposedService}
                onChange={e => setNewLead({ ...newLead, proposedService: e.target.value })}
              />
              <textarea
                className="input"
                placeholder="Notes"
                rows={2}
                value={newLead.notes}
                onChange={e => setNewLead({ ...newLead, notes: e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddLead}>Add Lead</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
