// ============================================================================
// PERSONAL OS — Client & Project Manager
// Client directory with lifetime revenue tracking and project tracker.
// ============================================================================

import { useState } from 'react';
import {
  Plus, Building2, FolderOpen, X, Trash2, Edit3, CheckCircle2,
} from 'lucide-react';
import { useStore, logEvent } from '../../hooks/useDatabase';
import { STORES } from '../../services/db';
import type { AgencyClient, AgencyProject, AgencyInvoice, ClientStatus, ProjectStatus, BillingType } from '../../types';
import { generateId, now, formatINR, timeAgo, formatDate } from '../../utils/helpers';
import { showToast } from '../Toast';

interface ClientProjectManagerProps {
  clients: AgencyClient[];
  projects: AgencyProject[];
  invoices: AgencyInvoice[];
}

const STATUS_COLORS: Record<ClientStatus, string> = {
  LEAD: '#64748b',
  ACTIVE: '#22c55e',
  CHURNED: '#ef4444',
  PAST: '#a1a1aa',
};

const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  PROPOSAL: '#f59e0b',
  ACTIVE: '#3b82f6',
  DELIVERED: '#8b5cf6',
  PAID: '#22c55e',
  ON_HOLD: '#a1a1aa',
  CANCELLED: '#ef4444',
};

export function ClientProjectManager({ clients, projects, invoices }: ClientProjectManagerProps) {
  const clientStore = useStore<AgencyClient>(STORES.AGENCY_CLIENTS);
  const projectStore = useStore<AgencyProject>(STORES.AGENCY_PROJECTS);
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddProject, setShowAddProject] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  // Client form
  const [clientForm, setClientForm] = useState({
    name: '', company: '', contactPerson: '', email: '', phone: '',
    industry: '', acquisitionChannel: '', billingType: 'FIXED_PROJECT' as BillingType,
    icpScore: '50', notes: '',
  });

  // Project form
  const [projectForm, setProjectForm] = useState({
    clientId: '', name: '', description: '', agreedAmount: '', currency: 'INR',
    startDate: new Date().toISOString().split('T')[0], deadline: '', notes: '',
  });

  const handleAddClient = async () => {
    if (!clientForm.name.trim()) {
      showToast('Client name is required', 'error');
      return;
    }
    const client: AgencyClient = {
      id: generateId('client'),
      name: clientForm.name.trim(),
      company: clientForm.company || undefined,
      contactPerson: clientForm.contactPerson || undefined,
      email: clientForm.email || undefined,
      phone: clientForm.phone || undefined,
      industry: clientForm.industry || undefined,
      acquisitionChannel: clientForm.acquisitionChannel || 'Direct',
      billingType: clientForm.billingType,
      icpScore: Number(clientForm.icpScore) || 50,
      status: 'ACTIVE',
      lifetimeRevenue: 0,
      startDate: now(),
      notes: clientForm.notes || undefined,
      createdAt: now(),
      updatedAt: now(),
    };
    await clientStore.add(client);
    await logEvent('agency', 'AGENCY_CLIENT_ADDED', {
      entityRefType: 'AgencyClient',
      entityRefId: client.id,
      metadata: { name: client.name, channel: client.acquisitionChannel },
    });
    showToast(`Client added: ${client.name}`, 'success');
    setShowAddClient(false);
    setClientForm({ name: '', company: '', contactPerson: '', email: '', phone: '', industry: '', acquisitionChannel: '', billingType: 'FIXED_PROJECT', icpScore: '50', notes: '' });
  };

  const handleAddProject = async () => {
    if (!projectForm.name.trim() || !projectForm.clientId) {
      showToast('Project name and client are required', 'error');
      return;
    }
    const project: AgencyProject = {
      id: generateId('proj'),
      clientId: projectForm.clientId,
      name: projectForm.name.trim(),
      description: projectForm.description || undefined,
      startDate: projectForm.startDate || now(),
      deadline: projectForm.deadline || undefined,
      status: 'ACTIVE',
      agreedAmount: Number(projectForm.agreedAmount) || 0,
      receivedAmount: 0,
      currency: projectForm.currency || 'INR',
      hoursSpent: 0,
      notes: projectForm.notes || undefined,
      createdAt: now(),
      updatedAt: now(),
    };
    await projectStore.add(project);
    await logEvent('agency', 'AGENCY_PROJECT_CREATED', {
      entityRefType: 'AgencyProject',
      entityRefId: project.id,
      metadata: {
        name: project.name,
        client: clients.find(c => c.id === project.clientId)?.name,
        agreedAmount: project.agreedAmount,
      },
    });
    showToast(`Project created: ${project.name}`, 'success');
    setShowAddProject(false);
    setProjectForm({ clientId: '', name: '', description: '', agreedAmount: '', currency: 'INR', startDate: new Date().toISOString().split('T')[0], deadline: '', notes: '' });
  };

  const handleDeleteClient = async (client: AgencyClient) => {
    await clientStore.remove(client.id);
    showToast(`Client deleted: ${client.name}`, 'success');
  };

  const handleProjectStatusChange = async (project: AgencyProject, newStatus: ProjectStatus) => {
    const updated = { ...project, status: newStatus, updatedAt: now() };
    if (newStatus === 'DELIVERED') updated.completedDate = now();
    await projectStore.update(updated);
    await logEvent('agency', `AGENCY_PROJECT_${newStatus}`, {
      entityRefType: 'AgencyProject',
      entityRefId: project.id,
      metadata: { name: project.name, from: project.status, to: newStatus },
    });
    showToast(`${project.name} → ${newStatus}`, 'success');
  };

  // Client revenue calculation from invoices
  const getClientRevenue = (clientId: string) => {
    return invoices
      .filter(inv => inv.clientId === clientId && inv.status === 'PAID')
      .reduce((sum, inv) => sum + inv.amount, 0);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* CLIENTS SECTION */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Building2 size={20} style={{ color: '#8b5cf6' }} />
            Client Directory
            <span style={{
              fontSize: '11px', padding: '2px 8px', borderRadius: 8,
              background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e',
            }}>
              {clients.filter(c => c.status === 'ACTIVE').length} active
            </span>
          </h3>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddClient(true)}>
            <Plus size={14} /> New Client
          </button>
        </div>

        {clients.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 20px' }}>
            <Building2 size={32} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
            <div className="empty-state-title">No clients yet</div>
            <div className="empty-state-text">Win your first lead or add a client manually.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {[...clients].sort((a, b) => {
              if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
              if (b.status === 'ACTIVE' && a.status !== 'ACTIVE') return 1;
              return b.updatedAt.localeCompare(a.updatedAt);
            }).map(client => {
              const revenue = getClientRevenue(client.id);
              const clientProjects = projects.filter(p => p.clientId === client.id);
              const statusColor = STATUS_COLORS[client.status];

              return (
                <div key={client.id} style={{
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-subtle)',
                  border: `1px solid ${statusColor}30`,
                  cursor: 'pointer',
                }}
                  onClick={() => setSelectedClientId(selectedClientId === client.id ? null : client.id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>{client.name}</div>
                      {client.company && (
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{client.company}</div>
                      )}
                    </div>
                    <span style={{
                      fontSize: '10px', padding: '2px 8px', borderRadius: 8, fontWeight: 600,
                      background: `${statusColor}20`, color: statusColor,
                    }}>
                      {client.status}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                    <div style={{ color: 'var(--text-muted)' }}>
                      {clientProjects.length} project{clientProjects.length !== 1 ? 's' : ''} •{' '}
                      {client.billingType?.replace('_', ' ') || 'Fixed'}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', color: '#22c55e', fontWeight: 600 }}>
                      {formatINR(revenue)}
                    </div>
                  </div>

                  {/* Expanded: show projects */}
                  {selectedClientId === client.id && (
                    <div style={{
                      marginTop: 12, paddingTop: 12,
                      borderTop: '1px solid var(--border-subtle)',
                    }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: 8 }}>Projects:</div>
                      {clientProjects.length === 0 ? (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No projects yet</div>
                      ) : (
                        clientProjects.map(proj => (
                          <div key={proj.id} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '6px 8px', borderRadius: 'var(--radius-sm)',
                            background: 'var(--bg-primary)', marginBottom: 4, fontSize: '11px',
                          }}>
                            <div>
                              <span style={{ fontWeight: 600 }}>{proj.name}</span>
                              <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>
                                {formatINR(proj.agreedAmount)}
                              </span>
                            </div>
                            <span style={{
                              fontSize: '10px', padding: '1px 6px', borderRadius: 6,
                              background: `${PROJECT_STATUS_COLORS[proj.status]}20`,
                              color: PROJECT_STATUS_COLORS[proj.status],
                              fontWeight: 600,
                            }}>
                              {proj.status}
                            </span>
                          </div>
                        ))
                      )}
                      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                        <button className="btn btn-sm" style={{ fontSize: '10px' }} onClick={(e) => {
                          e.stopPropagation();
                          setProjectForm(f => ({ ...f, clientId: client.id }));
                          setShowAddProject(true);
                        }}>
                          <Plus size={10} /> Add Project
                        </button>
                        <button className="btn btn-sm" style={{ fontSize: '10px', color: '#ef4444' }} onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClient(client);
                        }}>
                          <Trash2 size={10} /> Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* PROJECTS SECTION */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FolderOpen size={20} style={{ color: '#3b82f6' }} />
            All Projects
          </h3>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddProject(true)}>
            <Plus size={14} /> New Project
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px 20px' }}>
            <FolderOpen size={32} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
            <div className="empty-state-title">No projects yet</div>
            <div className="empty-state-text">Create a project for one of your clients.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  {['Project', 'Client', 'Status', 'Agreed Value', 'Received', 'Hours', 'Deadline', 'Actions'].map(h => (
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
                {[...projects].sort((a, b) => {
                  const statusOrder = ['ACTIVE', 'PROPOSAL', 'DELIVERED', 'PAID', 'ON_HOLD', 'CANCELLED'];
                  return statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
                }).map(proj => {
                  const client = clients.find(c => c.id === proj.clientId);
                  const statusColor = PROJECT_STATUS_COLORS[proj.status];

                  return (
                    <tr key={proj.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{proj.name}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{client?.name || '—'}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          fontSize: '10px', padding: '2px 8px', borderRadius: 8, fontWeight: 600,
                          background: `${statusColor}20`, color: statusColor,
                        }}>
                          {proj.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)' }}>
                        {formatINR(proj.agreedAmount)}
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', color: '#22c55e' }}>
                        {formatINR(proj.receivedAmount)}
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                        {proj.hoursSpent}h
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: '11px' }}>
                        {proj.deadline ? formatDate(proj.deadline) : '—'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {proj.status === 'ACTIVE' && (
                            <button
                              className="btn btn-sm"
                              style={{ padding: '3px 8px', fontSize: '10px' }}
                              onClick={() => handleProjectStatusChange(proj, 'DELIVERED')}
                            >
                              <CheckCircle2 size={10} /> Deliver
                            </button>
                          )}
                          {proj.status === 'DELIVERED' && (
                            <button
                              className="btn btn-sm"
                              style={{ padding: '3px 8px', fontSize: '10px', color: '#22c55e' }}
                              onClick={() => handleProjectStatusChange(proj, 'PAID')}
                            >
                              Mark Paid
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

      {/* Add Client Modal */}
      {showAddClient && (
        <div className="modal-backdrop" onClick={() => setShowAddClient(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 'var(--text-lg)' }}>Add New Client</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input type="text" className="input" placeholder="Client Name *" value={clientForm.name}
                onChange={e => setClientForm({ ...clientForm, name: e.target.value })} autoFocus />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input type="text" className="input" placeholder="Company" value={clientForm.company}
                  onChange={e => setClientForm({ ...clientForm, company: e.target.value })} />
                <input type="text" className="input" placeholder="Contact Person" value={clientForm.contactPerson}
                  onChange={e => setClientForm({ ...clientForm, contactPerson: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input type="email" className="input" placeholder="Email" value={clientForm.email}
                  onChange={e => setClientForm({ ...clientForm, email: e.target.value })} />
                <input type="tel" className="input" placeholder="Phone" value={clientForm.phone}
                  onChange={e => setClientForm({ ...clientForm, phone: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <select className="input" value={clientForm.billingType}
                  onChange={e => setClientForm({ ...clientForm, billingType: e.target.value as BillingType })}>
                  <option value="FIXED_PROJECT">Fixed Project</option>
                  <option value="RETAINER">Retainer</option>
                  <option value="HOURLY">Hourly</option>
                </select>
                <select className="input" value={clientForm.acquisitionChannel}
                  onChange={e => setClientForm({ ...clientForm, acquisitionChannel: e.target.value })}>
                  <option value="">Acquisition Channel</option>
                  <option value="Referral">Referral</option>
                  <option value="LinkedIn">LinkedIn</option>
                  <option value="Cold Outreach">Cold Outreach</option>
                  <option value="Community">Community</option>
                  <option value="Direct">Direct</option>
                </select>
                <input type="number" className="input" placeholder="ICP Score (1-100)" min="1" max="100"
                  value={clientForm.icpScore}
                  onChange={e => setClientForm({ ...clientForm, icpScore: e.target.value })} />
              </div>
              <textarea className="input" placeholder="Notes" rows={2} value={clientForm.notes}
                onChange={e => setClientForm({ ...clientForm, notes: e.target.value })} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => setShowAddClient(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddClient}>Add Client</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Project Modal */}
      {showAddProject && (
        <div className="modal-backdrop" onClick={() => setShowAddProject(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 'var(--text-lg)' }}>Create New Project</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <select className="input" value={projectForm.clientId}
                onChange={e => setProjectForm({ ...projectForm, clientId: e.target.value })}>
                <option value="">Select Client *</option>
                {clients.filter(c => c.status === 'ACTIVE').map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <input type="text" className="input" placeholder="Project Name *" value={projectForm.name}
                onChange={e => setProjectForm({ ...projectForm, name: e.target.value })} />
              <input type="text" className="input" placeholder="Description" value={projectForm.description}
                onChange={e => setProjectForm({ ...projectForm, description: e.target.value })} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input type="number" className="input" placeholder="Agreed Amount (₹)" value={projectForm.agreedAmount}
                  onChange={e => setProjectForm({ ...projectForm, agreedAmount: e.target.value })} />
                <input type="date" className="input" value={projectForm.deadline}
                  onChange={e => setProjectForm({ ...projectForm, deadline: e.target.value })} />
              </div>
              <textarea className="input" placeholder="Notes" rows={2} value={projectForm.notes}
                onChange={e => setProjectForm({ ...projectForm, notes: e.target.value })} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => setShowAddProject(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddProject}>Create Project</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
