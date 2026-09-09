// ============================================================================
// PERSONAL OS — VOIRE Marketing & Growth Tab
// Distribution channels, paid ad campaigns, spend tracking, CTR/CVR/ROAS analytics.
// ============================================================================

import { useState } from 'react';
import { Megaphone, Plus, Trash2, Edit2, TrendingUp, DollarSign } from 'lucide-react';
import type {
  VoireMarketingCampaign,
  VoireMarketingChannel,
  VoireMarketingStatus,
  VoireDrop,
  VoireOrder,
} from '../../types/pillars';
import { dbPut, dbDelete, STORES } from '../../services/db';
import { logEvent, notifyDataChange } from '../../hooks/useDatabase';
import { showToast } from '../Toast';
import { formatINR } from '../../utils/helpers';

interface VoireMarketingTabProps {
  campaigns: VoireMarketingCampaign[];
  drops: VoireDrop[];
  orders: VoireOrder[];
}

export function VoireMarketingTab({ campaigns, drops, orders }: VoireMarketingTabProps) {
  const [showModal, setShowModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<VoireMarketingCampaign | null>(null);

  const [name, setName] = useState('');
  const [channel, setChannel] = useState<VoireMarketingChannel>('META_ADS');
  const [campaignType, setCampaignType] = useState<'PAID_ACQUISITION' | 'INFLUENCER_SEEDING' | 'ORGANIC_CONTENT' | 'EMAIL_SMS' | 'COMMUNITY'>('PAID_ACQUISITION');
  const [status, setStatus] = useState<VoireMarketingStatus>('ACTIVE');
  const [spendAmount, setSpendAmount] = useState<number | ''>('');
  const [impressions, setImpressions] = useState<number | ''>('');
  const [clicks, setClicks] = useState<number | ''>('');
  const [conversions, setConversions] = useState<number | ''>('');
  const [dropId, setDropId] = useState('');
  const [notes, setNotes] = useState('');

  const openCreateModal = () => {
    setEditingCampaign(null);
    setName('');
    setChannel('META_ADS');
    setCampaignType('PAID_ACQUISITION');
    setStatus('ACTIVE');
    setSpendAmount('');
    setImpressions('');
    setClicks('');
    setConversions('');
    setDropId('');
    setNotes('');
    setShowModal(true);
  };

  const openEditModal = (camp: VoireMarketingCampaign) => {
    setEditingCampaign(camp);
    setName(camp.name);
    setChannel(camp.channel);
    setCampaignType(camp.campaignType);
    setStatus(camp.status);
    setSpendAmount(camp.spendAmount);
    setImpressions(camp.impressions ?? '');
    setClicks(camp.clicks ?? '');
    setConversions(camp.conversions ?? '');
    setDropId(camp.dropId || '');
    setNotes(camp.notes || '');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Campaign name is required', 'warning');
      return;
    }

    const now = new Date().toISOString();
    const campaignId = editingCampaign ? editingCampaign.id : `vm_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const spend = Number(spendAmount) || 0;

    const campaignRecord: VoireMarketingCampaign = {
      id: campaignId,
      name: name.trim(),
      channel,
      campaignType,
      status,
      spendAmount: spend,
      impressions: typeof impressions === 'number' ? impressions : undefined,
      clicks: typeof clicks === 'number' ? clicks : undefined,
      conversions: typeof conversions === 'number' ? conversions : undefined,
      dropId: dropId || undefined,
      notes: notes.trim() || undefined,
      createdAt: editingCampaign ? editingCampaign.createdAt : now,
      updatedAt: now,
    };

    await dbPut(STORES.VOIRE_MARKETING, campaignRecord);

    // Activity Event Emission
    await logEvent({
      pillarId: 'voire',
      eventType: editingCampaign ? 'VOIRE_CAMPAIGN_UPDATED' : 'VOIRE_CAMPAIGN_CREATED',
      entityRef: {
        type: 'VoireMarketingCampaign',
        id: campaignId,
      },
      metadata: { channel, spendAmount: spend, status, name },
    });

    notifyDataChange(STORES.VOIRE_MARKETING);
    showToast(editingCampaign ? 'Campaign updated' : 'Marketing campaign launched', 'success');
    setShowModal(false);
  };

  const handleDelete = async (id: string, campName: string) => {
    if (!window.confirm(`Delete campaign "${campName}"?`)) return;
    await dbDelete(STORES.VOIRE_MARKETING, id);
    notifyDataChange(STORES.VOIRE_MARKETING);
    showToast('Campaign deleted', 'info');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f9fafb', margin: 0 }}>Marketing & Distribution</h2>
          <p style={{ fontSize: '0.875rem', color: '#9ca3af', margin: '0.25rem 0 0 0' }}>
            Paid ad sets, organic distribution, customer acquisition cost, and blended ROAS.
          </p>
        </div>
        <button className="voire-btn-primary" onClick={openCreateModal}>
          <Plus size={16} /> New Campaign
        </button>
      </div>

      {campaigns.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '0.75rem', border: '1px dashed rgba(255,255,255,0.1)' }}>
          <Megaphone size={40} style={{ color: '#a855f7', opacity: 0.6, margin: '0 auto 1rem' }} />
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#f3f4f6', marginBottom: '0.5rem' }}>No Marketing Campaigns</h3>
          <p style={{ fontSize: '0.875rem', color: '#9ca3af', maxWidth: '24rem', margin: '0 auto 1.5rem' }}>
            Track ad spend across Meta, Instagram, or creator seeding to calculate CAC and contribution profit.
          </p>
          <button className="voire-btn-primary" onClick={openCreateModal}>
            <Plus size={16} /> Create First Campaign
          </button>
        </div>
      ) : (
        <div className="voire-table-wrapper">
          <table className="voire-table">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Channel</th>
                <th>Spend</th>
                <th>Impressions</th>
                <th>Clicks (CTR)</th>
                <th>Conversions (CVR)</th>
                <th>Attributed ROAS</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((camp) => {
                const imps = camp.impressions || 0;
                const clks = camp.clicks || 0;
                const convs = camp.conversions || 0;
                const ctr = imps > 0 ? (clks / imps) * 100 : 0;
                const cvr = clks > 0 ? (convs / clks) * 100 : 0;

                // Attributed revenue from orders
                const attributedRevenue = orders
                  .filter((o) => o.attributedCampaignId === camp.id && (o.paymentStatus === 'PAID' || o.paymentStatus === 'PENDING'))
                  .reduce((sum, o) => sum + (o.totalAmount - (o.refundAmount || 0)), 0);
                const roas = camp.spendAmount > 0 ? attributedRevenue / camp.spendAmount : 0;

                return (
                  <tr key={camp.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#ffffff' }}>{camp.name}</div>
                      {camp.notes && <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{camp.notes}</div>}
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8125rem', color: '#c084fc', fontWeight: 500 }}>
                        {camp.channel.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, color: '#f87171' }}>{formatINR(camp.spendAmount)}</td>
                    <td style={{ color: '#9ca3af' }}>{imps.toLocaleString()}</td>
                    <td>
                      <div>{clks.toLocaleString()}</div>
                      <div style={{ fontSize: '0.75rem', color: '#a855f7' }}>{ctr.toFixed(2)}% CTR</div>
                    </td>
                    <td>
                      <div>{convs}</div>
                      <div style={{ fontSize: '0.75rem', color: '#34d399' }}>{cvr.toFixed(2)}% CVR</div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: roas >= 2.5 ? '#34d399' : roas >= 1.0 ? '#fbbf24' : '#f87171' }}>
                        {roas > 0 ? `${roas.toFixed(2)}x` : '—'}
                      </span>
                    </td>
                    <td>
                      <span className={`voire-badge ${camp.status.toLowerCase()}`}>
                        {camp.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="voire-btn-secondary" style={{ padding: '0.375rem 0.5rem' }} onClick={() => openEditModal(camp)}>
                          <Edit2 size={14} />
                        </button>
                        <button className="voire-btn-danger" onClick={() => handleDelete(camp.id, camp.name)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="voire-modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="voire-modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f9fafb', marginBottom: '1.25rem' }}>
              {editingCampaign ? 'Edit Marketing Campaign' : 'New Marketing Campaign'}
            </h3>
            <form onSubmit={handleSave}>
              <div className="voire-form-group">
                <label className="voire-form-label">Campaign Name *</label>
                <input
                  type="text"
                  className="voire-form-input"
                  placeholder="e.g. IG Reels Top-of-Funnel Drop 01"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="voire-form-group">
                  <label className="voire-form-label">Channel</label>
                  <select
                    className="voire-form-select"
                    value={channel}
                    onChange={(e) => setChannel(e.target.value as VoireMarketingChannel)}
                  >
                    <option value="META_ADS">META ADS (IG / FB)</option>
                    <option value="TIKTOK_ADS">TIKTOK ADS</option>
                    <option value="GOOGLE_ADS">GOOGLE SEARCH / SHOPPING</option>
                    <option value="INFLUENCER">INFLUENCER / SEEDING</option>
                    <option value="EMAIL_MARKETING">EMAIL / SMS</option>
                    <option value="COMMUNITY">DISCORD / COMMUNITY</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </div>

                <div className="voire-form-group">
                  <label className="voire-form-label">Status</label>
                  <select
                    className="voire-form-select"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as VoireMarketingStatus)}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="DRAFT">DRAFT</option>
                    <option value="PAUSED">PAUSED</option>
                    <option value="COMPLETED">COMPLETED</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="voire-form-group">
                  <label className="voire-form-label">Spend Committed (₹) *</label>
                  <input
                    type="number"
                    className="voire-form-input"
                    placeholder="e.g. 5000"
                    value={spendAmount}
                    onChange={(e) => setSpendAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    required
                  />
                </div>

                <div className="voire-form-group">
                  <label className="voire-form-label">Impressions</label>
                  <input
                    type="number"
                    className="voire-form-input"
                    placeholder="e.g. 45000"
                    value={impressions}
                    onChange={(e) => setImpressions(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="voire-form-group">
                  <label className="voire-form-label">Link Clicks</label>
                  <input
                    type="number"
                    className="voire-form-input"
                    placeholder="e.g. 950"
                    value={clicks}
                    onChange={(e) => setClicks(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>

                <div className="voire-form-group">
                  <label className="voire-form-label">Conversions / Purchases</label>
                  <input
                    type="number"
                    className="voire-form-input"
                    placeholder="e.g. 18"
                    value={conversions}
                    onChange={(e) => setConversions(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="voire-form-group">
                <label className="voire-form-label">Associated Drop</label>
                <select
                  className="voire-form-select"
                  value={dropId}
                  onChange={(e) => setDropId(e.target.value)}
                >
                  <option value="">None (General Brand Campaign)</option>
                  {drops.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="voire-form-group">
                <label className="voire-form-label">Creative Notes & Angles</label>
                <textarea
                  rows={2}
                  className="voire-form-textarea"
                  placeholder="Hook: 'Stop buying cheap blanks', UGC unboxing format..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="voire-btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="voire-btn-primary">
                  {editingCampaign ? 'Save Campaign' : 'Launch Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
