/**
 * Phase O3 – Context Section
 * Reusable block for Context Panel.
 */

interface ContextSectionProps {
  title: string;
  children: React.ReactNode;
}

export default function ContextSection({ title, children }: ContextSectionProps) {
  return (
    <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3">
      <p className="orch-section-header text-xs font-medium text-[#0F172A] mb-2">{title}</p>
      <div className="text-sm text-[#0F172A]">{children}</div>
    </div>
  );
}
