/**
 * Phase 20 – Badge component (Urgent design system)
 *
 * Status badges: high, medium/caution, safe, info, neutral
 */

import { cn } from "@/lib/utils";

const variants = {
  high: "bg-red-100 text-red-600",
  medium: "bg-amber-100 text-amber-600",
  caution: "bg-amber-100 text-amber-600",
  safe: "bg-green-100 text-green-600",
  none: "bg-green-100 text-green-600",
  info: "bg-blue-100 text-blue-600",
  neutral: "bg-gray-100 text-gray-600",
} as const;

export type BadgeVariant = keyof typeof variants;

export function Badge({
  variant = "neutral",
  children,
  className,
}: {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
