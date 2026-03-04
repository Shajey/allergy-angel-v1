/**
 * Share or download safety report — iOS PWA-friendly.
 *
 * On iOS Safari/PWA, direct download opens a preview with no way back to the app.
 * Using Web Share API shows the native share sheet (Save to Files, Notes, Messages, AirDrop)
 * and keeps the user in the app after dismissing.
 *
 * On desktop, falls back to programmatic blob download.
 */

export interface ShareOrDownloadOptions {
  checkId: string;
  includeRawText: boolean;
  profileId?: string;
}

function buildDownloadUrl(options: ShareOrDownloadOptions): string {
  const params = new URLSearchParams({
    checkId: options.checkId,
    includeRawText: String(options.includeRawText),
    format: "text",
  });
  if (options.profileId) {
    params.set("profileId", options.profileId);
  }
  return `/api/report/check/download?${params.toString()}`;
}

function reportFilename(): string {
  const d = new Date();
  const date = d.toISOString().slice(0, 10);
  const time = d.toTimeString().slice(0, 5).replace(":", "-");
  return `allergy-angel-check-${date}-${time}.txt`;
}

/**
 * Fetches the report, then either shares via Web Share API (iOS) or triggers a download (desktop).
 * User stays in the app in both cases.
 */
export async function shareOrDownloadReport(options: ShareOrDownloadOptions): Promise<void> {
  const url = buildDownloadUrl(options);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch report: ${res.status}`);
  }
  const reportText = await res.text();
  const filename = reportFilename();
  const blob = new Blob([reportText], { type: "text/plain" });
  const file = new File([blob], filename, { type: "text/plain" });

  if (
    typeof navigator !== "undefined" &&
    navigator.share &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  ) {
    await navigator.share({
      files: [file],
      title: "Allergy Angel Report",
    });
  } else {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
