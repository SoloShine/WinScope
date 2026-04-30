import { useState, useCallback } from "react";
import type { WindowInfo } from "../types";
import { WindowCard } from "./WindowCard";
import { useTranslation } from "../i18n/index.tsx";

const MIN_WIDTH = 120;
const MAX_WIDTH = 720;
const ZOOM_STEP = 30;
const STORAGE_KEY = "winscope-card-width";

function getSavedWidth(): number {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const n = parseInt(saved, 10);
      if (n >= MIN_WIDTH && n <= MAX_WIDTH) return n;
    }
  } catch {}
  return 260;
}

interface WindowGridProps {
  windows: WindowInfo[];
  captures: Map<string, string>;
  activeCaptures: Set<string>;
  hiddenWindows: string[];
  onBringToFront: (title: string) => void;
}

export function WindowGrid({
  windows,
  captures,
  activeCaptures,
  hiddenWindows,
  onBringToFront,
}: WindowGridProps) {
  const { t } = useTranslation();
  const [cardWidth, setCardWidth] = useState(getSavedWidth);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setCardWidth((prev) => {
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        const next = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, prev + delta));
        if (next !== prev) {
          try {
            localStorage.setItem(STORAGE_KEY, String(next));
          } catch {}
        }
        return next;
      });
    }
  }, []);

  const visibleWindows = windows.filter(
    (w) =>
      activeCaptures.has(w.title) &&
      !hiddenWindows.includes(w.process_name)
  );

  if (visibleWindows.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-content-muted">
        <div className="text-center">
          <p className="text-lg mb-2">{t("grid.empty.title")}</p>
          <p className="text-sm">{t("grid.empty.hint")}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex-1 overflow-auto p-4"
      onWheel={handleWheel}
    >
      <div
        className="grid gap-4 auto-rows-min"
        style={{
          gridTemplateColumns: `repeat(auto-fill, minmax(${cardWidth}px, 1fr))`,
        }}
      >
        {visibleWindows.map((w) => (
          <WindowCard
            key={w.title}
            title={w.title}
            processName={w.process_name}
            imageBase64={captures.get(w.title)}
            isCapturing={activeCaptures.has(w.title)}
            onDoubleClick={() => onBringToFront(w.title)}
          />
        ))}
      </div>
    </div>
  );
}
