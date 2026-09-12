import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  cleanJobDescription,
  localHeuristicParse,
  parseJdWithAi,
} from '../services/jdParser';

describe('Job Description (JD) Parser Service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('cleanJobDescription', () => {
    it('returns empty string for empty input', () => {
      expect(cleanJobDescription('')).toBe('');
    });

    it('strips EEO statements and legal boilerplates to save tokens', () => {
      const raw = `
        Senior Backend Engineer at Acme Corp
        Responsibilities: Build scalable APIs.
        We are an equal opportunity employer and value diversity at our company.
        All qualified applicants will receive consideration for employment.
      `;
      const cleaned = cleanJobDescription(raw);
      expect(cleaned).toContain('Senior Backend Engineer');
      expect(cleaned).toContain('Build scalable APIs.');
      expect(cleaned).not.toContain('equal opportunity employer');
      expect(cleaned).not.toContain('All qualified applicants will receive consideration');
    });

    it('normalizes excessive newlines', () => {
      const raw = "Line 1\n\n\n\n\nLine 2";
      const cleaned = cleanJobDescription(raw);
      expect(cleaned).toBe("Line 1\n\nLine 2");
    });
  });

  describe('localHeuristicParse', () => {
    it('detects REMOTE work mode accurately', () => {
      const jd = `
        Role: Frontend Engineer
        Location: Remote (Work from anywhere)
        Tech: React, TypeScript
      `;
      const res = localHeuristicParse(jd);
      expect(res.workMode).toBe('REMOTE');
    });

    it('detects HYBRID work mode accurately', () => {
      const jd = `
        Software Engineer
        This is a hybrid role based in Bengaluru (3 days in office).
      `;
      const res = localHeuristicParse(jd);
      expect(res.workMode).toBe('HYBRID');
    });

    it('detects ONSITE work mode accurately', () => {
      const jd = `
        Systems Architect
        Job Type: Full-time Onsite at our Mumbai headquarters.
      `;
      const res = localHeuristicParse(jd);
      expect(res.workMode).toBe('ONSITE');
    });

    it('parses Indian Rupee LPA salary ranges to numeric bounds', () => {
      const jd = `
        Full Stack Developer
        Compensation: ₹18 - 25 LPA
        Skills: React, Node.js, PostgreSQL
      `;
      const res = localHeuristicParse(jd);
      expect(res.currency).toBe('INR');
      expect(res.minSalary).toBe(1800000);
      expect(res.maxSalary).toBe(2500000);
    });

    it('parses USD $k salary ranges to numeric bounds', () => {
      const jd = `
        Staff Platform Engineer
        Salary Range: $130k - $160k USD
        Skills: Go, Kubernetes, Docker, AWS
      `;
      const res = localHeuristicParse(jd);
      expect(res.currency).toBe('USD');
      expect(res.minSalary).toBe(130000);
      expect(res.maxSalary).toBe(160000);
    });

    it('extracts role title from header lines', () => {
      const jd = `
        Senior React Native Developer
        Join our core mobile team building payment products.
      `;
      const res = localHeuristicParse(jd);
      expect(res.role).toBe('Senior React Native Developer');
    });

    it('extracts common tech skills from JD text', () => {
      const jd = `
        We are hiring for our backend team.
        Required experience: TypeScript, Next.js, Docker, AWS, PostgreSQL, Redis.
      `;
      const res = localHeuristicParse(jd);
      expect(res.skills).toContain('TypeScript');
      expect(res.skills).toContain('Next.js');
      expect(res.skills).toContain('Docker');
      expect(res.skills).toContain('PostgreSQL');
    });
  });

  describe('parseJdWithAi', () => {
    it('calls /api/ai/parse-jd endpoint and caches the result', async () => {
      const mockApiResponse = {
        company: 'Stripe',
        role: 'Staff Infrastructure Engineer',
        workMode: 'REMOTE',
        location: 'Remote, US',
        minSalary: 180000,
        maxSalary: 220000,
        currency: 'USD',
        skills: ['Go', 'Kubernetes', 'AWS', 'Distributed Systems'],
        summary: 'Lead reliability and multi-region deployment infrastructure.',
      };

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse,
      });
      globalThis.fetch = fetchMock;

      const jd = 'Lead reliability and multi-region deployment infrastructure at Stripe. $180k-$220k remote.';
      const res1 = await parseJdWithAi(jd);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(res1.company).toBe('Stripe');
      expect(res1.role).toBe('Staff Infrastructure Engineer');
      expect(res1.workMode).toBe('REMOTE');
      expect(res1.minSalary).toBe(180000);
      expect(res1.confidence).toBe('AI_EXTRACTED');

      // Second call with same text should hit memory cache without calling fetch
      const res2 = await parseJdWithAi(jd);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(res2.company).toBe('Stripe');
    });

    it('throws error when input is empty', async () => {
      await expect(parseJdWithAi('')).rejects.toThrow('Please paste job description text first.');
    });
  });
});
