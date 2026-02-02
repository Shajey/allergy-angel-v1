import type { CheckInput, CheckResult, Profile } from '@/types/spec';
import type { HistoryRecord } from '@/types/history';

const HISTORY_KEY = 'allergyangel_history_v1';
const MAX_ITEMS = 50;

function isHistoryRecord(x: any): x is HistoryRecord {
  return (
    !!x &&
    typeof x === 'object' &&
    typeof x.id === 'string' &&
    x.input &&
    x.result &&
    x.profileSnapshot
  );
}

// Backward compatible loader:
// - New format: HistoryRecord[]
// - Old format A: CheckResult[]
// - Old format B: HistoryRecord[] without profileSnapshot
export function loadHistory(): HistoryRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];
    if (parsed.length === 0) return [];

    // New format
    if (isHistoryRecord(parsed[0])) return parsed as HistoryRecord[];

    // Old format A: CheckResult[]
    if (parsed[0]?.riskLabel && parsed[0]?.confidenceScore) {
      const old = parsed as CheckResult[];
      const emptyProfile: Profile = { items: [], updatedAt: new Date().toISOString() };

      return old.map((r) => ({
        id: r.id,
        createdAt: r.timestamp,
        input: { text: '', images: [], barcode: '' }, // cannot recover old input
        result: r,
        profileSnapshot: emptyProfile,
      }));
    }

    // Old format B: record-like objects missing profileSnapshot
    const emptyProfile: Profile = { items: [], updatedAt: new Date().toISOString() };
    return (parsed as any[]).map((rec) => ({
      id: rec.id ?? rec.result?.id ?? `unknown_${Math.random().toString(16).slice(2)}`,
      createdAt: rec.createdAt ?? rec.result?.timestamp ?? new Date().toISOString(),
      input: rec.input ?? { text: '', images: [], barcode: '' },
      result: rec.result,
      profileSnapshot: rec.profileSnapshot ?? emptyProfile,
    }));
  } catch {
    return [];
  }
}

function saveAll(items: HistoryRecord[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  window.dispatchEvent(new Event('history-changed'));
}

export function saveToHistory(input: CheckInput, result: CheckResult, profileSnapshot: Profile): void {
  const existing = loadHistory();

  const record: HistoryRecord = {
    id: result.id,
    createdAt: result.timestamp,
    input,
    result,
    profileSnapshot,
  };

  const next = [record, ...existing.filter((r) => r.id !== record.id)].slice(0, MAX_ITEMS);
  saveAll(next);
}

export function clearHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
  window.dispatchEvent(new Event('history-changed'));
}
