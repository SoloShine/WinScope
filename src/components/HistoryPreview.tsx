import { useCallback } from "react";
import { HistoryTimeline } from "./HistoryTimeline";
import type { HistoryEntry } from "../types";
import { X, Radio } from "lucide-react";

interface HistoryPreviewProps {
  title: string;
  entries: HistoryEntry[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  onLive: () => void;
  onClose: () => void;
}

export function HistoryPreview({
  title,
  entries,
  currentIndex,
  onIndexChange,
  onLive,
  onClose,
}: HistoryPreviewProps) {
  const currentImage = useCallback(() => {
    if (currentIndex === -1 || currentIndex >= entries.length) {
      return entries[0]?.image;
    }
    return entries[currentIndex]?.image;
  }, [entries, currentIndex]);

  const image = currentImage();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl max-h-[90vh] mx-4 bg-surface rounded-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-lg font-semibold text-content truncate">
            {title}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={onLive}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                currentIndex === -1
                  ? "bg-primary text-white"
                  : "bg-surface-alt text-content-muted hover:text-content"
              }`}
            >
              <Radio size={14} className="inline mr-1" />
              实时
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-surface-alt text-content-muted hover:text-content transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Image Preview */}
        <div className="p-4 overflow-auto max-h-[60vh]">
          {image ? (
            <img
              src={`data:image/png;base64,${image}`}
              alt={title}
              className="w-full h-auto rounded border border-border"
            />
          ) : (
            <div className="flex items-center justify-center h-64 text-content-muted">
              暂无历史截图
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="p-4 border-t border-border">
          <HistoryTimeline
            entries={entries}
            currentIndex={currentIndex}
            onIndexChange={onIndexChange}
          />
        </div>
      </div>
    </div>
  );
}
