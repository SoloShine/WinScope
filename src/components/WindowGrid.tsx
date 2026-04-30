import type { WindowInfo } from "../types";
import { WindowCard } from "./WindowCard";

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
  const visibleWindows = windows.filter(
    (w) =>
      activeCaptures.has(w.title) &&
      !hiddenWindows.includes(w.process_name)
  );

  if (visibleWindows.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <p className="text-lg mb-2">No windows being monitored</p>
          <p className="text-sm">
            Open the settings panel and select windows to monitor
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 auto-rows-min">
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
