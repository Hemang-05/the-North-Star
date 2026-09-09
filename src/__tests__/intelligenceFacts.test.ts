import { describe, it, expect } from 'vitest';
import {
  computeComparisonFact,
  detectAnomalies,
  buildTrends,
} from '../services/intelligenceFacts';
import type { TimeSummary, ComparisonFact } from '../types/intelligence';

describe('Intelligence Fact Engine', () => {
  describe('computeComparisonFact', () => {
    it('computes standard percentage change correctly', () => {
      const fact = computeComparisonFact({
        metricKey: 'job_hunt.applicationsThisWeek',
        label: 'Job Applications',
        current: 5,
        previous: 4,
        unit: 'apps',
      });

      expect(fact.state).toBe('AVAILABLE');
      expect(fact.current).toBe(5);
      expect(fact.previous).toBe(4);
      expect(fact.absoluteChange).toBe(1);
      expect(fact.percentageChange).toBe(25); // (5 - 4) / 4 * 100 = 25%
      expect(fact.direction).toBe('INCREASED');
      expect(fact.favorable).toBe(true);
      expect(fact.statement).toContain('increased +25% (4 → 5 apps)');
    });

    it('strictly guards against division by zero when previous is 0', () => {
      const zeroPrevFact = computeComparisonFact({
        metricKey: 'agency.activeClients',
        label: 'Active Clients',
        current: 2,
        previous: 0,
        unit: 'clients',
      });

      expect(zeroPrevFact.state).toBe('AVAILABLE');
      expect(zeroPrevFact.absoluteChange).toBe(2);
      expect(zeroPrevFact.percentageChange).toBeNull(); // Not infinity!
      expect(zeroPrevFact.direction).toBe('INCREASED');
      expect(zeroPrevFact.statement).toBe('Active Clients moved from 0 to 2 clients');
    });

    it('handles unchanged values correctly', () => {
      const unchanged = computeComparisonFact({
        metricKey: 'saas.mrr',
        label: 'SaaS MRR',
        current: 25000,
        previous: 25000,
        unit: '₹',
      });

      expect(unchanged.absoluteChange).toBe(0);
      expect(unchanged.percentageChange).toBe(0);
      expect(unchanged.direction).toBe('UNCHANGED');
      expect(unchanged.statement).toContain('remained steady at 25000 ₹');
    });

    it('preserves NO_DATA distinctions', () => {
      const noData = computeComparisonFact({
        metricKey: 'forex.paperTrades',
        label: 'Paper Trades',
        current: null,
        previous: null,
      });

      expect(noData.state).toBe('NO_DATA');
      expect(noData.percentageChange).toBeNull();
      expect(noData.statement).toContain('No data recorded');
    });

    it('respects LOWER_IS_BETTER metrics (e.g. Accounts Receivable, weight)', () => {
      const arFact = computeComparisonFact({
        metricKey: 'agency.accountsReceivable',
        label: 'Accounts Receivable',
        current: 50000,
        previous: 80000,
        unit: '₹',
      });

      expect(arFact.direction).toBe('DECREASED');
      // Decreasing AR is favorable for business!
      expect(arFact.favorable).toBe(true);
    });
  });

  describe('detectAnomalies', () => {
    it('detects substantial time drop anomalies against prior baseline', () => {
      const mockTimeSummary: TimeSummary = {
        totalMinutes: 40,
        totalHours: 0.7,
        byPillar: { job_hunt: 40, agency: 0, trading_os: 0, forex: 0, fitness: 0, voire: 0 },
        pillarDetails: [],
        byCategory: {},
        sessionCount: 1,
        averageSessionMinutes: 40,
        longestSessionMinutes: 40,
        deepWorkMinutes: 40,
        deepWorkSessionCount: 1,
        deepWorkRatioPercent: 100,
        priorityAlignedMinutes: 40,
        priorityAlignedPercent: 100,
        period: { start: '', end: '', type: 'THIS_WEEK', label: 'This Week' },
        previousPeriod: {
          totalMinutes: 300, // 5 hours baseline
          byPillar: { job_hunt: 300, agency: 0, trading_os: 0, forex: 0, fitness: 0, voire: 0 },
        },
        changePercent: -86.7,
      };

      const anomalies = detectAnomalies({
        timeSummary: mockTimeSummary,
        goals: [],
        comparisons: [],
      });

      expect(anomalies.some((a) => a.type === 'TIME_DROP')).toBe(true);
      const timeDrop = anomalies.find((a) => a.type === 'TIME_DROP')!;
      expect(timeDrop.severity).toBe('WARNING');
      expect(timeDrop.baseline).toContain('300 minutes');
    });

    it('flags zero activity in a high-priority pillar if it had prior focus', () => {
      const mockTimeSummary: TimeSummary = {
        totalMinutes: 120,
        totalHours: 2.0,
        byPillar: { job_hunt: 0, agency: 120, trading_os: 0, forex: 0, fitness: 0, voire: 0 },
        pillarDetails: [
          {
            pillarId: 'job_hunt',
            title: 'Job Hunt',
            color: '#6366f1',
            priorityRank: 1,
            minutes: 0,
            hours: 0,
            sharePercent: 0,
            sessionCount: 0,
            averageSessionMinutes: 0,
            longestSessionMinutes: 0,
            byCategory: {},
            previousPeriodMinutes: 90, // Had 90m prior
          },
        ],
        byCategory: {},
        sessionCount: 2,
        averageSessionMinutes: 60,
        longestSessionMinutes: 60,
        deepWorkMinutes: 120,
        deepWorkSessionCount: 2,
        deepWorkRatioPercent: 100,
        priorityAlignedMinutes: 120,
        priorityAlignedPercent: 100,
        period: { start: '', end: '', type: 'THIS_WEEK', label: 'This Week' },
      };

      const anomalies = detectAnomalies({
        timeSummary: mockTimeSummary,
        goals: [],
        comparisons: [],
      });

      const zeroJobHunt = anomalies.find((a) => a.type === 'ZERO_ACTIVITY');
      expect(zeroJobHunt).toBeDefined();
      expect(zeroJobHunt?.severity).toBe('CRITICAL');
      expect(zeroJobHunt?.title).toContain('Job Hunt');
    });
  });

  describe('buildTrends', () => {
    it('ranks positive and negative movements deterministically', () => {
      const comparisons: ComparisonFact[] = [
        {
          metricKey: 'voire.netSales',
          label: 'VOIRE Sales',
          current: 100000,
          previous: 70000,
          state: 'AVAILABLE',
          unit: '₹',
          absoluteChange: 30000,
          percentageChange: 42.9,
          direction: 'INCREASED',
          favorable: true,
          statement: 'Sales increased',
        },
        {
          metricKey: 'agency.realizedCash',
          label: 'Agency Cash',
          current: 150000,
          previous: 200000,
          state: 'AVAILABLE',
          unit: '₹',
          absoluteChange: -50000,
          percentageChange: -25.0,
          direction: 'DECREASED',
          favorable: false,
          statement: 'Cash dropped',
        },
      ];

      const mockTime: TimeSummary = {
        totalMinutes: 100,
        totalHours: 1.6,
        byPillar: {} as any,
        pillarDetails: [],
        byCategory: {},
        sessionCount: 1,
        averageSessionMinutes: 100,
        longestSessionMinutes: 100,
        deepWorkMinutes: 100,
        deepWorkSessionCount: 1,
        deepWorkRatioPercent: 100,
        priorityAlignedMinutes: 100,
        priorityAlignedPercent: 100,
        period: {} as any,
        changePercent: 15,
      };

      const { trends, biggestPositive, biggestNegative } = buildTrends(comparisons, mockTime);

      expect(trends.length).toBeGreaterThanOrEqual(2);
      expect(biggestPositive?.metricKey).toBe('voire.netSales');
      expect(biggestNegative?.metricKey).toBe('agency.realizedCash');
    });
  });

  describe('AI Boundary Enforcement', () => {
    it('produces purely descriptive facts with zero prescriptive recommendations', () => {
      const fact = computeComparisonFact({
        metricKey: 'forex.studyHoursMonth',
        label: 'Forex Study',
        current: 15,
        previous: 10,
        unit: 'hours',
      });

      // Fact statement must be strictly factual
      const text = fact.statement.toLowerCase();
      expect(text).not.toContain('should');
      expect(text).not.toContain('must');
      expect(text).not.toContain('recommend');
      expect(text).not.toContain('need to');
      expect(text).not.toContain('improve');
      expect(text).not.toContain('bad');
    });
  });
});
