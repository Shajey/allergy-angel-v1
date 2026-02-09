import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Phase 9C – Ask Page (wired to real POST /api/extract)
 *
 * On submit, calls POST /api/extract → server persists to Supabase →
 * then fetches the newest check via GET /api/history?limit=1 and
 * navigates to the Check Detail page.
 */

export default function AskPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Phase 1: images + barcode present as stubs; keep state ready.
  const [images] = useState<string[]>([]);
  const [barcode] = useState('');

  // Phase 4: Prefill from history (one-time)
  useEffect(() => {
    const state = location.state as { prefill?: string } | null;
    const prefill = state?.prefill?.trim();

    if (prefill) {
      setText(prefill);
      // Clear navigation state so refresh/back doesn't keep re-applying
      navigate('/ask', { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canSubmit = text.trim().length > 0 || images.length > 0 || barcode.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // ── Call real extraction endpoint (Phase 7+ persistence happens server-side)
      const extractRes = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: text.trim() }),
      });

      if (!extractRes.ok) {
        const body = await extractRes.json().catch(() => null);
        throw new Error(body?.error ?? `Extraction failed (HTTP ${extractRes.status})`);
      }

      // ── Navigate to the newest check detail page
      // The extraction was persisted server-side; fetch the latest check id.
      const historyRes = await fetch('/api/history?limit=1');
      if (historyRes.ok) {
        const historyJson = await historyRes.json();
        const newestCheck = historyJson.checks?.[0];
        if (newestCheck?.id) {
          navigate(`/history/${newestCheck.id}`);
          return;
        }
      }

      // Fallback: go to history list if we can't resolve the newest check
      navigate('/history');
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-xl font-semibold">Allergy Angel</h1>
      <p className="text-sm text-muted-foreground mt-2">
        Before you take or eat something, check for potential interactions.
      </p>

      <div className="mt-6">
        <label className="block text-sm font-medium mb-2">
          What are you about to take or eat?
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. magnesium with metformin"
          rows={3}
          className="w-full rounded-md border border-gray-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="mt-6">
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || isSubmitting}
          className={`w-full rounded-md px-4 py-3 text-sm font-medium transition-colors
            ${
              canSubmit
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }
          `}
        >
          {isSubmitting ? 'Checking…' : 'Check'}
        </button>
      </div>

      <div className="mt-4 text-xs text-muted-foreground">
        Examples:
        <ul className="list-disc list-inside mt-1">
          <li>Magnesium with metformin</li>
          <li>Grapefruit and cholesterol medication</li>
        </ul>
      </div>
    </div>
  );
}
