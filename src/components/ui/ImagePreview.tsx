/**
 * Phase 17 – Image preview with optional loading overlay
 */

interface ImagePreviewProps {
  src: string;
  alt?: string;
  isLoading?: boolean;
  className?: string;
}

export function ImagePreview({
  src,
  alt = "Preview",
  isLoading = false,
  className = "",
}: ImagePreviewProps) {
  return (
    <div className={`relative rounded-lg border border-gray-200 overflow-hidden bg-gray-100 ${className}`}>
      <img
        src={src}
        alt={alt}
        className="w-full h-auto max-h-48 object-contain"
      />
      {isLoading && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-sm font-medium"
          role="status"
          aria-live="polite"
        >
          Extracting text…
        </div>
      )}
    </div>
  );
}
