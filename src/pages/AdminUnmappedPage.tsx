/**
 * Phase 11 – Admin Unmapped Discovery UI
 *
 * Internal tool to surface unmapped ingestible entities for taxonomy growth.
 * Read-only.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

interface UnmappedCandidate {
  value: string;
  kind: "meal_token" | "medication" | "supplement";
  count: number;
  highRiskCount: number;
  sampleCheckIds: string[];
}

interface UnmappedResponse {
  profileId: string;
  windowHours: number;
  candidates: UnmappedCandidate[];
}

export default function AdminUnmappedPage() {
  const [data, setData] = useState<UnmappedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const profileRes = await fetch("/api/profile");
        if (!profileRes.ok) {
          throw new Error("Could not load profile");
        }
        const profileJson = await profileRes.json();
        const profileId = profileJson?.profile?.id;
        if (!profileId) {
          throw new Error("Profile ID not found");
        }

        const res = await fetch(
          `/api/admin/unmapped?profileId=${encodeURIComponent(profileId)}&windowHours=168&limit=20`
        );
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }
        const json: UnmappedResponse = await res.json();
        if (!cancelled) setData(json);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <p className="text-sm text-gray-500">Loading unmapped candidates...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      </div>
    );
  }

  const candidates = data?.candidates ?? [];

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold text-gray-900">Unmapped Discovery</h1>
      <p className="mt-1 text-sm text-gray-600">
        Internal tool to improve taxonomy/registries (read-only).
      </p>
      <p className="mt-1 text-xs text-gray-500">
        Profile: {data?.profileId} · Window: {data?.windowHours}h
      </p>

      {candidates.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">No unmapped candidates found.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">
                  Value
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">
                  Kind
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">
                  Count
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">
                  HighRiskCount
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">
                  Open sample
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {candidates.map((c, i) => (
                <tr key={`${c.value}-${i}`}>
                  <td className="px-4 py-2 text-sm text-gray-900">{c.value}</td>
                  <td className="px-4 py-2 text-sm text-gray-600">{c.kind}</td>
                  <td className="px-4 py-2 text-sm text-gray-600">{c.count}</td>
                  <td className="px-4 py-2 text-sm text-gray-600">
                    {c.highRiskCount}
                  </td>
                  <td className="px-4 py-2">
                    {c.sampleCheckIds[0] ? (
                      <Link
                        to={`/history/${c.sampleCheckIds[0]}`}
                        className="text-sm font-medium text-emerald-700 hover:underline"
                      >
                        View →
                      </Link>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
