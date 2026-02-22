import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import {
  shouldShowBanner,
  computeExpiresIn,
  nextAckUntil,
  readAckMap,
  writeAck,
  type AckMap,
} from "../../lib/vigilanceBannerHelpers";
import VigilanceDrawer from "./VigilanceDrawer";
import SafetyProtocolModal from "./SafetyProtocolModal";

interface VigilanceTrigger {
  checkId: string;
  riskLevel: "medium" | "high";
  severity: number | null;
  matched: string[];
  lastSeenAt: string;
  taxonomyVersion: string | null;
}

interface VigilanceResponse {
  profileId: string;
  windowHours: number;
  vigilanceActive: boolean;
  trigger: VigilanceTrigger | null;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatExpiresIn(e: { hours: number; minutes: number }): string {
  if (e.hours > 0) return `${e.hours}h ${e.minutes}m`;
  return `${e.minutes}m`;
}

export default function VigilanceBanner() {
  const [data, setData] = useState<VigilanceResponse | null>(null);
  const [ackMap, setAckMap] = useState<AckMap>({});
  const [profileId, setProfileId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [safetyProtocolOpen, setSafetyProtocolOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const profileRes = await fetch("/api/profile");
        if (!profileRes.ok) return;
        const profileJson = await profileRes.json();
        const pid = profileJson?.profile?.id;
        if (!pid) return;

        const res = await fetch(
          `/api/vigilance?profileId=${encodeURIComponent(pid)}&windowHours=12`
        );
        if (!res.ok) return;
        const json: VigilanceResponse = await res.json();
        if (!cancelled) {
          setData(json);
          setProfileId(pid);
          setAckMap(readAckMap(pid));
        }
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[VigilanceBanner] fetch failed:", err);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAcknowledge = useCallback(() => {
    if (!data?.trigger || !profileId) return;
    const until = nextAckUntil(Date.now(), data.windowHours);
    writeAck(profileId, data.trigger.checkId, until);
    setAckMap((prev) => ({
      ...prev,
      [data.trigger!.checkId]: { acknowledgedUntil: until },
    }));
  }, [data, profileId]);

  if (!data?.vigilanceActive || !data.trigger) return null;
  if (!shouldShowBanner(data.trigger, Date.now(), ackMap)) return null;

  const { trigger, windowHours } = data;
  const isHigh = trigger.riskLevel === "high";
  const borderColor = isHigh ? "border-red-200" : "border-amber-200";
  const bgColor = isHigh ? "bg-red-50" : "bg-amber-50";
  const textColor = isHigh ? "text-red-800" : "text-amber-800";
  const iconColor = isHigh ? "text-red-500" : "text-amber-500";
  const badgeBg = isHigh ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700";
  const linkColor = isHigh
    ? "text-red-700 hover:text-red-900"
    : "text-amber-700 hover:text-amber-900";
  const ackBtnBg = isHigh
    ? "bg-red-100 text-red-700 hover:bg-red-200 focus-visible:ring-red-400"
    : "bg-amber-100 text-amber-700 hover:bg-amber-200 focus-visible:ring-amber-400";

  const displayTerms = (trigger.matched ?? []).slice(0, 3);
  const expiresIn = computeExpiresIn(trigger.lastSeenAt, Date.now(), windowHours);
  const ackHours = Math.min(windowHours, 12);

  const detailsPath = trigger.checkId
    ? `/history/${trigger.checkId}`
    : "/history";

  return (
    <div
      className={`border-b ${borderColor} ${bgColor} px-4 py-3`}
      role="status"
      aria-live="polite"
    >
      <div className="container mx-auto flex items-center gap-3 flex-wrap">
        <ShieldAlert className={`h-5 w-5 flex-shrink-0 ${iconColor}`} />

        <div className={`flex-1 min-w-0 text-sm ${textColor}`}>
          <span className="font-semibold">Current Precautions Active</span>

          <span className={`ml-2 inline-block rounded px-1.5 py-0.5 text-xs font-medium ${badgeBg}`}>
            {trigger.riskLevel}
          </span>

          {displayTerms.length > 0 && (
            <span className="ml-2">
              {displayTerms.join(", ")}
              {trigger.matched.length > 3 && (
                <span className="text-xs opacity-75">
                  {" "}+{trigger.matched.length - 3} more
                </span>
              )}
            </span>
          )}

          <span className="ml-2 text-xs opacity-75">
            Last triggered: {timeAgo(trigger.lastSeenAt)}
          </span>

          {expiresIn && (
            <span className="ml-2 text-xs opacity-75">
              · Expires in {formatExpiresIn(expiresIn)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {trigger.checkId && (
            <button
              onClick={() => setSafetyProtocolOpen(true)}
              className={`text-sm font-medium whitespace-nowrap underline ${linkColor}`}
              aria-label="Open Safety Protocol — actionable guidance for this alert"
            >
              Safety Protocol
            </button>
          )}

          <Link
            to={detailsPath}
            className={`text-sm font-medium whitespace-nowrap underline ${linkColor}`}
          >
            {trigger.checkId ? "View details" : "See history"}
          </Link>

          <button
            onClick={() => setDrawerOpen(true)}
            className={`text-xs font-medium whitespace-nowrap underline ${linkColor}`}
          >
            Recent triggers
          </button>

          <button
            onClick={handleAcknowledge}
            className={`px-3 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${ackBtnBg}`}
            aria-label={`Hide for now — hides this alert for ${ackHours} hours`}
            title={`Hides this alert for ${ackHours} hours`}
          >
            Hide for now
          </button>
        </div>
      </div>

      {profileId && (
        <VigilanceDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          profileId={profileId}
          windowHours={windowHours}
        />
      )}

      {trigger.checkId && (
        <SafetyProtocolModal
          open={safetyProtocolOpen}
          onOpenChange={setSafetyProtocolOpen}
          checkId={trigger.checkId}
        />
      )}
    </div>
  );
}
