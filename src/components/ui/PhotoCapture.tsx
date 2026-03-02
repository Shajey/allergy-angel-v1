/**
 * Phase 17 – Camera and file upload for product label scanning
 * Phase 18 – Direct camera capture (capture="environment") for mobile
 */

import { useRef, useState, useCallback } from "react";
import { Camera, Upload } from "lucide-react";
import { ImagePreview } from "./ImagePreview";

/** Supported MIME types for OpenAI Vision (png, jpeg, gif, webp) */
const SUPPORTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"] as const;
const ACCEPT_IMAGES = "image/png,image/jpeg,image/gif,image/webp";

/** Max dimension (px) — keeps under Vercel 4.5MB body limit */
const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.82;

interface PhotoCaptureProps {
  onCapture: (imageBase64: string, mimeType?: string) => void;
  isExtracting?: boolean;
  previewDataUrl?: string | null;
  onClear?: () => void;
}

/**
 * Compress image via canvas to stay under Vercel 4.5MB body limit.
 * Resizes to max 1024px, outputs JPEG at 0.82 quality.
 */
function compressImage(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = Math.round((height * MAX_DIMENSION) / width);
          width = MAX_DIMENSION;
        } else {
          width = Math.round((width * MAX_DIMENSION) / height);
          height = MAX_DIMENSION;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
      const base64 = dataUrl.split(",")[1] ?? "";
      resolve({ base64, mimeType: "image/jpeg" });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [prefix, data] = result.split(",");
      const base64 = data ?? "";
      const mimeMatch = prefix?.match(/data:(image\/[a-z]+);base64/);
      let mimeType = mimeMatch?.[1] ?? "image/jpeg";
      if (!SUPPORTED_IMAGE_TYPES.includes(mimeType as (typeof SUPPORTED_IMAGE_TYPES)[number])) {
        mimeType = "image/jpeg";
      }
      resolve({ base64, mimeType });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const CAMERA_DENIED_HELP =
  "On iOS: Settings → Safari → Camera. On Android: Settings → Apps → Browser → Permissions.";

export function PhotoCapture({
  onCapture,
  isExtracting = false,
  previewDataUrl = null,
  onClear,
}: PhotoCaptureProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (
        !file.type.startsWith("image/") ||
        !SUPPORTED_IMAGE_TYPES.includes(file.type as (typeof SUPPORTED_IMAGE_TYPES)[number])
      ) {
        setCameraError("Please use PNG, JPEG, GIF, or WebP format.");
        e.target.value = "";
        return;
      }
      setCameraError(null);
      try {
        // Compress to stay under Vercel 4.5MB body limit (HTTP 413)
        const { base64, mimeType } = await compressImage(file);
        onCapture(base64, mimeType);
      } catch (err) {
        console.error("[PhotoCapture] File read failed:", err);
        setCameraError("Failed to read image.");
      }
      e.target.value = "";
    },
    [onCapture]
  );

  return (
    <div className="space-y-3">
      {previewDataUrl ? (
        <div className="space-y-2">
          <ImagePreview
            src={previewDataUrl}
            alt="Captured label"
            isLoading={isExtracting}
          />
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              disabled={isExtracting}
              className="text-sm text-gray-600 hover:text-gray-900 underline disabled:opacity-50 min-h-[44px] min-w-[44px]"
            >
              Retake
            </button>
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          {/* Direct camera – iOS requires: accept="image/*", no display:none, label triggers input */}
          <label
            htmlFor="photo-capture-camera"
            className={`relative flex-1 flex items-center justify-center gap-2 min-h-[44px] min-w-[44px] rounded-md border-2 border-emerald-600 bg-emerald-600 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer ${
              isExtracting ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            <Camera className="h-5 w-5 shrink-0" />
            Take Photo
            <input
              id="photo-capture-camera"
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              aria-label="Take photo with camera"
            />
          </label>
          {/* File picker – for existing photos (opacity-0 overlay for iOS) */}
          <label
            htmlFor="photo-capture-upload"
            className={`relative flex-1 flex items-center justify-center gap-2 min-h-[44px] min-w-[44px] rounded-md border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer ${
              isExtracting ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            <Upload className="h-5 w-5 shrink-0" />
            Upload
            <input
              id="photo-capture-upload"
              ref={uploadInputRef}
              type="file"
              accept={ACCEPT_IMAGES}
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              aria-label="Upload image from device"
            />
          </label>
        </div>
      )}
      {cameraError && (
        <div className="text-red-600 text-sm mt-2">
          {cameraError}
          <br />
          <span className="text-gray-500 text-xs">{CAMERA_DENIED_HELP}</span>
        </div>
      )}
    </div>
  );
}
