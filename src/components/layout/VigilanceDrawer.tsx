import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Link } from "react-router-dom";
import { X, ShieldAlert, ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface RecentTrigger {
  checkId: string;
  createdAt: string;
  riskLevel: "medium" | "high";
  severity: number | null;
  matched: string[];
  taxonomyVersion: string | null;
}

interface RecentTriggersResponse {
  profileId: string;
  windowHours: number;
  limit: number;
  triggers: RecentTrigger[];
}

interface VigilanceDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
  windowHours: number;
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

export default function VigilanceDrawer({
  open,
  onOpenChange,
  profileId,
  windowHours,
}: VigilanceDrawerProps) {
  const [data, setData] = useState<RecentTriggersResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(
      `/api/vigilance/recent?profileId=${encodeURIComponent(profileId)}&windowHours=${windowHours}&limit=10`
    )
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: RecentTriggersResponse) => {
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
          setLoading(false);
          if (process.env.NODE_ENV !== "production") {
            console.warn("[VigilanceDrawer] fetch failed:", err);
          }
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, profileId, windowHours]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/50",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          )}
        />

        <DialogPrimitive.Content
          className={cn(
            "fixed right-0 top-0 z-50 h-full w-[90vw] max-w-[420px] bg-white shadow-xl",
            "flex flex-col",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
            "duration-200"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              <div>
                <DialogPrimitive.Title className="text-base font-semibold text-gray-900">
                  Recent triggers
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="text-xs text-gray-500">
                  Last {windowHours} hours
                </DialogPrimitive.Description>
              </div>
            </div>
            <DialogPrimitive.Close className="p-2 -mr-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 min-w-[44px] min-h-[44px] flex items-center justify-center">
              <X className="h-5 w-5" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-12 text-gray-400">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                <span className="text-sm">Loading...</span>
              </div>
            )}

            {error && (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-gray-500">
                  Unable to load recent triggers.
                </p>
              </div>
            )}

            {!loading && !error && data?.triggers.length === 0 && (
              <div className="px-4 py-12 text-center">
                <p className="text-sm text-gray-500">
                  No recent triggers in this window.
                </p>
              </div>
            )}

            {!loading && !error && data && data.triggers.length > 0 && (
              <ul className="divide-y divide-gray-100">
                {data.triggers.map((t) => (
                  <TriggerRow
                    key={t.checkId}
                    trigger={t}
                    onClose={() => onOpenChange(false)}
                  />
                ))}
              </ul>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function TriggerRow({
  trigger,
  onClose,
}: {
  trigger: RecentTrigger;
  onClose: () => void;
}) {
  const isHigh = trigger.riskLevel === "high";
  const badgeBg = isHigh
    ? "bg-red-100 text-red-700"
    : "bg-amber-100 text-amber-700";

  const displayTerms = trigger.matched.slice(0, 2);
  const extra = trigger.matched.length - 2;

  return (
    <li className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
      <span
        className={cn(
          "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium flex-shrink-0",
          badgeBg
        )}
      >
        {trigger.riskLevel}
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {displayTerms.join(", ")}
          {extra > 0 && (
            <span className="text-xs text-gray-400 ml-1">+{extra} more</span>
          )}
        </p>
        <p className="text-xs text-gray-500">{timeAgo(trigger.createdAt)}</p>
      </div>

      <Link
        to={trigger.checkId ? `/history/${trigger.checkId}` : "/history"}
        onClick={onClose}
        className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-800 whitespace-nowrap flex-shrink-0"
      >
        Open
        <ExternalLink className="h-3 w-3" />
      </Link>
    </li>
  );
}
