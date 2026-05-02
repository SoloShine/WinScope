import { useState, useCallback, useRef } from "react";
import type { HistoryEntry } from "../types";

const MAX_ENTRIES = 20;

export function useHistory() {
  const [histories, setHistories] = useState<Map<string, HistoryEntry[]>>(new Map());
  const [viewingHistory, setViewingHistory] = useState<string | null>(null);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const maxEntriesRef = useRef(MAX_ENTRIES);

  const addEntry = useCallback((title: string, image: string) => {
    const entry: HistoryEntry = {
      timestamp: Date.now(),
      image,
    };

    setHistories((prev) => {
      const next = new Map(prev);
      const entries = next.get(title) || [];
      const newEntries = [entry, ...entries].slice(0, maxEntriesRef.current);
      next.set(title, newEntries);
      return next;
    });
  }, []);

  const clearHistory = useCallback((title: string) => {
    setHistories((prev) => {
      const next = new Map(prev);
      next.delete(title);
      return next;
    });
  }, []);

  const clearAllHistories = useCallback(() => {
    setHistories(new Map());
  }, []);

  const getHistory = useCallback(
    (title: string) => {
      return histories.get(title) || [];
    },
    [histories]
  );

  const startViewing = useCallback((title: string) => {
    setViewingHistory(title);
    setHistoryIndex(-1);
  }, []);

  const stopViewing = useCallback(() => {
    setViewingHistory(null);
    setHistoryIndex(-1);
  }, []);

  const setIndex = useCallback((index: number) => {
    setHistoryIndex(index);
  }, []);

  const getCurrentImage = useCallback(() => {
    if (!viewingHistory || historyIndex === -1) {
      return null;
    }
    const entries = histories.get(viewingHistory) || [];
    if (historyIndex >= 0 && historyIndex < entries.length) {
      return entries[historyIndex].image;
    }
    return null;
  }, [viewingHistory, historyIndex, histories]);

  const isViewing = viewingHistory !== null && historyIndex !== -1;

  return {
    histories,
    viewingHistory,
    historyIndex,
    isViewing,
    addEntry,
    clearHistory,
    clearAllHistories,
    getHistory,
    startViewing,
    stopViewing,
    setIndex,
    getCurrentImage,
  };
}
