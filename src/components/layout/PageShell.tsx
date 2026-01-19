import type { ReactNode } from "react";

interface PageShellProps {
  children: ReactNode;
  className?: string;
}

/**
 * PageShell provides consistent horizontal padding, max-width constraint,
 * and vertical rhythm for all portal pages.
 */
export default function PageShell({ children, className = "" }: PageShellProps) {
  return (
    <div className={`min-h-screen bg-gray-50 ${className}`}>
      {children}
    </div>
  );
}

interface PageShellContentProps {
  children: ReactNode;
  className?: string;
}

/**
 * PageShellContent wraps the main content area with consistent
 * horizontal padding, max-width, and vertical spacing.
 */
export function PageShellContent({ children, className = "" }: PageShellContentProps) {
  return (
    <div className={`max-w-7xl mx-auto px-6 lg:px-8 py-12 ${className}`}>
      <div className="space-y-12">{children}</div>
    </div>
  );
}
