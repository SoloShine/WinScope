import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { WindowInfo, CapturePayload, AppConfig } from "../types";

export function useCapture() {
  const [windows, setWindows] = useState<WindowInfo[]>([]);
  const [captures, setCaptures] = useState<Map<string, string>>(new Map());
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [activeCaptures, setActiveCaptures] = useState<Set<string>>(new Set());
  const [paused, setPaused] = useState(false);

  // Load initial data
  useEffect(() => {
    async function load() {
      try {
        const [windowList, appConfig] = await Promise.all([
          invoke<WindowInfo[]>("get_windows"),
          invoke<AppConfig>("get_config"),
        ]);
        setWindows(windowList);
        setConfig(appConfig);
      } catch (e) {
        console.error("Failed to load initial data:", e);
      }
    }
    load();
  }, []);

  // Listen for capture updates
  useEffect(() => {
    const unlisten = listen<CapturePayload>("capture-update", (event) => {
      if (!paused) {
        setCaptures((prev) => {
          const next = new Map(prev);
          next.set(event.payload.title, event.payload.image);
          return next;
        });
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [paused]);

  // Refresh window list periodically
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const windowList = await invoke<WindowInfo[]>("get_windows");
        setWindows(windowList);
      } catch {
        // Window enumeration might fail transiently
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const startCapture = useCallback(async (title: string) => {
    try {
      await invoke("start_capture", { windowTitle: title });
      setActiveCaptures((prev) => new Set(prev).add(title));
    } catch (e) {
      console.error("Failed to start capture:", e);
    }
  }, []);

  const stopCapture = useCallback(async (title: string) => {
    try {
      await invoke("stop_capture", { windowTitle: title });
      setActiveCaptures((prev) => {
        const next = new Set(prev);
        next.delete(title);
        return next;
      });
      setCaptures((prev) => {
        const next = new Map(prev);
        next.delete(title);
        return next;
      });
    } catch (e) {
      console.error("Failed to stop capture:", e);
    }
  }, []);

  const bringToFront = useCallback(async (title: string) => {
    try {
      await invoke("bring_to_front", { windowTitle: title });
    } catch (e) {
      console.error("Failed to bring to front:", e);
    }
  }, []);

  const updateConfig = useCallback(async (newConfig: AppConfig) => {
    try {
      await invoke("update_config", { config: newConfig });
      setConfig(newConfig);
    } catch (e) {
      console.error("Failed to update config:", e);
    }
  }, []);

  return {
    windows,
    captures,
    config,
    activeCaptures,
    paused,
    setPaused,
    startCapture,
    stopCapture,
    bringToFront,
    updateConfig,
  };
}
