/**
 * Phase 9C – Check Detail Page
 *
 * Displays a single extraction check with its deterministic risk verdict,
 * evidence trace, extracted events, original input, and follow-up questions.
 *
 * Data contract (GET /api/history/:id):
 * {
 *   check: {
 *     id: string;
 *     profile_id: string;
 *     raw_text: string;
 *     follow_up_questions: string[];
 *     verdict: { riskLevel: "none"|"medium"|"high"; reasoning: string; matched?: RuleMatch[] };
 *     created_at: string;
 *   },
 *   events: Array<{
 *     id: string;
 *     event_type: string;
 *     event_data: Record<string, unknown>;
 *     confidence_score: number;
 *     check_id: string;
 *     created_at: string;
 *   }>
 * }
 */

import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

// ── Trajectory insight type (for "Pattern detected" badge) ──────────

interface TrajectoryInsight {
  type: string;
  label: string;
  supportingEvents: string[];
}

interface TrajectoryResponse {
  insights: TrajectoryInsight[];
}

// ── Local types (mirrors GET /api/history/:id response) ─────────────

interface RuleMatch {
  rule: string;
  details: Record<string, unknown>;
}

interface Verdict {
  riskLevel: "none" | "medium" | "high";
  reasoning: string;
  matched?: RuleMatch[];
}

interface Check {
  id: string;
  profile_id: string;
  raw_text: string;
  follow_up_questions: string[];
  verdict: Verdict;
  created_at: string;
}

interface HealthEventRow {
  id: string;
  profile_id: string;
  check_id: string;
  raw_input_id: string | null;
  event_type: string;
  event_data: Record<string, unknown>;
  confidence_score: number;
  provenance: Record<string, unknown>;
  created_at: string;
}

interface CheckDetailResponse {
  check: Check;
  events: HealthEventRow[];
}

// ── Helpers ─────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Does this event type + fields appear in the verdict's matched rules? */
function isHighlighted(event: HealthEventRow, matched: RuleMatch[]): boolean {
  for (const m of matched) {
    if (
      m.rule === "allergy_match" &&
      event.event_type === "meal" &&
      m.details.meal === event.event_data.meal
    ) {
      return true;
    }
    if (
      m.rule === "medication_interaction" &&
      event.event_type === "medication" &&
      (m.details.extracted === event.event_data.medication ||
        m.details.conflictsWith === event.event_data.medication)
    ) {
      return true;
    }
  }
  return false;
}

/** Render the key fields of an event as a readable string. */
function eventSummary(event: HealthEventRow): string {
  const d = event.event_data;
  switch (event.event_type) {
    case "meal":
      return String(d.meal ?? "unknown meal");
    case "medication": {
      const name = String(d.medication ?? "unknown");
      const dosage = d.dosage ? ` ${d.dosage}${d.unit ?? ""}` : "";
      return `${name}${dosage}`;
    }
    case "symptom":
      return String(d.symptom ?? "unknown symptom");
    case "supplement": {
      const name = String(d.supplement ?? "unknown supplement");
      const dosage = d.dosage ? ` ${d.dosage}` : "";
      return `${name}${dosage}`;
    }
    default:
      return JSON.stringify(d);
  }
}

/** Returns a human-readable label and Tailwind classes to visually distinguish event types. */
function eventTypeBadge(eventType: string): { label: string; className: string } {
  switch (eventType) {
    case "medication":
      return { label: "Medication", className: "bg-blue-100 text-blue-700" };
    case "supplement":
      return { label: "Supplement", className: "bg-purple-100 text-purple-700" };
    case "meal":
      return { label: "Meal", className: "bg-amber-100 text-amber-700" };
    case "symptom":
      return { label: "Symptom", className: "bg-red-100 text-red-700" };
    case "glucose":
      return { label: "Glucose", className: "bg-cyan-100 text-cyan-700" };
    default: {
      // Capitalize first letter for unknown types
      const label = eventType.charAt(0).toUpperCase() + eventType.slice(1);
      return { label, className: "bg-gray-100 text-gray-700" };
    }
  }
}

function ruleLabel(rule: string): string {
  switch (rule) {
    case "allergy_match":
      return "Allergy Match";
    case "medication_interaction":
      return "Medication Interaction";
    default:
      return rule;
  }
}

// ── Verdict Banner ──────────────────────────────────────────────────

function VerdictBanner({ verdict }: { verdict: Verdict }) {
  const base = "rounded-lg px-4 py-3 text-sm font-medium";

  if (verdict.riskLevel === "high") {
    return (
      <div className={`${base} bg-red-50 border border-red-200 text-red-800`}>
        <div className="font-semibold text-base">High Risk</div>
        <div className="mt-1">{verdict.reasoning}</div>
      </div>
    );
  }

  if (verdict.riskLevel === "medium") {
    return (
      <div className={`${base} bg-amber-50 border border-amber-200 text-amber-800`}>
        <div className="font-semibold text-base">Medium Risk</div>
        <div className="mt-1">{verdict.reasoning}</div>
      </div>
    );
  }

  return (
    <div className={`${base} bg-emerald-50 border border-emerald-200 text-emerald-800`}>
      <div className="font-semibold text-base">No Known Risks</div>
      <div className="mt-1">{verdict.reasoning}</div>
    </div>
  );
}

// ── Evidence Trace ──────────────────────────────────────────────────

function EvidenceTrace({ matched }: { matched: RuleMatch[] }) {
  if (matched.length === 0) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-gray-900">Why?</h2>
      <ul className="mt-2 space-y-2">
        {matched.map((m, i) => (
          <li key={i} className="text-sm text-gray-700">
            <span className="font-medium">{ruleLabel(m.rule)}:</span>{" "}
            {m.rule === "allergy_match" && (
              <>
                Meal "{String(m.details.meal)}" contains allergen "
                {String(m.details.allergen)}"
              </>
            )}
            {m.rule === "medication_interaction" && (
              <>
                {String(m.details.extracted)} may interact with{" "}
                {String(m.details.conflictsWith)}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Events List ─────────────────────────────────────────────────────

function EventsList({
  events,
  matched,
}: {
  events: HealthEventRow[];
  matched: RuleMatch[];
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-900">Events</h2>
      <ul className="mt-2 space-y-2">
        {events.map((ev) => {
          const highlighted = isHighlighted(ev, matched);
          return (
            <li
              key={ev.id}
              className={`rounded-lg border p-3 text-sm ${
                highlighted
                  ? "border-red-300 bg-red-50"
                  : "border-gray-200 bg-white"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${eventTypeBadge(ev.event_type).className}`}
                >
                  {eventTypeBadge(ev.event_type).label}
                </span>
                <span className="text-xs text-gray-500">
                  Confidence: {ev.confidence_score}%
                </span>
              </div>
              <div className="mt-1 text-gray-900">{eventSummary(ev)}</div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Collapsible Raw Input ───────────────────────────────────────────

function RawInput({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 text-left text-sm font-semibold text-gray-900 flex items-center justify-between"
      >
        Original text
        <span className="text-gray-400 text-xs">{open ? "hide" : "show"}</span>
      </button>
      {open && (
        <div className="px-4 pb-3 text-sm text-gray-700 whitespace-pre-wrap border-t border-gray-100 pt-2">
          {text}
        </div>
      )}
    </div>
  );
}

// ── Follow-up Questions ─────────────────────────────────────────────

function FollowUpQuestions({ questions }: { questions: string[] }) {
  if (questions.length === 0) return null;

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-900">Open questions</h2>
      <div className="mt-2 flex flex-wrap gap-2">
        {questions.map((q, i) => (
          <span
            key={i}
            className="inline-block rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-700"
          >
            {q}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Page Component ──────────────────────────────────────────────────

export default function HistoryCheckDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<CheckDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Phase 10B: check if this check appears in any trajectory insight
  const [patternCount, setPatternCount] = useState(0);

  useEffect(() => {
    if (!id) {
      setError("No check id provided.");
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchCheck() {
      try {
        const res = await fetch(`/api/history/${id}`);
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }
        const json: CheckDetailResponse = await res.json();
        if (!cancelled) setData(json);
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? "Failed to load check");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    // Non-blocking: fetch trajectory to check for pattern matches
    async function fetchPatterns() {
      try {
        const res = await fetch("/api/trajectory?windowHours=48&minOccurrences=2");
        if (!res.ok) return;
        const json: TrajectoryResponse = await res.json();
        const count = (json.insights ?? []).filter((ins) =>
          ins.supportingEvents.includes(id!)
        ).length;
        if (!cancelled) setPatternCount(count);
      } catch {
        // Pattern fetch is best-effort; ignore errors
      }
    }

    fetchCheck();
    fetchPatterns();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // ── Loading state ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <p className="text-sm text-gray-500">Loading check...</p>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error ?? "Check not found."}
        </div>
        <Link
          to="/history"
          className="mt-4 inline-block text-sm font-medium text-emerald-700 hover:underline"
        >
          Back to history
        </Link>
      </div>
    );
  }

  const { check, events } = data;
  const verdict: Verdict = check.verdict ?? {
    riskLevel: "none",
    reasoning: "No verdict available.",
  };
  const matched = verdict.matched ?? [];

  // ── Success state ──────────────────────────────────────────────
  return (
    <div className="p-6 max-w-xl mx-auto space-y-4">
      {/* Back link */}
      <Link
        to="/history"
        className="text-sm font-medium text-emerald-700 hover:underline"
      >
        Back to history
      </Link>

      {/* A) Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Check</h1>
        <p className="text-sm text-gray-500 mt-1">
          {formatDate(check.created_at)}
        </p>
      </div>

      {/* Phase 10B: Pattern detected badge */}
      {patternCount > 0 && (
        <Link
          to={`/insights?highlightCheckId=${check.id}`}
          className="block rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800 hover:bg-indigo-100 transition-colors"
        >
          <span className="font-medium">Pattern detected</span>
          <span className="ml-1 text-indigo-600">
            — this check appears in {patternCount} insight
            {patternCount !== 1 ? "s" : ""}. View all patterns.
          </span>
        </Link>
      )}

      {/* B) Verdict Banner */}
      <VerdictBanner verdict={verdict} />

      {/* C) Evidence Trace */}
      <EvidenceTrace matched={matched} />

      {/* C) Events List */}
      <EventsList events={events} matched={matched} />

      {/* D) Raw Input (collapsible) */}
      <RawInput text={check.raw_text} />

      {/* E) Follow-up Questions */}
      <FollowUpQuestions questions={check.follow_up_questions ?? []} />
    </div>
  );
}
