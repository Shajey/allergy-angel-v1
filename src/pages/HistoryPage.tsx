import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { HistoryRecord } from '@/types/history';
import { loadHistory, clearHistory } from '@/lib/historyStore';
import { mockCheck } from '@/lib/api/mockApi';
import { loadProfile } from '@/lib/profileStore';

function RiskBadge({ label }: { label: HistoryRecord['result']['riskLabel'] }) {
  const base = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold';
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

export default function HistoryPage() {
  const navigate = useNavigate();

  const [items, setItems] = useState<HistoryRecord[]>([]);
  const [isRecheckingId, setIsRecheckingId] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setItems(loadHistory());
    refresh();
    window.addEventListener('history-changed', refresh);
    return () => window.removeEventListener('history-changed', refresh);
  }, []);

  const openResult = (rec: HistoryRecord) => {
    navigate('/result', { state: { result: rec.result, historyRecord: rec } });
  };

  const recheck = async (rec: HistoryRecord) => {
    setIsRecheckingId(rec.id);
    try {
      const currentProfile = loadProfile();
      const next = await mockCheck(currentProfile, rec.input);
      navigate('/result', { state: { result: next } });
    } finally {
      setIsRecheckingId(null);
    }
  };

  const handleClear = () => {
    if (confirm('Clear history?')) clearHistory();
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">History</h1>
          <p className="text-sm text-gray-600 mt-1">Your recent checks (stored locally).</p>
        </div>
        {items.length > 0 && (
          <button
            onClick={handleClear}
            className="rounded-md px-3 py-2 text-sm font-medium border border-gray-300 text-gray-900 hover:bg-gray-50"
          >
            Clear
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="mt-6 rounded-md border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-700">No checks yet.</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((rec) => {
            const title = rec.input.text?.trim() || '(no text)';
            return (
              <li key={rec.id} className="rounded-md border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <RiskBadge label={rec.result.riskLabel} />
                      <div className="text-xs text-gray-500">
                        {new Date(rec.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-gray-900 truncate">{title}</div>
                    <div className="mt-1 text-xs text-gray-500">
                      Confidence: {rec.result.confidenceScore} ({rec.result.confidenceLevel})
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={() => openResult(rec)}
                      className="rounded-md px-3 py-2 text-sm font-medium border border-gray-300 text-gray-900 hover:bg-gray-50"
                    >
                      Open
                    </button>

                    <button
                      onClick={() => recheck(rec)}
                      disabled={isRecheckingId === rec.id}
                      className={`rounded-md px-3 py-2 text-sm font-medium ${
                        isRecheckingId === rec.id
                          ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700'
                      }`}
                    >
                      {isRecheckingId === rec.id ? 'Re-checking…' : 'Re-check now'}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
