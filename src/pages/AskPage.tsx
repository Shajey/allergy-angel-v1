import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { mockCheck } from '@/lib/api/mockApi';
import { loadProfile } from '@/lib/profileStore';
import { saveToHistory } from '@/lib/historyStore';
import type { CheckInput } from '@/types/spec';

export default function AskPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    try {
      const profileSnapshot = loadProfile();

      const input: CheckInput = {
        text: text.trim(),
        images,
        barcode: barcode.trim(),
      };

      const result = await mockCheck(profileSnapshot, input);

      // Phase 4: store input + result together
      saveToHistory(input, result, profileSnapshot);

      navigate('/result', { state: { result } });
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
