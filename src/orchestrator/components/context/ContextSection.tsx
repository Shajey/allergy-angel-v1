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
    <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B] mb-3">{title}</p>
      <div className="text-sm text-[#0F172A]">{children}</div>
    </div>
  );
}
