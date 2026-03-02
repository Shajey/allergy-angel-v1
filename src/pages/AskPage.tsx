import { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useProfileContext } from '../context/ProfileContext';
import { PhotoCapture } from '../components/ui/PhotoCapture';

/**
 * Phase 9C – Ask Page (wired to real POST /api/extract)
 * Phase 17 – Photo/camera input for label scanning
 *
 * On submit, calls POST /api/extract → server persists to Supabase →
 * then fetches the newest check via GET /api/history?limit=1 and
 * navigates to the Check Detail page.
 */

export default function AskPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedProfileId, selectedProfile, profiles } = useProfileContext();
  const checkingForName = selectedProfile?.display_name ?? profiles[0]?.display_name ?? null;

  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageType, setImageType] = useState<string>('image/jpeg');
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);

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

  const handlePhotoCapture = useCallback(async (base64: string, mimeType?: string) => {
    const type = mimeType || 'image/jpeg';
    setImageBase64(base64);
    setImageType(type);
    setPreviewDataUrl(`data:${type};base64,${base64}`);
    setIsExtracting(true);
    setError(null);
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, imageType: type, preview: true }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Extraction failed (HTTP ${res.status})`);
      }
      const json = await res.json();
      const extractedText = typeof json.text === 'string' ? json.text.trim() : '';
      setText(extractedText);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to extract text from image.');
    } finally {
      setIsExtracting(false);
    }
  }, []);

  const handleClearPhoto = useCallback(() => {
    setImageBase64(null);
    setPreviewDataUrl(null);
    setText('');
  }, []);

  const hasInput = text.trim().length > 0;
  const hasImage = !!imageBase64;
  const canSubmit = hasInput || hasImage;

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // ── Call real extraction endpoint (Phase 7+ persistence happens server-side)
      const extractBody: { rawText: string; fromImage?: boolean; image?: string; imageType?: string; profile_id?: string } = {
        rawText: text.trim(),
      };
      if (imageBase64) {
        extractBody.fromImage = true;
        extractBody.image = imageBase64;
        extractBody.imageType = imageType;
      }
      if (selectedProfileId) extractBody.profile_id = selectedProfileId;
      const extractRes = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(extractBody),
      });

      if (!extractRes.ok) {
        const body = await extractRes.json().catch(() => null);
        throw new Error(body?.error ?? `Extraction failed (HTTP ${extractRes.status})`);
      }

      // ── Navigate to the newest check detail page
      // The extraction was persisted server-side; fetch the latest check id.
      setImageBase64(null);
      setPreviewDataUrl(null);
      const historyUrl = selectedProfileId
        ? `/api/history?profileId=${encodeURIComponent(selectedProfileId)}&limit=1`
        : '/api/history?limit=1';
      const historyRes = await fetch(historyUrl);
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

  // Clear image after successful submit (so next check starts fresh)
  return (
    <div className="p-4 sm:p-6 max-w-xl mx-auto overflow-x-hidden">
      <h1 className="text-xl font-semibold">Allergy Angel</h1>
      {checkingForName && (
        <p className="text-sm font-medium text-emerald-700 mt-2" data-testid="checking-for">
          Checking for: {checkingForName}
        </p>
      )}
      <p className="text-sm text-muted-foreground mt-1">
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
        <div className="mt-3">
          <p className="text-xs text-gray-500 mb-2">Scan a label or type ingredients</p>
          <PhotoCapture
            onCapture={handlePhotoCapture}
            isExtracting={isExtracting}
            previewDataUrl={previewDataUrl}
            onClear={handleClearPhoto}
          />
        </div>
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
          className={`w-full rounded-lg px-4 py-3 text-lg font-medium transition-all min-h-[48px]
            ${
              canSubmit && !isSubmitting
                ? 'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
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
