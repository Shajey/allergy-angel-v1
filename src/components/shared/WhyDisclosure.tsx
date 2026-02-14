/**
 * Phase 10K – Why? Expandable Disclosure
 *
 * Accessible, mobile-first disclosure for "show your work" evidence.
 * Purely presentational; no network calls.
 */

import { useId, useState } from "react";
import { cn } from "@/lib/utils.js";

export interface WhyDisclosureProps {
  /** Button label (default: "Why?") */
  title?: string;
  /** Optional summary lines shown even when collapsed */
  summaryLines?: string[];
  /** Details content shown only when expanded */
  children: React.ReactNode;
  /** Start expanded (default: false) */
  defaultOpen?: boolean;
}

export function WhyDisclosure({
  title = "Why?",
  summaryLines,
  children,
  defaultOpen = false,
}: WhyDisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  const contentId = `why-disclosure-${id.replace(/:/g, "")}`;

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={contentId}
        className={cn(
          "w-full px-4 py-3 text-left text-sm font-semibold text-gray-900",
          "flex items-center justify-between gap-2",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2",
          "rounded-lg transition-colors hover:bg-gray-50"
        )}
      >
        <span>{title}</span>
        <span className="text-gray-400 text-xs" aria-hidden>
          {open ? "▲" : "▼"}
        </span>
      </button>

      {summaryLines && summaryLines.length > 0 && (
        <div className="px-4 pb-2 text-xs text-gray-600 leading-snug">
          {summaryLines.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      )}

      <div
        id={contentId}
        role="region"
        aria-hidden={!open}
        className={cn(
          "border-t border-gray-100",
          open ? "block" : "hidden"
        )}
      >
        <div className="px-4 py-3 text-sm text-gray-700">{children}</div>
      </div>
    </div>
  );
}
