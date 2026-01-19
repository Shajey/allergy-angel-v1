import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface EmptyStateProps {
  /** Icon to display (should be a React element, e.g., Lucide icon or SVG) */
  icon?: ReactNode;
  /** Main title */
  title: string;
  /** Description text (healthcare-friendly tone) */
  description?: string;
  /** Optional action button */
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  /** Additional className */
  className?: string;
}

/**
 * EmptyState provides consistent empty state styling with:
 * - Centered icon (muted)
 * - Title and description
 * - Optional action button
 * 
 * Uses healthcare-friendly, reassuring tone.
 */
export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  className = "",
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-6 text-center ${className}`}>
      {icon && (
        <div className="w-16 h-16 mb-4 text-gray-300 flex items-center justify-center">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 max-w-sm mb-4">{description}</p>
      )}
      {actionLabel && (actionHref || onAction) && (
        actionHref ? (
          <Link to={actionHref}>
            <Button>{actionLabel}</Button>
          </Link>
        ) : (
          <Button onClick={onAction}>{actionLabel}</Button>
        )
      )}
    </div>
  );
}
