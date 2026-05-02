import { useMemo } from "react";
import type { HistoryEntry } from "../types";

interface HistoryTimelineProps {
  entries: HistoryEntry[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
}

export function HistoryTimeline({
  entries,
  currentIndex,
  onIndexChange,
}: HistoryTimelineProps) {
  const timestamps = useMemo(() => {
    return entries.map((entry) => {
      const date = new Date(entry.timestamp);
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    });
  }, [entries]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    onIndexChange(value);
  };

  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1 mt-2">
      <div className="flex justify-between text-xs text-content-muted">
        <span>{timestamps[timestamps.length - 1]}</span>
        <span>{timestamps[0]}</span>
      </div>
      <input
        type="range"
        min={0}
        max={entries.length - 1}
        value={currentIndex === -1 ? entries.length - 1 : currentIndex}
        onChange={handleChange}
        className="w-full h-1.5 bg-surface-alt rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
      />
      <div className="text-center text-xs text-content-muted">
        {currentIndex === -1
          ? "实时"
          : timestamps[currentIndex]}
      </div>
    </div>
  );
}
