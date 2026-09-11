// ============================================================================
// PERSONAL OS — Invoice Manager (Financial Cashflow Center)
// Strict Cash vs Billed vs Receivables display. 1-tap Mark Paid.
// ============================================================================

import { useState } from 'react';
import {
  Plus, DollarSign, CreditCard, Clock, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { useStore, logEvent } from '../../hooks/useDatabase';
import { STORES } from '../../services/db';
import type { AgencyInvoice, AgencyClient, AgencyProject, InvoiceStatus } from '../../types';
import { generateId, now, formatINR, formatDate } from '../../utils/helpers';
import { showToast } from '../Toast';
import type { AgencyKpiSummary } from '../../services/agencyKpi';

interface InvoiceManagerProps {
  invoices: AgencyInvoice[];
  clients: AgencyClient[];
  projects: AgencyProject[];
  kpis: AgencyKpiSummary | null;
}

const STATUS_ICON: Record<InvoiceStatus, { icon: typeof DollarSign; color: string }> = {
  DRAFT: { icon: Clock, color: '#a1a1aa' },
  SENT: { icon: CreditCard, color: '#3b82f6' },
  OVERDUE: { icon: AlertTriangle, color: '#ef4444' },
  PAID: { icon: CheckCircle2, color: '#22c55e' },
};

export function InvoiceManager({ invoices, clients, projects, kpis }: InvoiceManagerProps) {
  const { add, update } = useStore<AgencyInvoice>(STORES.AGENCY_INVOICES);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form state
  const [form, setForm] = useState({
    clientId: '', projectId: '', amount: '', dueDate: '',
    notes: '', paymentMethod: '',
  });

  // Generate next invoice number
  const getNextInvoiceNumber = (): string => {
    const existing = invoices.map(inv => {
      const match = inv.invoiceNumber.match(/(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    });
    const max = existing.length > 0 ? Math.max(...existing) : 0;
    return `INV-${String(max + 1).padStart(3, '0')}`;
  };

  const handleAddInvoice = async () => {
    if (!form.clientId || !form.amount) {
      showToast('Client and amount are required', 'error');
      return;
    }
    const invoice: AgencyInvoice = {
      id: generateId('inv'),
      invoiceNumber: getNextInvoiceNumber(),
      clientId: form.clientId,
      projectId: form.projectId || '',
      amount: Number(form.amount),
      currency: 'INR',
      status: 'SENT',
      issuedAt: now(),
      dueDate: form.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: form.notes || undefined,
      paymentMethod: form.paymentMethod || undefined,
      createdAt: now(),
      updatedAt: now(),
    };
    await add(invoice);
    await logEvent('agency', 'AGENCY_INVOICE_CREATED', {
      entityRefType: 'AgencyInvoice',
      entityRefId: invoice.id,
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        client: clients.find(c => c.id === invoice.clientId)?.name,
        amount: invoice.amount,
      },
    });
    showToast(`Invoice ${invoice.invoiceNumber} created for ${formatINR(invoice.amount)}`, 'success');
    setShowAddModal(false);
    setForm({ clientId: '', projectId: '', amount: '', dueDate: '', notes: '', paymentMethod: '' });
  };

  const handleMarkPaid = async (invoice: AgencyInvoice) => {
    const updated: AgencyInvoice = {
      ...invoice,
      status: 'PAID',
      paidAt: now(),
      updatedAt: now(),
    };
    await update(updated);
    await logEvent('agency', 'AGENCY_INVOICE_PAID', {
      entityRefType: 'AgencyInvoice',
      entityRefId: invoice.id,
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        client: clients.find(c => c.id === invoice.clientId)?.name,
        amount: invoice.amount,
      },
    });
    showToast(`${invoice.invoiceNumber} marked as PAID — ${formatINR(invoice.amount)} collected`, 'success');
  };

  const handleMarkOverdue = async (invoice: AgencyInvoice) => {
    const updated: AgencyInvoice = { ...invoice, status: 'OVERDUE', updatedAt: now() };
    await update(updated);
    showToast(`${invoice.invoiceNumber} marked as OVERDUE`, 'success');
  };

  // Available projects for selected client
  const clientProjects = form.clientId
    ? projects.filter(p => p.clientId === form.clientId)
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* FINANCIAL KPI CARDS */}
      {kpis && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {/* Realized Cash */}
          <div className="card" style={{
            padding: '16px', background: 'rgba(34, 197, 94, 0.08)',
            border: '1px solid rgba(34, 197, 94, 0.2)',
          }}>
            <div style={{ fontSize: '11px', color: '#22c55e', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              💰 Realized Cash (In Bank)
            </div>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#22c55e' }}>
              {formatINR(kpis.realizedCash)}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 2 }}>
              {kpis.paidInvoices} paid invoice{kpis.paidInvoices !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Accounts Receivable */}
          <div className="card" style={{
            padding: '16px', background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.2)',
          }}>
            <div style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              ⏳ Accounts Receivable
            </div>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#f59e0b' }}>
              {formatINR(kpis.accountsReceivable)}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 2 }}>
              {kpis.sentInvoices + kpis.overdueInvoices} outstanding ({kpis.overdueInvoices} overdue)
            </div>
          </div>

          {/* Total Billed */}
          <div className="card" style={{
            padding: '16px', background: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
          }}>
            <div style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              📊 Total Billed
            </div>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#3b82f6' }}>
              {formatINR(kpis.billedRevenue)}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 2 }}>
              {kpis.totalInvoices} total invoice{kpis.totalInvoices !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      )}

      {/* INVOICE LIST */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <CreditCard size={20} style={{ color: '#8b5cf6' }} />
            Invoices
          </h3>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
            <Plus size={14} /> Create Invoice
          </button>
        </div>

        {invoices.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 20px' }}>
            <CreditCard size={32} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
            <div className="empty-state-title">No invoices yet</div>
            <div className="empty-state-text">Create your first invoice to start tracking cashflow.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  {['Invoice #', 'Client', 'Project', 'Amount', 'Due Date', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{
                      padding: '10px 12px', textAlign: 'left', fontSize: '11px',
                      color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...invoices].sort((a, b) => {
                  const statusOrder = ['OVERDUE', 'SENT', 'DRAFT', 'PAID'];
                  return statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
                }).map(inv => {
                  const client = clients.find(c => c.id === inv.clientId);
                  const project = projects.find(p => p.id === inv.projectId);
                  const statusInfo = STATUS_ICON[inv.status];
                  const StatusIcon = statusInfo.icon;

                  return (
                    <tr key={inv.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                        {inv.invoiceNumber}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                        {client?.name || '—'}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                        {project?.name || '—'}
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {formatINR(inv.amount)}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: '11px' }}>
                        {formatDate(inv.dueDate)}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: '10px', padding: '2px 8px', borderRadius: 8, fontWeight: 600,
                          background: `${statusInfo.color}20`, color: statusInfo.color,
                        }}>
                          <StatusIcon size={10} />
                          {inv.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {(inv.status === 'SENT' || inv.status === 'OVERDUE') && (
                            <button
                              className="btn btn-sm"
                              style={{ padding: '3px 8px', fontSize: '10px', color: '#22c55e', gap: 4 }}
                              onClick={() => handleMarkPaid(inv)}
                            >
                              <CheckCircle2 size={10} /> Mark Paid
                            </button>
                          )}
                          {inv.status === 'SENT' && (
                            <button
                              className="btn btn-sm"
                              style={{ padding: '3px 8px', fontSize: '10px', color: '#ef4444', gap: 4 }}
                              onClick={() => handleMarkOverdue(inv)}
                            >
                              <AlertTriangle size={10} /> Overdue
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Invoice Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 'var(--text-lg)' }}>
              Create Invoice — {getNextInvoiceNumber()}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <select className="input" value={form.clientId}
                onChange={e => setForm({ ...form, clientId: e.target.value, projectId: '' })}>
                <option value="">Select Client *</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {form.clientId && clientProjects.length > 0 && (
                <select className="input" value={form.projectId}
                  onChange={e => setForm({ ...form, projectId: e.target.value })}>
                  <option value="">Select Project (optional)</option>
                  {clientProjects.map(p => (
                    <option key={p.id} value={p.id}>{p.name} — {formatINR(p.agreedAmount)}</option>
                  ))}
                </select>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input type="number" className="input" placeholder="Amount (₹) *" value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })} />
                <input type="date" className="input" placeholder="Due Date"
                  value={form.dueDate}
                  onChange={e => setForm({ ...form, dueDate: e.target.value })} />
              </div>
              <select className="input" value={form.paymentMethod}
                onChange={e => setForm({ ...form, paymentMethod: e.target.value })}>
                <option value="">Payment Method</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="UPI">UPI</option>
                <option value="PayPal">PayPal</option>
                <option value="Wise">Wise</option>
                <option value="Crypto">Crypto</option>
                <option value="Cash">Cash</option>
              </select>
              <textarea className="input" placeholder="Notes" rows={2} value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddInvoice}>Create Invoice</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
