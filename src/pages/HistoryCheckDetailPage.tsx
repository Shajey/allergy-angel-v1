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

import { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useProfileContext } from "../context/ProfileContext";
import { WhyDisclosure } from "@/components/shared/WhyDisclosure.js";
import { Button } from "@/components/ui/button.js";
import {
  buildExplanationFromCheck,
  type ExplanationRuleType,
} from "@/lib/buildExplanation.js";
import { AddToProfileButton } from "@/components/ui/AddToProfileButton.js";
import { Badge } from "@/components/ui/Badge.js";

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
  ruleCode?: string;
  details: Record<string, unknown>;
}

interface VerdictMeta {
  severity?: number;
  taxonomyVersion?: string;
  matchedCategory?: string;
  matchedChild?: string;
  crossReactive?: boolean;
  traceId?: string;
}

interface Verdict {
  riskLevel: "none" | "medium" | "high";
  reasoning: string;
  matched?: RuleMatch[];
  meta?: VerdictMeta;
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
    if (
      m.rule === "supplement_medication_interaction" &&
      event.event_type === "supplement"
    ) {
      const evSupplement = event.event_data.supplement ?? event.event_data.name;
      if (String(m.details.supplement).toLowerCase() === String(evSupplement).toLowerCase()) {
        return true;
      }
    }
    if (
      m.rule === "food_medication_interaction" &&
      event.event_type === "meal"
    ) {
      const mealText = String(event.event_data.meal ?? "").toLowerCase();
      const food = String(m.details.food ?? "").toLowerCase();
      if (food && mealText.includes(food)) return true;
    }
  }
  return false;
}

/** Get item name for medication/supplement (for Add to profile). */
function getEventItemName(event: HealthEventRow): string | null {
  const d = event.event_data;
  if (event.event_type === "medication") {
    const v = d.medication;
    return v != null ? String(v).trim() : null;
  }
  if (event.event_type === "supplement") {
    const v = d.supplement ?? d.name;
    return v != null ? String(v).trim() : null;
  }
  return null;
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
      const name = String(d.supplement ?? d.name ?? "unknown supplement");
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
function eventTypeLabel(eventType: string): string {
  switch (eventType) {
    case "medication":
      return "Medication";
    case "supplement":
      return "Supplement";
    case "meal":
      return "Meal";
    case "symptom":
      return "Symptom";
    case "glucose":
      return "Glucose";
    default:
      return eventType.charAt(0).toUpperCase() + eventType.slice(1);
  }
}

// ── Risk Badge + Reasoning (Phase 10K, 18.6, 20) ─────────────────────────────
// Phase 20: Urgent design system — Badge component, colored verdict card

function ruleTypeBadge(rt: ExplanationRuleType): { label: string; className: string } {
  switch (rt) {
    case "directMatch":
      return { label: "Direct Match", className: "bg-red-100 text-red-700" };
    case "crossReactive":
      return { label: "Cross-Reactive", className: "bg-amber-100 text-amber-700" };
    case "interaction":
      return { label: "Interaction", className: "bg-blue-100 text-blue-700" };
  }
}

function VerdictTrustLayer({
  verdict,
  checkId,
  includeRawText = false,
}: {
  verdict: Verdict;
  checkId?: string;
  includeRawText?: boolean;
}) {
  const { riskLevel, reasoning } = verdict;

  const explanation = useMemo(
    () => buildExplanationFromCheck({ verdict }, verdict.meta?.taxonomyVersion ?? "unknown"),
    [verdict]
  );

  const hasEntries = explanation.entries.length > 0;

  const verdictVariant = riskLevel === "high" ? "high" : riskLevel === "medium" ? "medium" : "safe";
  const verdictBg =
    riskLevel === "high"
      ? "bg-red-50 border-red-100"
      : riskLevel === "medium"
        ? "bg-amber-50 border-amber-100"
        : "bg-green-50 border-green-100";
  const verdictText =
    riskLevel === "high"
      ? "text-red-800"
      : riskLevel === "medium"
        ? "text-amber-800"
        : "text-green-800";

  return (
    <div className="space-y-3">
      <div
        className={`rounded-xl border p-4 ${verdictBg}`}
      >
        <Badge variant={verdictVariant} className="mb-2">
          {riskLevel === "high" ? "HIGH RISK" : riskLevel === "medium" ? "CAUTION" : "SAFE"}
        </Badge>
        <p className={`text-base ${verdictText} line-clamp-2`}>{reasoning}</p>
      </div>

      {hasEntries && (
        <WhyDisclosure title="Why?">
          <div className="space-y-4">
            {explanation.entries.map((entry, i) => {
              const badge = ruleTypeBadge(entry.ruleType);
              return (
                <div key={i} className="space-y-1.5">
                  {/* Section 1 — Risk Source */}
                  <p className="text-sm text-gray-900 font-medium">
                    {entry.summary}
                  </p>

                  {/* Section 2 — Rule Type + Rule Code + Parent Category */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                    {entry.ruleCode && (
                      <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono text-gray-600">
                        {entry.ruleCode}
                      </code>
                    )}
                    {entry.parentCategory && (
                      <span className="text-xs text-gray-500">
                        Category: {entry.parentCategory}
                      </span>
                    )}
                  </div>

                  {/* Section 3 — Evidence */}
                  {entry.evidence && (
                    <div className="text-xs text-gray-500">
                      {entry.evidence.riskRate != null && (
                        <span>Severity: {Math.round(entry.evidence.riskRate * 100)}/100</span>
                      )}
                      {entry.evidence.count != null && (
                        <span className="ml-2">Count: {entry.evidence.count}</span>
                      )}
                      {entry.evidence.highRiskCount != null && (
                        <span className="ml-2">High-risk: {entry.evidence.highRiskCount}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Section 4 — Taxonomy version + Trace ID + Download link */}
            <div className="pt-2 border-t border-gray-100 text-xs text-gray-500 space-y-1">
              <div>Taxonomy version: {explanation.taxonomyVersion}</div>
              {explanation.traceId && (
                <div className="flex items-center gap-1.5">
                  <span>Trace:</span>
                  <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-gray-600 select-all">
                    {explanation.traceId}
                  </code>
                </div>
              )}
              {checkId && (
                <div className="pt-1">
                  <a
                    href={`/api/report/check/download?checkId=${checkId}&includeRawText=${includeRawText}&format=text`}
                    className="text-gray-600 hover:text-gray-900 hover:underline"
                  >
                    Download safety report
                  </a>
                </div>
              )}
            </div>
          </div>
        </WhyDisclosure>
      )}
    </div>
  );
}

// ── Events List ─────────────────────────────────────────────────────
// Phase 19: Add to profile for medication/supplement with confidence >= 70%

function EventsList({
  events,
  matched,
  checkId,
}: {
  events: HealthEventRow[];
  matched: RuleMatch[];
  checkId: string;
}) {
  const { selectedProfileId } = useProfileContext();
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900">Events</h2>
      <p className="text-sm text-gray-500 mt-0.5">Items detected in your check.</p>
      <ul className="mt-4 space-y-3">
        {events.map((ev) => {
          const highlighted = isHighlighted(ev, matched);
          const canAddToProfile =
            selectedProfileId &&
            (ev.event_type === "medication" || ev.event_type === "supplement") &&
            ev.confidence_score >= 70 &&
            getEventItemName(ev);
          return (
            <li
              key={ev.id}
              className={`rounded-xl border p-4 ${
                highlighted
                  ? "border-red-200 bg-red-50"
                  : "border-gray-100 bg-white"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <Badge variant="neutral">{eventTypeLabel(ev.event_type)}</Badge>
                <span className="text-xs text-gray-400">
                  Confidence: {ev.confidence_score}%
                </span>
              </div>
              <p className="text-base text-gray-900 mt-2">{eventSummary(ev)}</p>
              {canAddToProfile && (
                <div className="mt-3 pt-3 border-t border-gray-50">
                  <AddToProfileButton
                    type={ev.event_type as "medication" | "supplement"}
                    name={getEventItemName(ev)!}
                    checkId={checkId}
                  />
                </div>
              )}
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
    <div className="rounded-xl border border-gray-100 bg-white">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 text-left text-base font-medium text-gray-900 flex items-center justify-between rounded-xl"
      >
        Original text
        <span className="text-xs text-gray-400">{open ? "hide" : "show"}</span>
      </button>
      {open && (
        <div className="px-4 pb-3 text-sm text-gray-600 whitespace-pre-wrap border-t border-gray-50 pt-2">
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
      <h2 className="text-lg font-semibold text-gray-900">Open questions</h2>
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
  const { selectedProfileId } = useProfileContext();
  const [data, setData] = useState<CheckDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Phase 10B: check if this check appears in any trajectory insight
  const [patternCount, setPatternCount] = useState(0);

  // Phase 10H: allergen taxonomy alerts (awareness-surface guardrail)
  const [allergenAlerts, setAllergenAlerts] = useState<AllergenAlert[]>([]);

  // Phase 13.6: include raw text in safety report download (default OFF)
  const [includeRawText, setIncludeRawText] = useState(false);

  useEffect(() => {
    if (!id) {
      setError("No check id provided.");
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchCheck() {
      try {
        const url = selectedProfileId
          ? `/api/history/${id}?profileId=${encodeURIComponent(selectedProfileId)}`
          : `/api/history/${id}`;
        const res = await fetch(url);
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }
        const json: CheckDetailResponse = await res.json();
        if (!cancelled) {
          setData(json);

          // Phase 10H: fetch profile and detect allergen alerts (best-effort)
          try {
            const profileUrl = selectedProfileId
              ? `/api/profile?profileId=${encodeURIComponent(selectedProfileId)}`
              : "/api/profile";
            const profileRes = await fetch(profileUrl);
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
  }, [id, selectedProfileId]);

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
          className="mt-4 inline-block text-sm font-medium text-gray-600 hover:text-gray-900 hover:underline"
        >
          Back to history
        </Link>
      </div>
    );
  }

  const { check, events } = data;
  const verdict = check.verdict as Verdict | null | undefined;
  const matched = verdict?.matched ?? [];

  // ── Success state ──────────────────────────────────────────────
  // Phase 18.3.1/18.4: flex-1 min-h-0 fills AppShell main; sticky footer, no-bounce
  return (
    <div className="flex-1 min-h-0 flex flex-col max-w-xl mx-auto">
      {/* Scrollable content - Phase 18.4: no-bounce for iOS */}
      <main className="flex-1 overflow-auto no-bounce px-4 sm:px-6 pt-4 sm:pt-6 space-y-4 overflow-x-hidden">
      {/* Back link */}
      <Link
        to="/history"
        className="text-sm font-medium text-gray-600 hover:text-gray-900 hover:underline"
      >
          Back to history
        </Link>

      {/* A) Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Check</h1>
        <p className="text-sm text-gray-500 mt-0.5">
            {formatDate(check.created_at)}
          </p>
        </div>

        {/* Phase 10B: Pattern detected badge */}
        {patternCount > 0 && (
        <Link
          to={`/insights?highlightCheckId=${check.id}`}
          className="block rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800 hover:bg-blue-100 transition-colors"
        >
            <span className="font-medium">Pattern detected</span>
            <span className="ml-1 text-blue-600">
              — this check appears in {patternCount} insight
              {patternCount !== 1 ? "s" : ""}. View all patterns.
            </span>
          </Link>
        )}

        {/* B) Verdict + Why? (Phase 10K) — only when verdict exists */}
        {verdict?.riskLevel && (
          <VerdictTrustLayer verdict={verdict} checkId={check.id} includeRawText={includeRawText} />
        )}

        {/* Phase 10H: allergen taxonomy awareness note */}
        <AllergenAlertBanner alerts={allergenAlerts} />

      {/* C) Events List */}
      <EventsList events={events} matched={matched} checkId={check.id} />

        {/* D) Raw Input (collapsible) */}
        <RawInput text={check.raw_text} />

        {/* E) Follow-up Questions */}
        <FollowUpQuestions questions={check.follow_up_questions ?? []} />

        {/* Spacer for sticky footer */}
        <div className="h-24" />
      </main>

      {/* F) Sticky footer — Download Safety Report (Phase 13.6, 18.3.1, 20) */}
      <div
        className="sticky bottom-0 shrink-0 bg-white border-t border-gray-100 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]"
      >
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer mb-3">
          <input
            type="checkbox"
            checked={includeRawText}
            onChange={(e) => setIncludeRawText(e.target.checked)}
            className="w-4 h-4 text-gray-600 border-gray-300 rounded focus:ring-gray-400"
          />
          <span>Include original text (may contain sensitive info)</span>
        </label>
        <a
          href={`/api/report/check/download?checkId=${check.id}&includeRawText=${includeRawText}&format=text`}
          className="block"
        >
          <Button
            variant="secondary"
            size="sm"
            className="w-full py-3 font-semibold rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            Download report
          </Button>
        </a>
      </div>
    </div>
  );
}
