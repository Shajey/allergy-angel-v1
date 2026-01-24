import type { ReactNode } from "react";

type ViewMode = "patient" | "caregiver" | "clinician" | "developer";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  hero?: boolean;
  viewMode?: ViewMode;
  badge?: string;
  children?: ReactNode;
}

/**
 * PageHeader provides consistent CareOS page identity pattern.
 *
 * V1 Identity Styling (per spec):
 * - Eyebrow: text-xs, uppercase, tracking-wide, font-medium, role-colored
 * - Title: text-3xl lg:text-4xl, font-semibold
 * - Subtitle: text-sm, text-muted-foreground
 *
 * Role-based eyebrow colors (B2 spec):
 * - Patient: emerald-600 (green)
 * - Caregiver: blue-600 (blue)
 * - Clinician: purple-600 (purple)
 * - Developer: slate-500 (gray)
 *
 * When hero={true}:
 * - Enhanced spacing and gradient background (Today page only)
 * - Larger typography
 *
 * When hero={false} (default):
 * - Standard layout with consistent spacing
 * - Follows the page identity header pattern
 *
 * Optional badge prop renders a pill badge next to the title.
 */
export default function PageHeader({
  title,
  subtitle,
  eyebrow,
  hero = false,
  viewMode = "caregiver",
  badge,
  children,
}: PageHeaderProps) {
  // Eyebrow color: role-based per B2 spec
  // Patient → Green, Caregiver → Blue, Clinician → Purple
  const getEyebrowColorClass = (mode: ViewMode): string => {
    switch (mode) {
      case "patient":
        return "text-emerald-600";
      case "caregiver":
        return "text-blue-600";
      case "clinician":
        return "text-purple-600";
      case "developer":
        return "text-slate-500";
    }
  };

  // Base eyebrow styling (consistent everywhere)
  // Spec: text-xs, uppercase, tracking-wide, font-medium, muted gray by default
  const eyebrowBaseClasses = "text-xs uppercase tracking-wide font-medium";
  const eyebrowColorClass = getEyebrowColorClass(viewMode);
  const eyebrowClasses = `${eyebrowBaseClasses} ${eyebrowColorClass}`;

  const isClinician = viewMode === "clinician";

  if (hero) {
    // Hero mode: enhanced spacing + gradient background
    // All personas use light 50->100 gradients for visual comfort
    // Patient: emerald, Caregiver: blue, Clinician: purple
    const getHeroContainerClasses = (): string => {
      switch (viewMode) {
        case "patient":
          return "bg-gradient-to-br from-emerald-50 to-emerald-100 border-b border-emerald-200/50";
        case "caregiver":
          return "bg-gradient-to-br from-blue-50 to-blue-100 border-b border-blue-200/50";
        case "clinician":
          // Use purple-50 to indigo-100 for a softer, comfortable purple gradient
          return "bg-gradient-to-br from-purple-50 to-indigo-100 border-b border-purple-200/50";
        case "developer":
          return "bg-gradient-to-br from-slate-50 to-slate-100 border-b border-slate-200/50";
      }
    };
    const containerClasses = getHeroContainerClasses();

    const titleClasses = isClinician
      ? "text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight"
      : "text-4xl lg:text-5xl font-bold text-gray-900 tracking-tight";

    const innerPaddingClasses = isClinician
      ? "max-w-7xl mx-auto px-8 py-10 lg:py-12"
      : "max-w-7xl mx-auto px-6 lg:px-8 py-12 lg:py-16";

    return (
      <div className={containerClasses}>
        <div className={innerPaddingClasses}>
          <div className="space-y-4">
            {eyebrow && (
              <span className={eyebrowClasses}>
                {eyebrow}
              </span>
            )}
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className={titleClasses}>
                {title}
              </h1>
              {badge && (
                <span className="inline-flex items-center rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                  {badge}
                </span>
              )}
            </div>
            {subtitle && <p className="text-lg text-gray-600">{subtitle}</p>}
            {children}
          </div>
        </div>
      </div>
    );
  }

  // Non-hero mode: standard layout with consistent spacing
  // Clinician gets a subtle purple-tinted background for consistency
  const containerClasses = isClinician
    ? "bg-purple-50/50 border-b border-purple-100"
    : "";

  const innerClasses = isClinician
    ? "max-w-7xl mx-auto px-6 lg:px-8 py-6"
    : "max-w-7xl mx-auto px-6 lg:px-8 pt-8 pb-0";

  // Spec: text-3xl lg:text-4xl font-semibold
  const titleClasses = isClinician
    ? "text-2xl lg:text-3xl font-semibold text-slate-900"
    : "text-3xl lg:text-4xl font-semibold text-gray-900";

  // Spec: text-sm text-muted-foreground
  const subtitleClasses = isClinician
    ? "text-sm text-slate-600 mt-1"
    : "text-sm text-muted-foreground mt-1";

  return (
    <div className={containerClasses}>
      <div className={innerClasses}>
        <div className="space-y-1">
          {eyebrow && (
            <span className={eyebrowClasses}>
              {eyebrow}
            </span>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className={titleClasses}>{title}</h1>
            {badge && (
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1 ${
                isClinician 
                  ? "bg-purple-50 text-purple-700 ring-purple-200"
                  : "bg-gray-100 text-gray-700 ring-gray-200"
              }`}>
                {badge}
              </span>
            )}
          </div>
          {subtitle && <p className={subtitleClasses}>{subtitle}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}
