import { describe, it, expect } from 'vitest';
import {
  METRIC_REGISTRY,
  getMetricDefinition,
  getAllMetricDefinitions,
  getMetricsByPillar,
  isRegisteredMetric,
} from '../services/kpiRegistry';

describe('Universal Metric Registry', () => {
  it('registers metrics across all 6 frozen pillars and North Star', () => {
    const all = getAllMetricDefinitions();
    expect(all.length).toBeGreaterThanOrEqual(25);

    const pillars = new Set(all.map((m) => m.pillarId));
    expect(pillars.has('job_hunt')).toBe(true);
    expect(pillars.has('agency')).toBe(true);
    expect(pillars.has('trading_os')).toBe(true);
    expect(pillars.has('forex')).toBe(true);
    expect(pillars.has('fitness')).toBe(true);
    expect(pillars.has('voire')).toBe(true);
    expect(pillars.has(null)).toBe(true); // North Star global
  });

  it('guarantees unique metricKey identifiers with no collisions', () => {
    const keys = METRIC_REGISTRY.map((m) => m.metricKey);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });

  it('retrieves metric definitions by stable metricKey', () => {
    const cash = getMetricDefinition('agency.realizedCash');
    expect(cash).toBeDefined();
    expect(cash?.name).toBe('Realized Cash (Money in Bank)');
    expect(cash?.unit).toBe('₹');
    expect(cash?.direction).toBe('HIGHER_IS_BETTER');
    expect(cash?.defaultCadence).toBe('MONTHLY');
    expect(cash?.isNorthStarContributor).toBe(true);

    const netSales = getMetricDefinition('voire.netSales');
    expect(netSales).toBeDefined();
    expect(netSales?.pillarId).toBe('voire');
    expect(netSales?.isNorthStarContributor).toBe(true);
  });

  it('filters metric definitions correctly by pillar', () => {
    const forexMetrics = getMetricsByPillar('forex');
    expect(forexMetrics.length).toBeGreaterThanOrEqual(4);
    expect(forexMetrics.every((m) => m.pillarId === 'forex')).toBe(true);

    // Strict Forex check: Learning & discipline ONLY — no trading P&L metrics!
    expect(forexMetrics.some((m) => m.metricKey.toLowerCase().includes('pnl'))).toBe(false);
    expect(forexMetrics.some((m) => m.metricKey.toLowerCase().includes('profit'))).toBe(false);
  });

  it('validates whether a key is officially registered', () => {
    expect(isRegisteredMetric('fitness.benchPressMaxPerSideKg')).toBe(true);
    expect(isRegisteredMetric('random.unregisteredMetric')).toBe(false);
  });
});
