import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * Phase 9C – History List (wired to Supabase via GET /api/history)
 *
 * Data contract (GET /api/history):
 * {
 *   checks: Array<{
 *     id: string;
 *     profile_id: string;
 *     raw_text: string;
 *     follow_up_questions: string[];
 *     verdict: { riskLevel: "none"|"medium"|"high"; reasoning: string };
 *     created_at: string;
 *     summary: { eventCount: number; eventTypes: string[] };
 *   }>
 * }
 */

interface CheckSummary {
  id: string;
  raw_text: string;
  verdict: { riskLevel: 'none' | 'medium' | 'high'; reasoning: string };
  created_at: string;
  summary: { eventCount: number; eventTypes: string[] };
}

function RiskBadge({ level }: { level: string }) {
  const base = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold';
  const cls =
    level === 'high'
      ? 'bg-red-100 text-red-800'
      : level === 'medium'
      ? 'bg-amber-100 text-amber-800'
      : 'bg-emerald-100 text-emerald-800';
  const label = level === 'high' ? 'High Risk' : level === 'medium' ? 'Caution' : 'Safe';

  return <span className={`${base} ${cls}`}>{label}</span>;
}

export default function HistoryPage() {
  const [checks, setChecks] = useState<CheckSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchHistory() {
      try {
        const res = await fetch('/api/history');
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }
        const json = await res.json();
        if (!cancelled) setChecks(json.checks ?? []);
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? 'Failed to load history');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchHistory();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="p-6 max-w-xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold">History</h1>
        <p className="text-sm text-gray-600 mt-1">Your recent checks.</p>
      </div>

      {loading ? (
        <div className="mt-6">
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      ) : error ? (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      ) : checks.length === 0 ? (
        <div className="mt-6 rounded-md border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-700">No checks yet.</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {checks.map((check) => {
            const title = check.raw_text?.trim() || '(no text)';
            const riskLevel = check.verdict?.riskLevel ?? 'none';

            return (
              <li key={check.id}>
                <Link
                  to={`/history/${check.id}`}
                  className="block rounded-md border border-gray-200 bg-white p-4 cursor-pointer active:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <RiskBadge level={riskLevel} />
                        <span className="text-xs text-gray-500">
                          {new Date(check.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-gray-900 truncate">{title}</div>
                      <div className="mt-1 text-xs text-gray-500">
                        {check.summary.eventCount} event{check.summary.eventCount !== 1 ? 's' : ''}
                        {' · '}
                        {check.summary.eventTypes.join(', ')}
                      </div>
                    </div>

                    <span className="text-sm text-gray-400 mt-1 shrink-0">
                      View details &rarr;
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
