// ============================================================================
// PERSONAL OS — Utility Helpers
// ID generation, date helpers, formatting utilities.
// ============================================================================

// Compact unique ID generator (no external dependency)
export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
}

// Current ISO timestamp
export function now(): string {
  return new Date().toISOString();
}

// Today's date string (YYYY-MM-DD)
export function todayDate(): string {
  return new Date().toISOString().split('T')[0];
}

// Start of today (ISO)
export function startOfToday(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// End of today (ISO)
export function endOfToday(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

// Start of N days ago
export function startOfDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// Format seconds to HH:MM:SS
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}h ${m.toString().padStart(2, '0')}m`;
  }
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

// Format currency in INR
export function formatINR(amount: number): string {
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(2)} Cr`;
  }
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(2)} L`;
  }
  if (amount >= 1000) {
    return `₹${(amount / 1000).toFixed(1)}K`;
  }
  return `₹${amount.toLocaleString('en-IN')}`;
}

// Format raw number with commas
export function formatNumber(n: number): string {
  return n.toLocaleString('en-IN');
}

// Format percentage
export function formatPercent(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

// Relative time (e.g., "2 hours ago")
export function timeAgo(isoDate: string): string {
  const seconds = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  return new Date(isoDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// Format time (e.g., "09:15 AM")
export function formatTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

// Format date (e.g., "4 Sep 2026")
export function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// Group array by key
export function groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

// Sum array by numeric property
export function sumBy<T>(arr: T[], fn: (item: T) => number): number {
  return arr.reduce((sum, item) => sum + fn(item), 0);
}

// Calculate percentage, returns null if denominator is 0 (avoids misleading 0%)
export function safePct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return (numerator / denominator) * 100;
}

// Calculate percentage (default to 0 if zero denominator)
export function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return (numerator / denominator) * 100;
}

// Format safe percent with fallback
export function formatSafePercent(value: number | null, decimals: number = 1, fallback: string = '—'): string {
  if (value === null || isNaN(value)) return fallback;
  return `${value.toFixed(decimals)}%`;
}

// Start of N weeks ago
export function startOfWeeksAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - (n * 7));
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// Start of current month
export function startOfMonth(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// Days between two ISO dates
export function daysBetween(startIso: string, endIso: string = new Date().toISOString()): number {
  const s = new Date(startIso).getTime();
  const e = new Date(endIso).getTime();
  const diffMs = Math.abs(e - s);
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// Clamp value
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
