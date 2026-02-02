import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { addProfileItem, loadProfile } from '@/lib/profileStore';
import type { HistoryRecord } from '@/types/history';
import type { CheckResult, ProfileItemType } from '@/types/spec';

function RiskBadge({ label }: { label: CheckResult['riskLabel'] }) {
  const base = 'inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold';
  const cls =
    label === 'Safe'
      ? 'bg-emerald-100 text-emerald-800'
      : label === 'Caution'
      ? 'bg-amber-100 text-amber-800'
      : label === 'Avoid'
      ? 'bg-red-100 text-red-800'
      : 'bg-slate-100 text-slate-800';

  return <span className={`${base} ${cls}`}>{label}</span>;
}

function suggestionTypeToProfileItemType(t: string): ProfileItemType | null {
  if (t === 'medication') return 'medication';
  if (t === 'supplement') return 'supplement';
  if (t === 'allergy') return 'allergy';
  return null;
}

function ConfidenceIndicator({ score, level }: { score: number; level: string }) {
  return (
    <div className="text-sm text-gray-700">
      <span className="font-semibold">{score}</span> <span className="text-gray-500">({level})</span>
    </div>
  );
}

// ===== Phase 5 helpers =====
function normalize(v: string) {
  return (v ?? '').trim().toLowerCase();
}

type ProfileLikeItem = { type: string; normalizedValue?: string; value: string };

function diffProfileSnapshot(snapshotItems: ProfileLikeItem[], currentItems: ProfileLikeItem[]) {
  const key = (i: ProfileLikeItem) => `${i.type}:${normalize(i.normalizedValue ?? i.value)}`;

  const snapSet = new Set(snapshotItems.map(key));
  const curSet = new Set(currentItems.map(key));

  const added = currentItems.filter((i) => !snapSet.has(key(i)));
  const removed = snapshotItems.filter((i) => !curSet.has(key(i)));

  return { added, removed };
}
// ===== end Phase 5 helpers =====

export default function ResultPage() {
  const location = useLocation();
  const navigate = useNavigate();

  // Single cast (clean + avoids multiple casts)
  const navState = (location.state ?? {}) as { result?: CheckResult; historyRecord?: HistoryRecord };
  const result = navState.result;
  const historyRecord = navState.historyRecord;

  if (!result) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <h1 className="text-xl font-semibold">No result yet</h1>
        <p className="text-sm text-gray-600 mt-2">Start a new check from the Ask page.</p>
        <Link className="inline-block mt-4 text-emerald-700 hover:underline" to="/ask">
          Go to Ask
        </Link>
      </div>
    );
  }

  // ===== Phase 5: compute profile delta ONLY if opened from History =====
  const currentProfile = loadProfile();

  const delta = historyRecord
    ? diffProfileSnapshot(historyRecord.profileSnapshot.items, currentProfile.items)
    : { added: [], removed: [] };

  const addedTop = delta.added.slice(0, 3);
  const removedTop = delta.removed.slice(0, 3);
  const hasDelta = addedTop.length > 0 || removedTop.length > 0;

  // Only show delta when opened from History AND there is something to show
  const showDelta = !!historyRecord && hasDelta;
  // ===== end Phase 5 =====



  // ===== B3: Suggestion state + handlers (behavior) =====
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const [suggestionApplied, setSuggestionApplied] = useState(false);

  const suggestion = result.profileSuggestions?.[0];
  const canShowSuggestion = !!suggestion && !suggestionDismissed && !suggestionApplied;

  const handleApplySuggestion = () => {
    if (!suggestion) return;

    // If the suggestion is a nudge rather than a real entity, route to Profile.
    if (suggestion.value.toLowerCase().includes('open profile')) {
      navigate('/profile');
      return;
    }

    const mapped = suggestionTypeToProfileItemType(suggestion.type);
    if (!mapped) {
      navigate('/profile');
      return;
    }

    addProfileItem(mapped, suggestion.value, 'inferred');
    setSuggestionApplied(true);
  };
  // ===== end B3 =====

  const lowOrInsufficient = result.confidenceLevel === 'Low' || result.riskLabel === 'Insufficient data';

  return (
    <div className="p-6 max-w-xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Allergy Angel</h1>
          <p className="text-sm text-gray-600 mt-1">{result.summary}</p>
        </div>
        <div className="text-right">
          <RiskBadge label={result.riskLabel} />
          <div className="mt-2">
            <ConfidenceIndicator score={result.confidenceScore} level={result.confidenceLevel} />
          </div>
        </div>
      </div>

      {/* Detected Entities */}
      {result.detectedEntities.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-gray-900">Detected</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {result.detectedEntities.map((e) => (
              <span key={e} className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                {e}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Reasons */}
      {result.reasons.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-gray-900">Why</h2>
          <ul className="mt-2 list-disc list-inside text-sm text-gray-700 space-y-1">
            {result.reasons.map((r, idx) => (
              <li key={idx}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Missing Info */}
      {result.missingInfo.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-gray-900">To be more confident</h2>
          <ul className="mt-2 list-disc list-inside text-sm text-gray-700 space-y-1">
            {result.missingInfo.map((m, idx) => (
              <li key={idx}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Next Steps */}
      <div className="mt-6">
        <h2 className="text-sm font-semibold text-gray-900">What next</h2>
        <p className="mt-2 text-sm text-gray-700">
          {lowOrInsufficient
            ? 'If this decision matters, confirm with a pharmacist or your healthcare provider.'
            : 'If anything changes (dose, new meds, new supplements), re-check.'}
        </p>
      </div>

      {/* Profile delta (Phase 5) */}
      {showDelta && (
        <div className="mt-6 rounded-md border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900">Since this check</h2>
          <p className="mt-1 text-sm text-gray-700">
            Your profile has changed. If you re-check now, confidence may change.
          </p>

          {addedTop.length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-semibold text-gray-700">Added</div>
              <ul className="mt-1 list-disc list-inside text-sm text-gray-700 space-y-1">
                {addedTop.map((i) => (
                  <li key={`a:${i.type}:${i.normalizedValue ?? i.value}`}>
                    {i.type}: {i.value}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {removedTop.length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-semibold text-gray-700">Removed</div>
              <ul className="mt-1 list-disc list-inside text-sm text-gray-700 space-y-1">
                {removedTop.map((i) => (
                  <li key={`r:${i.type}:${i.normalizedValue ?? i.value}`}>
                    {i.type}: {i.value}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}



      {/* ===== B4: Suggestion UI (presentation) ===== */}
      {canShowSuggestion && suggestion && (
        <div className="mt-6 rounded-md border border-gray-200 bg-gray-50 p-4">
          <h2 className="text-sm font-semibold text-gray-900">Suggestion</h2>
          <p className="mt-1 text-sm text-gray-700">
            Add <span className="font-semibold">{suggestion.value}</span> to your profile?
          </p>
          <p className="mt-2 text-xs text-gray-500">Adding items improves confidence. We keep suggestions minimal.</p>

          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleApplySuggestion}
              className="w-full sm:w-auto rounded-md px-4 py-2 text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Add to profile
            </button>

            <button
              onClick={() => setSuggestionDismissed(true)}
              className="w-full sm:w-auto rounded-md px-4 py-2 text-sm font-medium border border-gray-300 text-gray-900 hover:bg-gray-50"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      {/* ===== end B4 ===== */}

      {/* Disclaimer */}
      <div className="mt-8 text-xs text-gray-500 border-t pt-4">
        This is probabilistic guidance based on your inputs and available data. Not medical advice.
      </div>

      {/* Actions */}
      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => navigate('/ask')}
          className="w-full sm:w-auto rounded-md px-4 py-3 text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700"
        >
          New check
        </button>
        <button
          onClick={() => navigate('/profile')}
          className="w-full sm:w-auto rounded-md px-4 py-3 text-sm font-medium border border-gray-300 text-gray-900 hover:bg-gray-50"
        >
          View profile
        </button>
      </div>
    </div>
  );
}
