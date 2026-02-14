/**
 * Phase 10D/10E/10F – Ranked Insight Feed with Feedback Loop
 *
 * Displays a ranked, grouped feed of trajectory insights using the
 * /api/insights/feed endpoint. Insights are organized by score tiers:
 *   - "High attention"   (score >= 80)
 *   - "Worth watching"   (score 60–79)
 *   - "Background"       (score < 60)
 *
 * Phase 10E: trigger_symptom insights show { exposures, hits, lift }.
 * Phase 10F: each insight shows Relevant / Not relevant / Unsure vote
 *            buttons with optimistic UI updates.
 *
 * Highlight awareness: reads ?highlightCheckId=... from the URL and
 * visually emphasizes any insight whose supportingEvents includes that
 * check ID, auto-scrolling it into view.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { WhyDisclosure } from "@/components/shared/WhyDisclosure.js";

// ── Types ────────────────────────────────────────────────────────────

interface InsightEvidence {
  exposures: number;
  hits: number;
  lift: number;
}

type VoteValue = "relevant" | "not_relevant" | "unsure";

interface FeedInsight {
  type: string;
  label: string;
  description: string;
  supportingEvents: string[];
  supportingEventCount: number;
  priorityHints: Record<string, unknown>;
  score: number;
  proximityBucket?: string;
  hoursDelta?: number;
  whyIncluded: string[];
  /** Phase 10E: exposure/hit/lift stats (trigger_symptom only). */
  evidence?: InsightEvidence;
  /** Phase 10F: stable fingerprint for feedback. */
  fingerprint: string;
  /** Phase 10F: user's existing vote, if any. */
  userVote?: string;
  /** Phase 10G: functional class metadata. Phase 10H++: severity/taxonomyVersion. */
  meta?: {
    classKey?: string;
    items?: string[];
    matchedBy?: string;
    severity?: number;
    taxonomyVersion?: string;
    crossReactiveLabel?: string;
  };
}

interface FeedResponse {
  profileId: string;
  windowHours: number;
  analyzedChecks: number;
  insights: FeedInsight[];
  warnings?: string[];
}

// ── Score tier definitions ───────────────────────────────────────────

interface ScoreTier {
  key: string;
  title: string;
  subtitle: string;
  /** CSS classes for the section header decoration */
  headerClass: string;
  /** CSS classes for the dot indicator */
  dotClass: string;
  filter: (score: number) => boolean;
}

const SCORE_TIERS: ScoreTier[] = [
  {
    key: "high",
    title: "High attention",
    subtitle: "Score 80+  —  likely meaningful patterns",
    headerClass: "text-red-800",
    dotClass: "bg-red-500",
    filter: (s) => s >= 80,
  },
  {
    key: "watch",
    title: "Worth watching",
    subtitle: "Score 60–79  —  emerging signals",
    headerClass: "text-amber-800",
    dotClass: "bg-amber-500",
    filter: (s) => s >= 60 && s < 80,
  },
  {
    key: "background",
    title: "Background",
    subtitle: "Score < 60  —  low-confidence or noisy",
    headerClass: "text-gray-600",
    dotClass: "bg-gray-400",
    filter: (s) => s < 60,
  },
];

// ── Helpers ──────────────────────────────────────────────────────────

function insightTypeBadge(type: string): { label: string; className: string } {
  switch (type) {
    case "medication_symptom_cluster":
      return { label: "Med → Cluster", className: "bg-blue-100 text-blue-700" };
    case "trigger_symptom":
      return { label: "Trigger → Symptom", className: "bg-amber-100 text-amber-700" };
    case "repeated_symptom":
      return { label: "Repeated", className: "bg-purple-100 text-purple-700" };
    case "functional_stacking":
      return { label: "Stack", className: "bg-rose-100 text-rose-700" };
    default:
      return { label: type, className: "bg-gray-100 text-gray-700" };
  }
}

// ── Vote button definitions ──────────────────────────────────────────

const VOTE_OPTIONS: { value: VoteValue; label: string; activeClass: string }[] = [
  { value: "relevant", label: "Relevant", activeClass: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  { value: "not_relevant", label: "Not relevant", activeClass: "bg-red-100 text-red-800 border-red-300" },
  { value: "unsure", label: "Unsure", activeClass: "bg-gray-200 text-gray-700 border-gray-400" },
];

// ── Insight Row Component ────────────────────────────────────────────

function InsightRow({
  insight,
  isHighlighted,
  highlightRef,
  currentVote,
  onVote,
}: {
  insight: FeedInsight;
  isHighlighted: boolean;
  highlightRef: React.RefObject<HTMLLIElement | null>;
  currentVote: VoteValue | undefined;
  onVote: (fingerprint: string, insight: FeedInsight, vote: VoteValue) => void;
}) {
  const badge = insightTypeBadge(insight.type);
  const firstCheckId = insight.supportingEvents[0];

  return (
    <li
      ref={isHighlighted ? highlightRef : undefined}
      className={`rounded-lg border p-4 text-sm transition-colors ${
        isHighlighted
          ? "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200"
          : "border-gray-200 bg-white"
      }`}
    >
      {/* Top row: badge + score */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
        >
          {badge.label}
        </span>
        <span className="text-xs tabular-nums text-gray-400">
          {insight.score}
        </span>
      </div>

      {/* Label */}
      <div className="mt-2 font-medium text-gray-900">{insight.label}</div>

      {/* Description */}
      <div className="mt-1 leading-snug text-gray-600">{insight.description}</div>

      {/* Phase 10K: Meta line (severity/taxonomyVersion) */}
      {insight.meta && (insight.meta.severity != null || insight.meta.taxonomyVersion) && (
        <div className="mt-2 text-xs text-gray-500">
          {[
            insight.meta.severity != null && `Severity ${insight.meta.severity}`,
            insight.meta.taxonomyVersion && `Taxonomy ${insight.meta.taxonomyVersion}`,
          ]
            .filter(Boolean)
            .join(" • ")}
        </div>
      )}

      {/* Phase 10E: evidence line (trigger_symptom only) */}
      {insight.evidence && (
        <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
          <span>
            {insight.evidence.hits}/{insight.evidence.exposures} hit/exposure
          </span>
          <span className="text-gray-300">|</span>
          <span>
            lift {insight.evidence.lift.toFixed(1)}x
          </span>
        </div>
      )}

      {/* Phase 10G: matched items for functional_stacking */}
      {insight.type === "functional_stacking" && insight.meta?.items && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {insight.meta.items.map((item, idx) => (
            <span
              key={idx}
              className="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-200"
            >
              {item}
            </span>
          ))}
        </div>
      )}

      {/* Phase 10K: Why? expandable evidence */}
      <div className="mt-3">
        <WhyDisclosure
          title="Why?"
          summaryLines={[
            !insight.description
              ? insight.label
              : !insight.label
                ? insight.description
                : insight.description.length <= insight.label.length
                  ? insight.description
                  : insight.label,
          ].filter(Boolean)}
        >
          {insight.evidence && (
            <div className="text-xs text-gray-600">
              Evidence: {insight.evidence.hits}/{insight.evidence.exposures} hit/exposure, lift{" "}
              {insight.evidence.lift.toFixed(1)}x
            </div>
          )}
          {(insight.userVote || insight.fingerprint) && (
            <div className="mt-1 text-xs text-gray-600">
              {insight.userVote && <span>Vote: {insight.userVote}</span>}
              {insight.fingerprint && (
                <span className={insight.userVote ? " ml-2" : ""}>
                  ID: {insight.fingerprint.slice(0, 8)}…
                </span>
              )}
            </div>
          )}
          {insight.supportingEvents && insight.supportingEvents.length > 0 && (
            <div className="mt-2">
              <span className="text-xs font-medium text-gray-700">Evidence checks:</span>
              <div className="mt-1 flex flex-wrap gap-2">
                {insight.supportingEvents.slice(0, 3).map((checkId) => (
                  <Link
                    key={checkId}
                    to={`/history/${checkId}`}
                    className="text-xs font-medium text-emerald-700 hover:underline"
                  >
                    {checkId.slice(0, 8)}…
                  </Link>
                ))}
              </div>
            </div>
          )}
        </WhyDisclosure>
      </div>

      {/* Footer: evidence count + link */}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-gray-500">
          {insight.supportingEventCount} check
          {insight.supportingEventCount !== 1 ? "s" : ""} as evidence
        </span>
        {firstCheckId && (
          <Link
            to={`/history/${firstCheckId}`}
            className="text-xs font-medium text-emerald-700 hover:underline"
          >
            View evidence &rarr;
          </Link>
        )}
      </div>

      {/* Phase 10F: vote buttons */}
      <div className="mt-3 flex items-center gap-2">
        {VOTE_OPTIONS.map((opt) => {
          const isActive = currentVote === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onVote(insight.fingerprint, insight, opt.value)}
              className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? opt.activeClass
                  : "border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </li>
  );
}

// ── Page Component ───────────────────────────────────────────────────

export default function InsightsPage() {
  const [searchParams] = useSearchParams();
  const highlightCheckId = searchParams.get("highlightCheckId");

  const [data, setData] = useState<FeedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Phase 10F: local vote state (fingerprint → vote) for optimistic UI
  const [votes, setVotes] = useState<Record<string, VoteValue>>({});
  const profileIdRef = useRef<string>("");

  // Ref for auto-scrolling to the first highlighted insight
  const highlightRef = useRef<HTMLLIElement | null>(null);
  const didScroll = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchFeed() {
      try {
        // Step 1: get profile to obtain profileId
        const profileRes = await fetch("/api/profile");
        if (!profileRes.ok) {
          const body = await profileRes.json().catch(() => null);
          throw new Error(body?.error ?? `Could not load profile (HTTP ${profileRes.status})`);
        }
        const profileJson = await profileRes.json();
        const profileId = profileJson?.profile?.id;

        if (!profileId) {
          throw new Error("Profile ID not found");
        }
        profileIdRef.current = profileId;

        // Step 2: fetch the insights feed
        const feedRes = await fetch(
          `/api/insights/feed?profileId=${encodeURIComponent(profileId)}&windowHours=48&limit=20`,
        );
        if (!feedRes.ok) {
          const body = await feedRes.json().catch(() => null);
          throw new Error(body?.error ?? `HTTP ${feedRes.status}`);
        }
        const feedJson: FeedResponse = await feedRes.json();
        if (!cancelled) {
          setData(feedJson);

          // Seed local vote state from server-returned userVote values
          const initial: Record<string, VoteValue> = {};
          for (const ins of feedJson.insights) {
            if (ins.userVote) {
              initial[ins.fingerprint] = ins.userVote as VoteValue;
            }
          }
          setVotes(initial);
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? "Failed to load insights");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchFeed();
    return () => {
      cancelled = true;
    };
  }, []);

  // Phase 10F: optimistic vote handler
  const handleVote = useCallback(
    (fingerprint: string, insight: FeedInsight, vote: VoteValue) => {
      // Optimistic update
      setVotes((prev) => ({ ...prev, [fingerprint]: vote }));

      // Fire-and-forget POST
      fetch("/api/insights/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: profileIdRef.current,
          insight: {
            type: insight.type,
            priorityHints: insight.priorityHints,
            supportingEvents: insight.supportingEvents,
          },
          vote,
        }),
      }).catch((err) => {
        console.warn("[InsightsPage] Vote POST failed:", err?.message);
        // Revert on failure
        setVotes((prev) => {
          const next = { ...prev };
          delete next[fingerprint];
          return next;
        });
      });
    },
    [],
  );

  // Auto-scroll to the first highlighted insight once data loads
  useEffect(() => {
    if (!didScroll.current && highlightRef.current && data) {
      didScroll.current = true;
      // Small delay so the DOM has settled
      requestAnimationFrame(() => {
        highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  }, [data]);

  // ── Loading ──
  if (loading) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <p className="text-sm text-gray-500">Analyzing patterns...</p>
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      </div>
    );
  }

  // ── Empty ──
  if (!data || data.insights.length === 0) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <h1 className="text-xl font-semibold text-gray-900">Insights</h1>
        <p className="mt-2 text-sm text-gray-500">
          No patterns detected in the last {data?.windowHours ?? 48} hours.
          Keep logging to build your health timeline.
        </p>
      </div>
    );
  }

  const { insights, windowHours, analyzedChecks } = data;

  // Track whether the first highlighted insight has been given the ref
  let highlightRefAssigned = false;

  return (
    <div className="p-6 max-w-xl mx-auto space-y-6 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Insights</h1>
        <p className="text-sm text-gray-500 mt-1">
          {insights.length} pattern{insights.length !== 1 ? "s" : ""} across{" "}
          {analyzedChecks} check{analyzedChecks !== 1 ? "s" : ""} in the last{" "}
          {windowHours}h &mdash; ranked by signal strength
        </p>
      </div>

      {/* Grouped tiers */}
      {SCORE_TIERS.map((tier) => {
        const tierInsights = insights.filter((ins) => tier.filter(ins.score));
        if (tierInsights.length === 0) return null;

        return (
          <section key={tier.key}>
            {/* Tier header */}
            <div className="flex items-center gap-2 mb-2">
              <span className={`h-2 w-2 rounded-full ${tier.dotClass}`} />
              <h2 className={`text-sm font-semibold ${tier.headerClass}`}>
                {tier.title}
              </h2>
              <span className="text-xs text-gray-400">{tier.subtitle}</span>
            </div>

            {/* Insight rows */}
            <ul className="space-y-3">
              {tierInsights.map((insight, i) => {
                const isHighlighted =
                  !!highlightCheckId &&
                  insight.supportingEvents.includes(highlightCheckId);

                // Only assign the ref to the first highlighted row
                const shouldRef = isHighlighted && !highlightRefAssigned;
                if (shouldRef) highlightRefAssigned = true;

                return (
                  <InsightRow
                    key={`${tier.key}-${i}`}
                    insight={insight}
                    isHighlighted={isHighlighted}
                    highlightRef={shouldRef ? highlightRef : { current: null }}
                    currentVote={votes[insight.fingerprint]}
                    onVote={handleVote}
                  />
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
