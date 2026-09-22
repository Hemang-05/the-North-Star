// ============================================================================
// PERSONAL OS — Date Folding & Stacking Engine
// Organizes items within Kanban columns date-wise with the latest on top
// (like a stack) and groups them into collapsible date folds (Today,
// Yesterday, calendar dates) for clean, high-density UX/UI.
// ============================================================================

export interface DateFoldGroup<T> {
  /** Unique key for the fold (e.g., '2026-09-22' or 'unknown') */
  key: string;
  /** Primary human-readable label (e.g., 'Today', 'Yesterday', 'Fri, 18 Sep') */
  label: string;
  /** Subordinate contextual label (e.g., '22 Sep' or 'Older') */
  subLabel?: string;
  /** Fully formatted date string (e.g., '22 Sep 2026') */
  formattedDate: string;
  /** Epoch timestamp representing the day for ordering folds */
  dayTimestamp: number;
  /** Items within this fold, sorted in descending order (latest on top) */
  items: T[];
}

/**
 * Parses any date representation (ISO string, epoch ms, Date object)
 * safely into epoch milliseconds. Returns 0 if invalid or undefined.
 */
export function safeGetTimestamp(rawDate: string | number | Date | undefined | null): number {
  if (!rawDate) return 0;
  if (typeof rawDate === 'number') {
    return isNaN(rawDate) ? 0 : rawDate;
  }
  if (rawDate instanceof Date) {
    const time = rawDate.getTime();
    return isNaN(time) ? 0 : time;
  }
  const parsed = new Date(rawDate).getTime();
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Computes a local date key (YYYY-MM-DD) from a Date instance.
 */
function toLocalDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Groups items by date and arranges them in descending chronological order
 * (latest on top like a stack) both across date folds and within each fold.
 *
 * @param items List of items in the column
 * @param getDateFn Function extracting the relevant date/timestamp from an item
 * @param referenceNow Optional reference date (defaults to current time)
 */
export function groupAndStackByDate<T>(
  items: T[],
  getDateFn: (item: T) => string | number | Date | undefined | null,
  referenceNow: Date = new Date()
): DateFoldGroup<T>[] {
  if (!items || items.length === 0) return [];

  const nowMs = referenceNow.getTime();
  const todayKey = toLocalDateKey(referenceNow);

  const yesterday = new Date(referenceNow);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = toLocalDateKey(yesterday);

  // 1. Tag each item with its timestamp
  const tagged = items.map((item) => {
    const ts = safeGetTimestamp(getDateFn(item));
    return { item, ts };
  });

  // 2. Sort all items in descending order (latest on top)
  tagged.sort((a, b) => b.ts - a.ts);

  // 3. Group by local date key
  const groupsMap = new Map<
    string,
    {
      key: string;
      label: string;
      subLabel?: string;
      formattedDate: string;
      dayTimestamp: number;
      items: T[];
    }
  >();

  for (const { item, ts } of tagged) {
    if (ts === 0) {
      // Fallback group for missing dates
      const key = 'unknown';
      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          key,
          label: 'Undated',
          subLabel: 'No timestamp',
          formattedDate: 'Unknown date',
          dayTimestamp: 0,
          items: [],
        });
      }
      groupsMap.get(key)!.items.push(item);
      continue;
    }

    const itemDate = new Date(ts);
    const key = toLocalDateKey(itemDate);

    if (!groupsMap.has(key)) {
      // Create start-of-day timestamp for consistent fold ordering
      const startOfDay = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate()).getTime();

      let label = '';
      let subLabel: string | undefined;

      const formattedDate = itemDate.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });

      const dayMonth = itemDate.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
      });

      if (key === todayKey) {
        label = 'Today';
        subLabel = dayMonth;
      } else if (key === yesterdayKey) {
        label = 'Yesterday';
        subLabel = dayMonth;
      } else {
        const diffDays = Math.floor((nowMs - startOfDay) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays < 7) {
          // Within last 7 days: e.g. "Fri, 18 Sep"
          label = itemDate.toLocaleDateString('en-IN', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          });
        } else if (itemDate.getFullYear() === referenceNow.getFullYear()) {
          // Same calendar year: e.g. "4 Aug"
          label = dayMonth;
        } else {
          // Previous year: e.g. "15 Dec 2025"
          label = formattedDate;
        }
      }

      groupsMap.set(key, {
        key,
        label,
        subLabel,
        formattedDate,
        dayTimestamp: startOfDay,
        items: [],
      });
    }

    groupsMap.get(key)!.items.push(item);
  }

  // 4. Sort folds descending (latest day fold on top)
  const sortedFolds = Array.from(groupsMap.values()).sort((a, b) => b.dayTimestamp - a.dayTimestamp);

  return sortedFolds;
}
