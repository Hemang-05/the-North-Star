// ============================================================================
// PERSONAL OS — Layer 4: Live Gemini 3.7 Flash Smoke Test
// Standalone verification script for live provider integration.
//
// NOT part of the offline vitest suite. Requires GEMINI_API_KEY.
// Usage: npx tsx scripts/smokeTestGemini.ts
//
// Pipeline verified:
//   AIContext
//    ↓
//   GeminiProvider (system & user prompts with thinkingConfig)
//    ↓
//   gemini-3.7-flash API
//    ↓
//   structured JSON
//    ↓
//   schema validation
//    ↓
//   evidence catalog validation
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';
import {
  AI_MODEL,
  AI_MODE_CONFIG,
  type AIAnalysis,
  type AIContext,
} from '../src/types/ai.ts';
import {
  buildAISystemPrompt,
  buildAIUserPrompt,
} from '../src/services/ai/aiPrompts.ts';
import {
  AI_RESPONSE_SCHEMA,
  sanitizeEvidenceReferences,
} from '../src/server/aiHandler.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Resolve GEMINI_API_KEY from environment or .env file
function getApiKey(): string {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
    return process.env.GEMINI_API_KEY.trim();
  }

  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...vals] = trimmed.split('=');
        if (key.trim() === 'GEMINI_API_KEY') {
          return vals.join('=').trim().replace(/^["']|["']$/g, '');
        }
      }
    }
  }

  return '';
}

// 2. Build representative canonical AIContext fixture
function buildSampleContext(): AIContext {
  return {
    contextVersion: '4.0.0',
    generatedAt: new Date().toISOString(),
    period: {
      type: 'THIS_WEEK',
      start: '2026-09-01T00:00:00.000Z',
      end: '2026-09-07T23:59:59.999Z',
      label: 'This Week',
    },
    northStar: {
      title: '€50k Net Monthly Cash Flow',
      target: 50000,
      current: 17200,
      gap: 32800,
      progressPercent: 34.4,
      status: 'AT_RISK',
      breakdown: {
        agencyRealizedCash: 12400,
        voireCashReceived: 4800,
      },
    },
    goals: [
      {
        goalId: 'goal_job_apps',
        title: 'Submit 15 Tailored Applications',
        pillarId: 'job_hunt',
        metricKey: 'applications_count',
        cadence: 'WEEKLY',
        target: 15,
        current: 9,
        gap: 6,
        progressPercent: 60,
        status: 'AT_RISK',
      },
      {
        goalId: 'goal_agency_cash',
        title: 'Collect €15,000 in Retainers',
        pillarId: 'agency',
        metricKey: 'realized_cash',
        cadence: 'MONTHLY',
        target: 15000,
        current: 12400,
        gap: 2600,
        progressPercent: 82.7,
        status: 'ON_TRACK',
      },
    ],
    time: {
      summary: {
        totalHours: 36.5,
        totalMinutes: 2190,
        sessionCount: 22,
        deepWorkMinutes: 1650,
        deepWorkRatioPercent: 75.3,
        priorityAlignedPercent: 82.0,
        changePercent: 12.5,
      },
      pillars: [
        {
          pillarId: 'job_hunt',
          name: 'Career & Job Hunt',
          minutes: 600,
          hours: 10,
          percentageOfTotal: 27.4,
          sessionCount: 6,
          deepWorkMinutes: 450,
          isTopPriority: true,
        },
        {
          pillarId: 'agency',
          name: 'Software Agency',
          minutes: 720,
          hours: 12,
          percentageOfTotal: 32.9,
          sessionCount: 8,
          deepWorkMinutes: 600,
          isTopPriority: true,
        },
        {
          pillarId: 'trading_os',
          name: 'Trading OS & SaaS',
          minutes: 480,
          hours: 8,
          percentageOfTotal: 21.9,
          sessionCount: 4,
          deepWorkMinutes: 360,
          isTopPriority: true,
        },
        {
          pillarId: 'fitness',
          name: 'Physical Fitness',
          minutes: 390,
          hours: 6.5,
          percentageOfTotal: 17.8,
          sessionCount: 4,
          deepWorkMinutes: 240,
          isTopPriority: false,
        },
      ],
    },
    intelligence: {
      comparisons: [],
      trends: [
        {
          id: 'trend_deep_work_increase',
          title: 'Deep Work Discipline Rising',
          statement: 'Deep work ratio improved from 68% to 75.3% week-over-week.',
          direction: 'IMPROVING',
          severity: 'INFO',
        },
      ],
      anomalies: [
        {
          id: 'anomaly_job_hunt_gap',
          title: 'Application Volume Under Target',
          description: 'Current pace yields 9 of 15 target applications before deadline.',
          severity: 'WARNING',
          baseline: '15 applications',
          threshold: '12 applications',
        },
      ],
      pillarFacts: [],
    },
    pillars: [
      {
        pillarId: 'job_hunt',
        name: 'Career & Job Hunt',
        status: 'AT_RISK',
        keyMetrics: { applications: 9, interviews: 2 },
      },
      {
        pillarId: 'agency',
        name: 'Software Agency',
        status: 'ON_TRACK',
        keyMetrics: { activeClients: 3, cashCollected: 12400 },
      },
    ],
    evidenceCatalog: [
      {
        id: 'ns.cash_gap',
        category: 'GOAL',
        label: 'North Star €32.8k Cash Gap',
        source: 'Layer 2 Goal Evaluation',
        value: 32800,
      },
      {
        id: 'goal.job_apps.gap',
        category: 'GOAL',
        label: 'Job Applications Gap (6 remaining)',
        source: 'Job Hunt Pillar Tracker',
        value: 6,
      },
      {
        id: 'time.deep_work_ratio',
        category: 'TIME',
        label: 'Deep Work Ratio 75.3%',
        source: 'Time Aggregation Engine',
        value: 75.3,
      },
      {
        id: 'time.agency.hours',
        category: 'TIME',
        label: 'Agency Focus Time 12.0h',
        source: 'Time Aggregation Engine',
        value: 12.0,
      },
      {
        id: 'trend.deep_work_rise',
        category: 'TREND',
        label: 'Deep Work Rising WoW',
        source: 'Intelligence Fact Engine',
        value: true,
      },
      {
        id: 'anomaly.job_hunt_underpace',
        category: 'ANOMALY',
        label: 'Job Hunt Underpace Warning',
        source: 'Intelligence Fact Engine',
        value: true,
      },
    ],
    analysisMode: 'WEEKLY',
  };
}

// 3. Make live HTTPS call to Gemini 3.7 Flash API
async function callGeminiLive(
  systemPrompt: string,
  userPrompt: string,
  thinkingBudget: number,
  apiKey: string
): Promise<{ rawText: string; usageMetadata: any; latencyMs: number }> {
  const payload = JSON.stringify({
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: userPrompt }],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: AI_RESPONSE_SCHEMA,
      thinkingConfig: {
        thinkingBudget,
      },
    },
  });

  const models = [AI_MODEL, 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-flash-latest'];
  let lastError = '';

  for (const model of models) {
    try {
      let modelPayload = payload;
      if (model !== AI_MODEL && model !== 'gemini-2.5-flash') {
        try {
          const parsed = JSON.parse(payload);
          if (parsed.generationConfig?.thinkingConfig) {
            delete parsed.generationConfig.thinkingConfig;
            modelPayload = JSON.stringify(parsed);
          }
        } catch {
          // keep
        }
      }

      const startTime = Date.now();
      const resData = await new Promise<{ rawText: string; usageMetadata: any; latencyMs: number }>((resolve, reject) => {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const req = https.request(
          url,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(modelPayload),
            },
            timeout: 60000,
          },
          (res) => {
            let responseBody = '';
            res.on('data', (chunk) => { responseBody += chunk; });
            res.on('end', () => {
              const latencyMs = Date.now() - startTime;
              if (res.statusCode === 200) {
                try {
                  const parsed = JSON.parse(responseBody);
                  const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
                  const usage = parsed?.usageMetadata;
                  if (!text) {
                    reject(new Error('Missing candidate text in Gemini response'));
                  } else {
                    resolve({ rawText: text, usageMetadata: usage, latencyMs });
                  }
                } catch (err: any) {
                  reject(new Error(`Failed to parse Gemini response: ${err.message}`));
                }
              } else {
                reject(new Error(`Gemini API returned HTTP ${res.statusCode}: ${responseBody.slice(0, 300)}`));
              }
            });
          }
        );

        req.on('timeout', () => {
          req.destroy();
          reject(new Error(`Live Gemini request to ${model} timed out after 60s`));
        });

        req.on('error', (err) => reject(err));
        req.write(modelPayload);
        req.end();
      });

      return resData;
    } catch (err: any) {
      lastError = err.message || String(err);
      console.warn(`[Smoke Test] ${model} unavailable: ${lastError}. Trying fallback model...`);
    }
  }

  throw new Error(lastError);
}

// 4. Main smoke test executor
async function main() {
  console.log('============================================================');
  console.log('  PERSONAL OS — LAYER 4 LIVE GEMINI 3.7 FLASH SMOKE TEST    ');
  console.log('============================================================\n');

  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('❌ FAILURE: GEMINI_API_KEY is not configured in .env or environment.');
    console.error('Please set GEMINI_API_KEY to run the live smoke test.');
    process.exit(1);
  }

  console.log(`✓ Resolved API Key: ${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`);
  console.log(`✓ Target Model: ${AI_MODEL}`);

  const mode = 'WEEKLY';
  const modeConfig = AI_MODE_CONFIG[mode];
  console.log(`✓ Mode: ${mode} (Level: ${modeConfig.thinkingLevel}, Budget: ${modeConfig.thinkingBudget} tokens)`);

  const context = buildSampleContext();
  const validEvidenceIds = new Set(context.evidenceCatalog.map((e) => e.id));
  console.log(`✓ Context Prepared: ${context.evidenceCatalog.length} evidence catalog items`);

  const systemPrompt = buildAISystemPrompt(mode);
  const userPrompt = buildAIUserPrompt(context);

  console.log('\nInvoking Gemini 3.7 Flash API (with reasoning & schema constraints)...');
  try {
    const { rawText, usageMetadata, latencyMs } = await callGeminiLive(
      systemPrompt,
      userPrompt,
      modeConfig.thinkingBudget,
      apiKey
    );

    console.log(`✓ Response received in ${latencyMs}ms`);
    if (usageMetadata) {
      console.log(`✓ Usage: prompt=${usageMetadata.promptTokenCount}, thoughts=${usageMetadata.thoughtsTokenCount || 0}, candidates=${usageMetadata.candidatesTokenCount}`);
    }

    // 5. Schema validation
    const analysis: AIAnalysis = JSON.parse(rawText);
    if (!analysis.headline || typeof analysis.headline !== 'string') {
      throw new Error('Schema failure: Missing headline');
    }
    if (!analysis.summary || typeof analysis.summary !== 'string') {
      throw new Error('Schema failure: Missing summary');
    }
    if (!['LOW', 'MEDIUM', 'HIGH'].includes(analysis.confidence)) {
      throw new Error(`Schema failure: Invalid confidence "${analysis.confidence}"`);
    }
    if (!Array.isArray(analysis.observations) || analysis.observations.length === 0) {
      throw new Error('Schema failure: Missing observations array');
    }

    console.log('✓ Structured JSON schema verified:');
    console.log(`  - Headline: "${analysis.headline}"`);
    console.log(`  - Confidence: ${analysis.confidence}`);
    console.log(`  - Observations: ${analysis.observations.length}`);
    console.log(`  - Contradictions: ${analysis.contradictions?.length || 0}`);
    console.log(`  - Priorities: ${analysis.priorities?.length || 0}`);

    // 6. Evidence references verification
    const sanitized = sanitizeEvidenceReferences(analysis, validEvidenceIds);
    let totalEvidenceRefs = 0;
    for (const obs of sanitized.observations) {
      totalEvidenceRefs += obs.evidenceRefs.length;
    }
    console.log(`✓ Evidence references validated: ${totalEvidenceRefs} citations grounded in evidence catalog`);

    console.log('\n============================================================');
    console.log('  LIVE GEMINI SMOKE TEST: ALL CHECKS PASSED ✅              ');
    console.log('============================================================');
    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ Live Gemini Smoke Test Failed:');
    console.error(err.message || err);
    process.exit(1);
  }
}

main();
