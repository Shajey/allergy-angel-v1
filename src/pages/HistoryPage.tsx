import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfileContext } from '../context/ProfileContext';
import { Badge } from '../components/ui/Badge';

/**
 * Phase 9C – History List (wired to Supabase via GET /api/history)
 * Phase 20 – Urgent design system: card layout, typography
 */

interface CheckSummary {
  id: string;
  raw_text: string;
  verdict: { riskLevel: 'none' | 'medium' | 'high'; reasoning: string };
  created_at: string;
  summary: { eventCount: number; eventTypes: string[] };
}

function formatHistoryDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function riskBadgeVariant(level: string): 'high' | 'medium' | 'safe' {
  if (level === 'high') return 'high';
  if (level === 'medium') return 'medium';
  return 'safe';
}

function riskLabel(level: string): string {
  return level === 'high' ? 'High Risk' : level === 'medium' ? 'Caution' : 'Safe';
}

export default function HistoryPage() {
  const { selectedProfileId } = useProfileContext();
  const [checks, setChecks] = useState<CheckSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedProfileId) return;
    let cancelled = false;

    async function fetchHistory() {
      try {
        const res = await fetch(`/api/history?profileId=${encodeURIComponent(selectedProfileId)}`);
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
  }, [selectedProfileId]);

  return (
    <div className="px-4 py-4 max-w-xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">History</h1>
        <p className="text-sm text-gray-500 mt-0.5">Your recent checks.</p>
      </div>

      {!selectedProfileId ? (
        <p className="text-sm text-gray-500">Select a profile to view history.</p>
      ) : loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      ) : checks.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white p-6 text-center">
          <p className="text-base text-gray-700">No checks yet.</p>
          <p className="text-sm text-gray-500 mt-1">Run a check from the Ask page.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {checks.map((check) => {
            const title = check.raw_text?.trim() || '(no text)';
            const riskLevel = check.verdict?.riskLevel ?? 'none';

            return (
              <li key={check.id}>
                <Link
                  to={`/history/${check.id}`}
                  className="block rounded-xl border border-gray-100 bg-white p-4 hover:border-gray-200 active:bg-gray-50 transition-colors"
                >
                  <h3 className="text-lg font-semibold text-gray-900 truncate">{title}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {check.summary.eventCount} event{check.summary.eventCount !== 1 ? 's' : ''}
                    {' · '}
                    {check.summary.eventTypes.join(', ')}
                  </p>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                    <div className="flex items-center gap-2">
                      <Badge variant={riskBadgeVariant(riskLevel)}>
                        {riskLabel(riskLevel)}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        {formatHistoryDate(check.created_at)}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500 hover:text-gray-700">
                      View details →
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
