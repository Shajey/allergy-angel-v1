import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ClinicalDocument } from "@/data/clinicalDocuments";
import {
  getClinicalTypeBadgeClass,
  getClinicalStatusBadgeClass,
  getClinicalTypeLabel,
} from "@/data/clinicalDocuments";
import { showToast } from "@/lib/toast";

interface ClinicalDocumentViewerProps {
  document: ClinicalDocument | null;
  isOpen: boolean;
  onClose: () => void;
  onMarkReviewed: (id: string) => void;
}

/**
 * Format date for display.
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * ClinicalDocumentViewer displays a clinical document in a modal with:
 * - Title and metadata
 * - Type and status badges
 * - Key summary information
 * - Q/A section in readable layout
 * - Actions: Mark as reviewed, Download PDF, Close
 */
export default function ClinicalDocumentViewer({
  document,
  isOpen,
  onClose,
  onMarkReviewed,
}: ClinicalDocumentViewerProps) {
  if (!document) return null;

  const isNew = document.reviewedAt === null;

  const handleDownloadPdf = () => {
    if (document.pdfUrl) {
      // POC: Open PDF URL in new tab
      window.open(document.pdfUrl, "_blank");
      showToast({
        title: "Opening Document",
        description: "The document is opening in a new tab.",
        type: "info",
      });
    } else {
      // Simulate download by creating a text blob
      const content = `
${document.title}
${"=".repeat(document.title.length)}

Type: ${getClinicalTypeLabel(document.type)}
Author: ${document.authorOrg} • ${document.authorRole}
Date: ${formatDate(document.createdAt)}

SUMMARY
-------
${document.summary.map((s) => `${s.label}: ${s.value}`).join("\n")}

QUESTIONS & ANSWERS
-------------------
${document.qa.map((qa) => `Q: ${qa.question}\nA: ${qa.answer}\n`).join("\n")}
      `.trim();

      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = `${document.title.replace(/[^a-z0-9]/gi, "_")}.txt`;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast({
        title: "Document Downloaded",
        description: "A text version of the document has been downloaded.",
        type: "success",
      });
    }
  };

  const handleMarkReviewed = () => {
    onMarkReviewed(document.id);
    showToast({
      title: "Document Reviewed",
      description: `"${document.title}" has been marked as reviewed.`,
      type: "success",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="space-y-4 pb-4 border-b border-gray-200">
          {/* Type and Status Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`px-2.5 py-1 rounded-md text-xs font-medium ${getClinicalTypeBadgeClass(
                document.type
              )}`}
            >
              {getClinicalTypeLabel(document.type)}
            </span>
            <span
              className={`px-2.5 py-1 rounded-md text-xs font-medium ${getClinicalStatusBadgeClass(
                document.status
              )}`}
            >
              {document.status}
            </span>
            {isNew && (
              <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-blue-600 text-white">
                New
              </span>
            )}
          </div>

          {/* Title */}
          <DialogTitle className="text-xl font-semibold text-gray-900">
            {document.title}
          </DialogTitle>

          {/* Author and Date */}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>{document.authorOrg}</span>
            <span className="text-gray-400">•</span>
            <span>{document.authorRole}</span>
            <span className="text-gray-400">•</span>
            <span>{formatDate(document.createdAt)}</span>
          </div>
        </DialogHeader>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto py-6 space-y-8">
          {/* Key Summary Section */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">
              Key Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {document.summary.map((item, index) => (
                <div
                  key={index}
                  className="bg-gray-50 rounded-lg p-4 border border-gray-100"
                >
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {item.label}
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-gray-900">
                    {item.value}
                  </dd>
                </div>
              ))}
            </div>
          </section>

          {/* Q&A Section */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">
              Questions & Answers
            </h3>
            <div className="space-y-6">
              {document.qa.map((item, index) => (
                <div key={index} className="space-y-2">
                  <h4 className="text-sm font-semibold text-gray-900">
                    {item.question}
                  </h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {item.answer}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Related Episode (if exists) */}
          {document.relatedEpisode && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                Related Episode
              </h3>
              <p className="text-sm text-gray-600">{document.relatedEpisode}</p>
            </section>
          )}
        </div>

        {/* Footer with Actions */}
        <DialogFooter className="pt-4 border-t border-gray-200 flex flex-col sm:flex-row gap-3">
          <div className="flex-1 flex gap-3">
            {isNew && (
              <Button
                variant="default"
                onClick={handleMarkReviewed}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Mark as Reviewed
              </Button>
            )}
            <Button variant="outline" onClick={handleDownloadPdf}>
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Download PDF
            </Button>
          </div>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
