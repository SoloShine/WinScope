import { useState, useCallback, useRef } from "react";
import type { WindowInfo } from "../types";
import { WindowCard } from "./WindowCard";
import { useTranslation } from "../i18n/index.tsx";

const MIN_COLS = 2;
const MAX_COLS = 8;
const STORAGE_KEY = "winscope-grid-cols";

function getSavedCols(): number {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const n = parseInt(saved, 10);
      if (n >= MIN_COLS && n <= MAX_COLS) return n;
    }
  } catch {}
  return 4;
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
  const [cols, setCols] = useState(getSavedCols);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setCols((prev) => {
          const delta = e.deltaY > 0 ? 1 : -1;
          const next = Math.max(MIN_COLS, Math.min(MAX_COLS, prev + delta));
          if (next !== prev) {
            try {
              localStorage.setItem(STORAGE_KEY, String(next));
            } catch {}
          }
          return next;
        });
      }
    },
    []
  );

  const visibleWindows = windows.filter(
    (w) =>
      activeCaptures.has(w.title) &&
      !hiddenWindows.includes(w.process_name)
  );

  if (visibleWindows.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <p className="text-lg mb-2">{t("grid.empty.title")}</p>
          <p className="text-sm">{t("grid.empty.hint")}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto p-4"
      onWheel={handleWheel}
    >
      <div
        className="grid gap-4 auto-rows-min"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
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
