import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PhotoCapture } from "./PhotoCapture";

describe("PhotoCapture", () => {
  const onCapture = vi.fn();

  beforeEach(() => {
    onCapture.mockClear();
  });

  it("renders camera and upload buttons", () => {
    render(<PhotoCapture onCapture={onCapture} />);
    expect(screen.getByText(/take photo/i)).toBeInTheDocument();
    expect(screen.getByText(/upload/i)).toBeInTheDocument();
  });

  it("shows loading state during extraction when preview present", () => {
    render(
      <PhotoCapture
        onCapture={onCapture}
        isExtracting={true}
        previewDataUrl="data:image/jpeg;base64,abc"
      />
    );
    expect(screen.getByText(/extracting/i)).toBeInTheDocument();
  });

  it("shows preview and retake when previewDataUrl provided", () => {
    render(
      <PhotoCapture
        onCapture={onCapture}
        previewDataUrl="data:image/jpeg;base64,abc123"
        onClear={vi.fn()}
      />
    );
    expect(screen.getByText(/retake/i)).toBeInTheDocument();
    expect(screen.getByAltText("Captured label")).toBeInTheDocument();
  });

  it("calls onClear when retake clicked", () => {
    const onClear = vi.fn();
    render(
      <PhotoCapture
        onCapture={onCapture}
        previewDataUrl="data:image/jpeg;base64,abc"
        onClear={onClear}
      />
    );
    fireEvent.click(screen.getByText(/retake/i));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
