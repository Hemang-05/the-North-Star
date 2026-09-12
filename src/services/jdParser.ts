// ============================================================================
// PERSONAL OS — Job Description (JD) Parser Service
// Hybrid Parser: Instant client-side heuristics + on-demand Gemini extraction.
// ============================================================================

import type { WorkMode } from '../types';

export interface ParsedJdResult {
  company?: string;
  role?: string;
  workMode?: WorkMode;
  location?: string;
  minSalary?: number;
  maxSalary?: number;
  currency?: string;
  skills?: string[];
  summary?: string;
  confidence: 'LOCAL_HEURISTIC' | 'AI_EXTRACTED';
}

// In-memory cache by text hash to avoid duplicate API calls
const extractionCache = new Map<string, ParsedJdResult>();

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(36);
}

/**
 * Strips common boilerplate text (EEO disclaimers, cookie notices, legal policies)
 * to save tokens and improve extraction accuracy.
 */
export function cleanJobDescription(raw: string): string {
  if (!raw) return '';

  let cleaned = raw;

  // Remove common EEO / diversity boilerplates
  const boilerplatePatterns = [
    /equal opportunity employer[\s\S]*?(?=(\n\n|$))/gi,
    /we are an equal opportunity[\s\S]*?(?=(\n\n|$))/gi,
    /all qualified applicants will receive consideration[\s\S]*?(?=(\n\n|$))/gi,
    /diversity, equity, and inclusion[\s\S]*?(?=(\n\n|$))/gi,
    /privacy policy[\s\S]*?(?=(\n\n|$))/gi,
    /cookie preferences[\s\S]*?(?=(\n\n|$))/gi,
    /notice at collection[\s\S]*?(?=(\n\n|$))/gi,
  ];

  for (const pattern of boilerplatePatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  // Normalize excessive whitespace
  cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

  // Cap at 10,000 characters to prevent accidental mega-payloads
  return cleaned.slice(0, 10000);
}

/**
 * Instant local heuristic parsing using regex patterns (0 API tokens, 0ms latency).
 */
export function localHeuristicParse(raw: string): ParsedJdResult {
  const text = cleanJobDescription(raw);
  const result: ParsedJdResult = {
    confidence: 'LOCAL_HEURISTIC',
  };

  if (!text) return result;

  // 1. Detect Work Mode
  const lower = text.toLowerCase();
  if (/\b(remote|work from home|wfh|telecommute|anywhere)\b/i.test(lower)) {
    result.workMode = 'REMOTE';
  } else if (/\b(hybrid|flexible location)\b/i.test(lower)) {
    result.workMode = 'HYBRID';
  } else if (/\b(onsite|on-site|in-office|in office)\b/i.test(lower)) {
    result.workMode = 'ONSITE';
  }

  // 2. Detect Salary Range
  // Handles ₹ / INR (e.g. 15-25 LPA, ₹12,00,000 - ₹18,00,000)
  const inrLpaMatch = text.match(/(?:₹|inr|rs\.?)\s*(\d+(?:\.\d+)?)\s*(?:-|to)\s*(?:₹|inr|rs\.?)?\s*(\d+(?:\.\d+)?)\s*(?:lpa|lakhs?|l)/i)
    || text.match(/(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*(?:lpa|lakhs?)/i);

  if (inrLpaMatch) {
    result.currency = 'INR';
    result.minSalary = Math.round(parseFloat(inrLpaMatch[1]) * 100000);
    result.maxSalary = Math.round(parseFloat(inrLpaMatch[2]) * 100000);
  } else {
    // USD / EUR / GBP or numeric (e.g. $120k - $150k, $120,000 - $160,000)
    const usdKMatch = text.match(/\$\s*(\d{2,3})\s*[kK]\s*(?:-|to)\s*\$?\s*(\d{2,3})\s*[kK]/i);
    if (usdKMatch) {
      result.currency = 'USD';
      result.minSalary = parseInt(usdKMatch[1], 10) * 1000;
      result.maxSalary = parseInt(usdKMatch[2], 10) * 1000;
    } else {
      const fullUsdMatch = text.match(/\$\s*(\d{1,3}(?:,\d{3})+)\s*(?:-|to)\s*\$?\s*(\d{1,3}(?:,\d{3})+)/i);
      if (fullUsdMatch) {
        result.currency = 'USD';
        result.minSalary = parseInt(fullUsdMatch[1].replace(/,/g, ''), 10);
        result.maxSalary = parseInt(fullUsdMatch[2].replace(/,/g, ''), 10);
      }
    }
  }

  // 3. Detect Role Title from top lines
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const titleKeywords = /(engineer|developer|designer|manager|lead|architect|analyst|specialist|consultant|director|intern|associate|vp)/i;

  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const line = lines[i];
    // Ignore lines that look like URLs or headers
    if (line.length < 80 && titleKeywords.test(line) && !line.includes('http') && !line.startsWith('#')) {
      const cleanRole = line.replace(/^(role|title|position|job title):\s*/i, '').trim();
      result.role = cleanRole;
      break;
    }
  }

  // 4. Detect Company Name
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const line = lines[i];
    const companyMatch = line.match(/(?:at|about|join|company):\s*([A-Za-z0-9\s&.,-]{2,40})/i)
      || line.match(/^([A-Za-z0-9\s&.,-]{2,30})\s+(?:is looking for|is hiring|seeks)/i);

    if (companyMatch && !titleKeywords.test(companyMatch[1])) {
      result.company = companyMatch[1].trim();
      break;
    }
  }

  // 5. Detect Common Tech Skills
  const commonTech = [
    'React', 'TypeScript', 'JavaScript', 'Node.js', 'Python', 'Go', 'Golang',
    'Java', 'C++', 'Rust', 'Next.js', 'PostgreSQL', 'SQL', 'MongoDB',
    'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'GraphQL', 'Tailwind',
    'Redis', 'Kafka', 'Figma', 'System Design',
  ];

  const matchedSkills: string[] = [];
  for (const tech of commonTech) {
    const regex = new RegExp(`\\b${tech.replace('+', '\\+')}\\b`, 'i');
    if (regex.test(text)) {
      matchedSkills.push(tech);
    }
  }
  if (matchedSkills.length > 0) {
    result.skills = matchedSkills.slice(0, 8);
  }

  return result;
}

/**
 * Deep AI Extraction using server-side Gemini 3.7 Flash endpoint.
 * Returns cached result if same text was parsed previously.
 */
export async function parseJdWithAi(raw: string): Promise<ParsedJdResult> {
  const cleaned = cleanJobDescription(raw);
  if (!cleaned) {
    throw new Error('Please paste job description text first.');
  }

  const hash = hashString(cleaned);
  if (extractionCache.has(hash)) {
    return extractionCache.get(hash)!;
  }

  const res = await fetch('/api/ai/parse-jd', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ jdText: cleaned }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Server returned error (${res.status})`);
  }

  const data = await res.json();
  const parsed: ParsedJdResult = {
    company: data.company || undefined,
    role: data.role || undefined,
    workMode: data.workMode || undefined,
    location: data.location || undefined,
    minSalary: typeof data.minSalary === 'number' ? data.minSalary : undefined,
    maxSalary: typeof data.maxSalary === 'number' ? data.maxSalary : undefined,
    currency: data.currency || undefined,
    skills: Array.isArray(data.skills) ? data.skills : undefined,
    summary: data.summary || undefined,
    confidence: 'AI_EXTRACTED',
  };

  extractionCache.set(hash, parsed);
  return parsed;
}
