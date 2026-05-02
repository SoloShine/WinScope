import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import type { WindowInfo, CapturePayload, AppConfig } from "../types";
import { useHistory } from "./useHistory";

export function useCapture() {
  const [windows, setWindows] = useState<WindowInfo[]>([]);
  const [captures, setCaptures] = useState<Map<string, string>>(new Map());
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [activeCaptures, setActiveCaptures] = useState<Set<string>>(new Set());
  const [paused, setPaused] = useState(false);

  const history = useHistory();

  const configRef = useRef(config);
  const activeCapturesRef = useRef(activeCaptures);
  configRef.current = config;
  activeCapturesRef.current = activeCaptures;

  // Filter windows by enabled monitors
  const filteredWindows = windows.filter((w) => {
    if (!config || config.enabled_monitors.length === 0) {
      return true; // No filter applied
    }
    return config.enabled_monitors.includes(w.monitor_id);
  });

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

        // Apply always-on-top from config
        if (appConfig.always_on_top) {
          getCurrentWebviewWindow().setAlwaysOnTop(true);
        }

        // Auto-start captures for monitored windows
        if (appConfig.monitored_windows.length > 0) {
          const savedNames = new Set(appConfig.monitored_windows);
          const matches = windowList.filter((w) => savedNames.has(w.process_name));
          for (const w of matches) {
            try {
              await invoke("start_capture", { windowTitle: w.title });
              setActiveCaptures((prev) => new Set(prev).add(w.title));
            } catch {
              // Window might not exist anymore
            }
          }
        }
      } catch (e) {
        console.error("Failed to load initial data:", e);
      }
    }
    load();
  }, []);

  // Listen for capture-closed events from Rust
  useEffect(() => {
    const unlisten = listen<string>("capture-closed", (event) => {
      const title = event.payload;
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
      // Clear history when window is closed
      history.clearHistory(title);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [history.clearHistory]);

  // Listen for capture updates
  useEffect(() => {
    const unlisten = listen<CapturePayload>("capture-update", (event) => {
      if (!paused) {
        const { title, image } = event.payload;
        setCaptures((prev) => {
          const next = new Map(prev);
          next.set(title, image);
          return next;
        });
        // Add to history
        history.addEntry(title, image);
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [paused, history.addEntry]);

  // Refresh window list periodically + auto-start matching captures
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const windowList = await invoke<WindowInfo[]>("get_windows");
        setWindows(windowList);

        // Auto-start captures for new windows matching monitored_windows
        const cfg = configRef.current;
        if (cfg && cfg.monitored_windows.length > 0) {
          const monitored = new Set(cfg.monitored_windows);
          const active = activeCapturesRef.current;
          for (const w of windowList) {
            if (monitored.has(w.process_name) && !active.has(w.title)) {
              try {
                await invoke("start_capture", { windowTitle: w.title });
                setActiveCaptures((prev) => new Set(prev).add(w.title));
              } catch {
                // Window might not support capture
              }
            }
          }
        }
      } catch {
        // Window enumeration might fail transiently
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const startCapture = useCallback(async (title: string, processName: string) => {
    try {
      await invoke("start_capture", { windowTitle: title });
      setActiveCaptures((prev) => new Set(prev).add(title));
      if (config && !config.monitored_windows.includes(processName)) {
        const newConfig = {
          ...config,
          monitored_windows: [...config.monitored_windows, processName],
        };
        await invoke("update_config", { config: newConfig });
        setConfig(newConfig);
      }
    } catch (e) {
      console.error("Failed to start capture:", e);
    }
  }, [config]);

  const stopCapture = useCallback(async (title: string, processName: string) => {
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
      if (config) {
        const newConfig = {
          ...config,
          monitored_windows: config.monitored_windows.filter((p) => p !== processName),
        };
        await invoke("update_config", { config: newConfig });
        setConfig(newConfig);
      }
    } catch (e) {
      console.error("Failed to stop capture:", e);
    }
  }, [config]);

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
    windows: filteredWindows,
    captures,
    config,
    activeCaptures,
    paused,
    setPaused,
    startCapture,
    stopCapture,
    bringToFront,
    updateConfig,
    history,
  };
}
