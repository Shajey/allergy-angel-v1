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

// ── Phase 10H awareness-surface guardrail; taxonomy logic deferred. ──
//
// Minimal, deterministic mapping of parent allergen classes to specific
// ingredients. When the user's profile includes a parent class AND the
// check mentions a child ingredient, we surface an informational note.
// This is copy-only — no inference, scoring, or persistence changes.

const ALLERGEN_TAXONOMY: Record<string, { parent: string; children: string[] }> = {
  "tree nuts": {
    parent: "tree nut",
    children: [
      "pistachio", "cashew", "walnut", "pecan", "almond",
      "macadamia", "brazil nut", "hazelnut", "filbert", "chestnut",
      "pine nut", "praline", "marzipan", "nougat",
    ],
  },
  shellfish: {
    parent: "shellfish",
    children: [
      "shrimp", "crab", "lobster", "crawfish", "crayfish",
      "prawn", "langoustine", "scallop", "clam", "mussel", "oyster",
    ],
  },
};

interface AllergenAlert {
  parentAllergy: string;
  /** Singular, human-readable label for use in copy (e.g., "tree nut"). */
  parentLabel: string;
  matchedIngredient: string;
}

/**
 * Scan a check's raw text and extracted events against the user's
 * known allergies to find parent→child allergen matches.
 */
function detectAllergenAlerts(
  knownAllergies: string[],
  rawText: string,
  events: { event_type: string; event_data: Record<string, unknown> }[],
): AllergenAlert[] {
  const alerts: AllergenAlert[] = [];
  const lowerRaw = rawText.toLowerCase();

  // Collect all textual content from events
  const eventTexts: string[] = [];
  for (const ev of events) {
    const d = ev.event_data;
    if (ev.event_type === "meal" && d.meal) eventTexts.push(String(d.meal).toLowerCase());
    if (ev.event_type === "supplement" && d.supplement) eventTexts.push(String(d.supplement).toLowerCase());
    if (ev.event_type === "supplement" && d.name) eventTexts.push(String(d.name).toLowerCase());
    if (ev.event_type === "medication" && d.medication) eventTexts.push(String(d.medication).toLowerCase());
  }

  const allText = [lowerRaw, ...eventTexts].join(" ");

  for (const allergy of knownAllergies) {
    const key = allergy.toLowerCase().trim();
    const taxonomy = ALLERGEN_TAXONOMY[key];
    if (!taxonomy) continue;

    for (const child of taxonomy.children) {
      if (allText.includes(child)) {
        alerts.push({ parentAllergy: allergy, parentLabel: taxonomy.parent, matchedIngredient: child });
      }
    }
  }

  return alerts;
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
    case "note":
      return String(d.text ?? d.note ?? "note");
    case "glucose": {
      const val = d.value != null ? String(d.value) : "—";
      const unit = d.unit ? ` ${d.unit}` : "";
      return `${val}${unit}`;
    }
    default:
      // Attempt common keys before falling back to JSON
      if (d.text) return String(d.text);
      if (d.name) return String(d.name);
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

// ── Allergen Alert Banner ────────────────────────────────────────────
// Phase 10H awareness-surface guardrail; taxonomy logic deferred.

function AllergenAlertBanner({ alerts }: { alerts: AllergenAlert[] }) {
  if (alerts.length === 0) return null;

  // Deduplicate by ingredient
  const seen = new Set<string>();
  const unique = alerts.filter((a) => {
    if (seen.has(a.matchedIngredient)) return false;
    seen.add(a.matchedIngredient);
    return true;
  });

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      {unique.map((alert, i) => {
        const ingredient =
          alert.matchedIngredient.charAt(0).toUpperCase() +
          alert.matchedIngredient.slice(1);
        return (
          <p key={i} className={i > 0 ? "mt-2" : ""}>
            <span className="font-medium">Note:</span> {ingredient} is
            commonly classified as a {alert.parentLabel}.
            For individuals with {alert.parentLabel} allergies,
            foods containing {alert.matchedIngredient} are often treated as
            higher risk.
          </p>
        );
      })}
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

  // Phase 10H: allergen taxonomy alerts (awareness-surface guardrail)
  const [allergenAlerts, setAllergenAlerts] = useState<AllergenAlert[]>([]);

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
        if (!cancelled) {
          setData(json);

          // Phase 10H: fetch profile and detect allergen alerts (best-effort)
          try {
            const profileRes = await fetch("/api/profile");
            if (profileRes.ok) {
              const profileJson = await profileRes.json();
              const allergies: string[] =
                profileJson?.profile?.known_allergies ?? [];
              if (allergies.length > 0) {
                const alerts = detectAllergenAlerts(
                  allergies,
                  json.check.raw_text,
                  json.events,
                );
                if (!cancelled) setAllergenAlerts(alerts);
              }
            }
          } catch {
            // Allergen alert is best-effort; ignore errors
          }
        }
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

      {/* Phase 10H: allergen taxonomy awareness note */}
      <AllergenAlertBanner alerts={allergenAlerts} />

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
