/**
 * Phase O1 – Governance Page
 * Placeholder for governance timeline and promotion workflow.
 */

export default function GovernancePage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-[22px] font-semibold text-[#0F172A]">Governance</h1>
      <p className="mt-1 text-sm text-[#64748B] leading-relaxed">
        Governance promotes validated proposals into the canonical registry. All safety knowledge updates pass through this stage.
      </p>
      <div className="mt-6 rounded-xl border border-[#E2E8F0] bg-white p-6">
        <p className="text-sm text-[#64748B] leading-relaxed">
          Proposals are validated through replay testing before promotion to the canonical registry. Governance review UI is planned for a future phase.
        </p>
      </div>
    </div>
  );
}
