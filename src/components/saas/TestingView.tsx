// ============================================================================
// PERSONAL OS — SaaS Testing View
// Quality console for tracking test runs, results, and feature pass rates.
// ============================================================================

import { useState } from 'react';
import {
  Plus, CheckCircle, XCircle, AlertTriangle, ShieldCheck,
  Filter, Trash2, X, Clock,
} from 'lucide-react';
import { useStore, logEvent } from '../../hooks/useDatabase';
import { STORES } from '../../services/db';
import type { SaasTestRun, SaasFeature, TestResult } from '../../types';
import { generateId, now, formatDate, formatSafePercent } from '../../utils/helpers';
import { showToast } from '../Toast';

interface TestingViewProps {
  tests: SaasTestRun[];
  features: SaasFeature[];
}

const RESULT_STYLES: Record<TestResult, { color: string; bg: string; icon: typeof CheckCircle; label: string }> = {
  PASS: { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.12)', icon: CheckCircle, label: 'Pass' },
  FAIL: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', icon: XCircle, label: 'Fail' },
  BLOCKED: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', icon: AlertTriangle, label: 'Blocked' },
};

export function TestingView({ tests, features }: TestingViewProps) {
  const { add, remove } = useStore<SaasTestRun>(STORES.SAAS_TEST_RUNS);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterResult, setFilterResult] = useState<string>('ALL');

  // Form state
  const [form, setForm] = useState({
    featureId: '',
    testType: 'Integration',
    result: 'PASS' as TestResult,
    notes: '',
  });

  const handleCreateTest = async () => {
    if (!form.featureId) {
      showToast('Select a feature to associate this test run with', 'error');
      return;
    }

    const matchedFeature = features.find((f) => f.id === form.featureId);

    const testRun: SaasTestRun = {
      id: generateId('test'),
      featureId: form.featureId,
      testType: form.testType,
      result: form.result,
      notes: form.notes.trim() || undefined,
      executedAt: now(),
      createdAt: now(),
    };

    await add(testRun);
    await logEvent('trading_os', 'SAAS_TEST_RUN', {
      entityRefType: 'SaasTestRun',
      entityRefId: testRun.id,
      metadata: {
        featureId: testRun.featureId,
        featureName: matchedFeature?.name || 'Unknown',
        testType: testRun.testType,
        result: testRun.result,
      },
    });

    showToast(`Test run recorded: ${testRun.result} (${testRun.testType})`, 'success');
    setShowAddModal(false);
    setForm({ featureId: '', testType: 'Integration', result: 'PASS', notes: '' });
  };

  const handleDelete = async (test: SaasTestRun) => {
    if (confirm('Delete this test run?')) {
      await remove(test.id);
      showToast('Test run deleted', 'info');
    }
  };

  // Metrics
  const total = tests.length;
  const passCount = tests.filter((t) => t.result === 'PASS').length;
  const failCount = tests.filter((t) => t.result === 'FAIL').length;
  const blockedCount = tests.filter((t) => t.result === 'BLOCKED').length;
  const passRate = total > 0 ? (passCount / total) * 100 : null;

  const filteredTests = tests.filter((t) => {
    if (filterResult !== 'ALL' && t.result !== filterResult) return false;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPI METRIC CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <div className="card" style={{ padding: '12px 14px', background: 'rgba(34, 197, 94, 0.05)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: 2 }}>Pass Rate</div>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#22c55e' }}>
            {formatSafePercent(passRate)}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
            {passCount} of {total} runs
          </div>
        </div>

        <div className="card" style={{ padding: '12px 14px', background: 'rgba(239, 68, 68, 0.05)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: 2 }}>Failing Tests</div>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: failCount > 0 ? '#ef4444' : 'var(--text-muted)' }}>
            {failCount}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
            Requires attention
          </div>
        </div>

        <div className="card" style={{ padding: '12px 14px', background: 'rgba(245, 158, 11, 0.05)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: 2 }}>Blocked Tests</div>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: blockedCount > 0 ? '#f59e0b' : 'var(--text-muted)' }}>
            {blockedCount}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
            Waiting on fixes/deps
          </div>
        </div>

        <div className="card" style={{ padding: '12px 14px', background: 'rgba(255, 255, 255, 0.02)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: 2 }}>Total Test Runs</div>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
            {total}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
            Across all features
          </div>
        </div>
      </div>

      {/* TOOLBAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Filter size={14} style={{ color: 'var(--text-muted)' }} />
          <select
            value={filterResult}
            onChange={(e) => setFilterResult(e.target.value)}
            className="input"
            style={{ padding: '4px 8px', fontSize: 'var(--text-xs)', width: 'auto' }}
          >
            <option value="ALL">All Test Results</option>
            <option value="PASS">Pass Only</option>
            <option value="FAIL">Fail Only</option>
            <option value="BLOCKED">Blocked Only</option>
          </select>
        </div>

        <button
          className="btn btn-primary btn-sm"
          onClick={() => setShowAddModal(true)}
          style={{ gap: 6 }}
        >
          <Plus size={14} /> Log Test Run
        </button>
      </div>

      {/* TEST RUNS TABLE */}
      <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px' }}>Result</th>
              <th style={{ padding: '12px 16px' }}>Associated Feature</th>
              <th style={{ padding: '12px 16px' }}>Test Type</th>
              <th style={{ padding: '12px 16px' }}>Notes</th>
              <th style={{ padding: '12px 16px' }}>Executed At</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTests.map((t) => {
              const matchedFeature = features.find((f) => f.id === t.featureId);
              const rStyle = RESULT_STYLES[t.result] || RESULT_STYLES.PASS;
              const Icon = rStyle.icon;
              return (
                <tr key={t.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      fontSize: '11px', padding: '2px 8px', borderRadius: 4,
                      background: rStyle.bg, color: rStyle.color, fontWeight: 700,
                    }}>
                      <Icon size={12} /> {rStyle.label}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {matchedFeature?.name || 'Unknown Feature'}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                    {t.testType}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-muted)', maxWidth: 260 }}>
                    {t.notes || '—'}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                    {formatDate(t.executedAt)}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <button
                      className="btn-icon btn-ghost"
                      onClick={() => handleDelete(t)}
                      title="Delete test run"
                    >
                      <Trash2 size={14} style={{ color: '#ef4444' }} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {filteredTests.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No test runs logged yet. Click "Log Test Run" to record automated or manual test results.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* LOG TEST MODAL */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>Log SaaS Test Run</h3>
              <button className="btn-icon btn-ghost" onClick={() => setShowAddModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="label">Associated Feature *</label>
                <select
                  className="input"
                  value={form.featureId}
                  onChange={(e) => setForm({ ...form, featureId: e.target.value })}
                >
                  <option value="">Select a feature...</option>
                  {features.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.status})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="label">Test Type</label>
                  <select
                    className="input"
                    value={form.testType}
                    onChange={(e) => setForm({ ...form, testType: e.target.value })}
                  >
                    <option value="Unit">Unit Test</option>
                    <option value="Integration">Integration Test</option>
                    <option value="Regression">Regression</option>
                    <option value="E2E">End-to-End</option>
                    <option value="Manual QA">Manual QA</option>
                    <option value="Performance">Performance</option>
                  </select>
                </div>

                <div>
                  <label className="label">Result</label>
                  <select
                    className="input"
                    value={form.result}
                    onChange={(e) => setForm({ ...form, result: e.target.value as TestResult })}
                  >
                    <option value="PASS">PASS ✓</option>
                    <option value="FAIL">FAIL ✗</option>
                    <option value="BLOCKED">BLOCKED ⚠️</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Notes / Failure Trace</label>
                <textarea
                  placeholder="Details of test execution, inputs, error logs, or verification notes..."
                  className="input"
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={handleCreateTest}>
                  Record Test
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
