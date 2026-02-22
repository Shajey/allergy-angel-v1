/**
 * Phase 14.2 – Safety Protocol Modal (Care Loop)
 *
 * Displays actionable advice from the check report. Fetches report when opened.
 * Accessible, easy to dismiss, high z-index. Local state only, no DB writes.
 */

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ShieldAlert, Loader2 } from "lucide-react";

interface AdviceItem {
  id: string;
  level: "term" | "parent";
  target: string;
  title: string;
  symptomsToWatch: string[];
  immediateActions: string[];
  education: string[];
  disclaimers: string[];
}

interface ReportAdvice {
  version: string;
  items: AdviceItem[];
  topTarget: string | null;
}

interface CheckReport {
  output?: {
    advice?: ReportAdvice;
  };
}

interface SafetyProtocolModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkId: string;
}

export default function SafetyProtocolModal({
  open,
  onOpenChange,
  checkId,
}: SafetyProtocolModalProps) {
  const [report, setReport] = useState<CheckReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !checkId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setReport(null);

    fetch(`/api/report/check?checkId=${encodeURIComponent(checkId)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: CheckReport) => {
        if (!cancelled) {
          setReport(json);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
          setLoading(false);
          if (process.env.NODE_ENV !== "production") {
            console.warn("[SafetyProtocolModal] fetch failed:", err);
          }
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, checkId]);

  const advice = report?.output?.advice ?? null;
  const items = advice?.items ?? [];
  const hasAdvice = items.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] overflow-hidden flex flex-col z-[100] sm:max-w-lg"
        aria-describedby="safety-protocol-description"
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-500 flex-shrink-0" />
            <DialogTitle className="text-lg">Safety Protocol</DialogTitle>
          </div>
          <DialogDescription id="safety-protocol-description">
            Actionable guidance based on your current risk assessment.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-4 px-4 sm:-mx-6 sm:px-6">
          {loading && (
            <div className="flex items-center justify-center py-12 text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <span className="text-sm">Loading safety guidance...</span>
            </div>
          )}

          {error && (
            <div className="py-6 text-center">
              <p className="text-sm text-gray-600">
                Unable to load safety guidance. Please try again or view the check
                details.
              </p>
            </div>
          )}

          {!loading && !error && !hasAdvice && (
            <div className="py-6 text-center">
              <p className="text-sm font-medium text-amber-800 mb-2">
                Standard Safety: If symptoms are severe, seek emergency care immediately.
              </p>
              <p className="text-sm text-gray-600">
                No specific guidance available for this check.
              </p>
            </div>
          )}

          {!loading && !error && hasAdvice && (
            <div className="space-y-6 pb-4">
              {items.map((item) => (
                <AdviceCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>

        <footer className="mt-4 pt-4 border-t border-gray-200 flex-shrink-0">
          <p className="text-xs text-gray-500 text-center">
            Standard guidance only. Consult a professional in emergencies.
          </p>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

function AdviceCard({ item }: { item: AdviceItem }) {
  const symptoms = item.symptomsToWatch ?? [];
  const actions = item.immediateActions ?? [];
  const education = item.education ?? [];

  return (
    <section
      className="rounded-lg border border-gray-200 bg-gray-50/50 p-4"
      aria-labelledby={`advice-title-${item.id}`}
    >
      <h3
        id={`advice-title-${item.id}`}
        className="text-sm font-semibold text-gray-900 mb-3"
      >
        {item.title}
      </h3>

      {actions.length > 0 && (
        <div className="mb-4 p-3 rounded-md bg-amber-50 border border-amber-200">
          <p className="text-xs font-semibold text-amber-800 mb-1.5 uppercase tracking-wide">
            Immediate actions
          </p>
          <ul className="list-disc list-inside text-sm text-amber-900 space-y-0.5">
            {actions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {symptoms.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium text-gray-600 mb-1">
            Symptoms to watch
          </p>
          <ul className="list-disc list-inside text-sm text-gray-700 space-y-0.5">
            {symptoms.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {education.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-600 mb-1">Education</p>
          <ul className="list-disc list-inside text-sm text-gray-700 space-y-0.5">
            {education.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
