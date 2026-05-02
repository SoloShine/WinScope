import { useCallback, useMemo, useState } from "react";
import type { WindowInfo } from "../types";
import { WindowCard } from "./WindowCard";
import { useTranslation } from "../i18n/index.tsx";

export const MIN_WIDTH = 120;
export const MAX_WIDTH = 720;
export const ZOOM_STEP = 30;
export const DEFAULT_WIDTH = 260;
const STORAGE_KEY = "winscope-card-width";

export function getSavedWidth(): number {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const n = parseInt(saved, 10);
      if (n >= MIN_WIDTH && n <= MAX_WIDTH) return n;
    }
  } catch {}
  return DEFAULT_WIDTH;
}

interface WindowGridProps {
  windows: WindowInfo[];
  captures: Map<string, string>;
  activeCaptures: Set<string>;
  minimizedWindows: Set<string>;
  hiddenWindows: string[];
  windowTags: Record<string, string[]>;
  forceCaptureMinimized: Record<string, boolean>;
  cardWidth: number;
  setCardWidth: (updater: number | ((prev: number) => number)) => void;
  onBringToFront: (title: string) => void;
  onCardHover?: (title: string | null) => void;
  onShowHistory?: (title: string) => void;
  onToggleForceCapture?: (title: string, enabled: boolean) => void;
}

export function WindowGrid({
  windows,
  captures,
  activeCaptures,
  minimizedWindows,
  hiddenWindows,
  windowTags,
  forceCaptureMinimized,
  cardWidth: _cardWidth,
  setCardWidth,
  onBringToFront,
  onCardHover,
  onShowHistory,
  onToggleForceCapture,
}: WindowGridProps) {
  void _cardWidth;
  const { t } = useTranslation();
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      setCardWidth((w: number) => Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, w + delta)));
    }
  }, [setCardWidth]);

  const activeWindows = windows.filter(
    (w) =>
      activeCaptures.has(w.title) &&
      !hiddenWindows.includes(w.process_name)
  );

  // Collect all unique tags from visible windows
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const w of activeWindows) {
      const tags = windowTags[w.process_name];
      if (tags) {
        for (const tag of tags) tagSet.add(tag);
      }
    }
    return Array.from(tagSet).sort();
  }, [activeWindows, windowTags]);

  // Filter by selected tag
  const visibleWindows = activeTag
    ? activeWindows.filter(
        (w) => {
          const tags = windowTags[w.process_name];
          return tags && tags.includes(activeTag);
        }
      )
    : activeWindows;

  if (activeWindows.length === 0) {
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
      {allTags.length > 0 && (
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          <button
            onClick={() => setActiveTag(null)}
            className={`px-2 py-0.5 rounded text-xs transition-colors ${
              activeTag === null
                ? "bg-blue-600 text-white"
                : "bg-surface-alt border border-border text-content-muted hover:text-content"
            }`}
          >
            {t("grid.allTags")}
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={`px-2 py-0.5 rounded text-xs transition-colors ${
                activeTag === tag
                  ? "bg-blue-600 text-white"
                  : "bg-surface-alt border border-border text-content-muted hover:text-content"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}
      <div
        className="grid gap-4 auto-rows-min"
        style={{
          gridTemplateColumns: "repeat(auto-fill, var(--card-width, 260px))",
        }}
      >
        {visibleWindows.map((w) => (
          <WindowCard
            key={w.title}
            title={w.title}
            processName={w.process_name}
            imageBase64={captures.get(w.title)}
            isCapturing={activeCaptures.has(w.title)}
            isMinimized={minimizedWindows.has(w.title)}
            forceCaptureMinimized={forceCaptureMinimized[w.title] ?? false}
            onDoubleClick={() => onBringToFront(w.title)}
            onHover={onCardHover}
            onShowHistory={onShowHistory}
            onToggleForceCapture={onToggleForceCapture}
          />
        ))}
      </div>
    </div>
  );
}
