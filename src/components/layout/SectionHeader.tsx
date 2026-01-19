import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface SectionHeaderProps {
  /** Eyebrow text (uppercase, small, muted) */
  eyebrow?: string;
  /** Main section title */
  title: string;
  /** Optional subtitle/description */
  subtitle?: string;
  /** Optional action link */
  actionLabel?: string;
  actionHref?: string;
  /** Optional custom action element */
  action?: ReactNode;
  /** Additional className for the container */
  className?: string;
}

/**
 * SectionHeader provides consistent section header styling with:
 * - Eyebrow label (text-xs uppercase tracking-wider text-gray-500)
 * - Title (text-2xl font-bold text-gray-900)
 * - Optional subtitle
 * - Optional action link/button
 */
export default function SectionHeader({
  eyebrow,
  title,
  subtitle,
  actionLabel,
  actionHref,
  action,
  className = "",
}: SectionHeaderProps) {
  return (
    <div className={`mb-6 ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          {eyebrow && (
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              {eyebrow}
            </span>
          )}
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          {subtitle && (
            <p className="text-sm text-gray-600 mt-1">{subtitle}</p>
          )}
        </div>
        {actionHref && actionLabel && (
          <Link to={actionHref}>
            <Button
              variant="ghost"
              size="sm"
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 -mt-1"
            >
              {actionLabel} →
            </Button>
          </Link>
        )}
        {action}
      </div>
    </div>
  );
}
