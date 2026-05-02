import { useMemo, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { WindowInfo, AppConfig } from "../types";
import { Eye, EyeOff, X, Monitor, MonitorOff, Tag, Plus } from "lucide-react";
import { useTranslation } from "../i18n/index.tsx";
import { MonitorSelector } from "./MonitorSelector";

interface SettingsPanelProps {
  windows: WindowInfo[];
  config: AppConfig;
  activeCaptures: Set<string>;
  onStartCapture: (title: string, processName: string) => void;
  onStopCapture: (title: string, processName: string) => void;
  onUpdateConfig: (config: AppConfig) => void;
  onClose: () => void;
}

export function SettingsPanel({
  windows,
  config,
  activeCaptures,
  onStartCapture,
  onStopCapture,
  onUpdateConfig,
  onClose,
}: SettingsPanelProps) {
  const { t } = useTranslation();

  // Filter windows by enabled monitors
  const filteredWindows = windows.filter((w) => {
    if (config.enabled_monitors.length === 0) {
      return true; // No filter applied
    }
    return config.enabled_monitors.includes(w.monitor_id);
  });

  // Handle monitor selection update
  const handleMonitorUpdate = useCallback(
    async (monitorIds: string[]) => {
      try {
        await invoke("update_enabled_monitors", { monitorIds });
        onUpdateConfig({
          ...config,
          enabled_monitors: monitorIds,
        });
      } catch (e) {
        console.error("Failed to update enabled monitors:", e);
      }
    },
    [config, onUpdateConfig]
  );

  const toggleHidden = (processName: string) => {
    const newConfig = { ...config };
    if (newConfig.hidden_windows.includes(processName)) {
      newConfig.hidden_windows = newConfig.hidden_windows.filter(
        (p) => p !== processName
      );
    } else {
      newConfig.hidden_windows = [...newConfig.hidden_windows, processName];
    }
    onUpdateConfig(newConfig);
  };

  const toggleTag = (processName: string, tag: string) => {
    const current = config.window_tags[processName] || [];
    const next = current.includes(tag)
      ? current.filter((t) => t !== tag)
      : [...current, tag];
    const newConfig = { ...config, window_tags: { ...config.window_tags } };
    if (next.length > 0) {
      newConfig.window_tags[processName] = next;
    } else {
      delete newConfig.window_tags[processName];
    }
    onUpdateConfig(newConfig);
  };

  const addCustomTag = (processName: string, value: string) => {
    const tag = value.trim();
    if (!tag) return;
    const current = config.window_tags[processName] || [];
    if (current.includes(tag)) return;
    const newConfig = {
      ...config,
      window_tags: { ...config.window_tags, [processName]: [...current, tag] },
    };
    onUpdateConfig(newConfig);
  };

  // Collect all existing tags across all windows
  const allExistingTags = useMemo(() => {
    const set = new Set<string>();
    for (const tags of Object.values(config.window_tags)) {
      for (const tag of tags) set.add(tag);
    }
    return Array.from(set).sort();
  }, [config.window_tags]);

  return (
    <div className="w-72 bg-surface-alt border-l border-border flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold">{t("settings.title")}</h2>
        <button onClick={onClose} className="text-content-muted hover:text-content transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {/* Monitor Selector */}
        <div className="px-4 py-3 border-b border-border">
          <MonitorSelector
            enabledMonitors={config.enabled_monitors}
            onUpdate={handleMonitorUpdate}
          />
        </div>

        {/* Window List */}
        {filteredWindows.map((w) => {
          const isActive = activeCaptures.has(w.title);
          const isHidden = config.hidden_windows.includes(w.process_name);
          const windowTags = config.window_tags[w.process_name] || [];

          return (
            <div
              key={w.title}
              className="px-4 py-2 border-b border-border/50 hover:bg-surface"
            >
              <div className="flex items-center gap-2">
                <button
                  onClick={() => isActive ? onStopCapture(w.title, w.process_name) : onStartCapture(w.title, w.process_name)}
                  className="text-content-muted hover:text-content transition-colors"
                  title={isActive ? t("settings.stopMonitor") : t("settings.startMonitor")}
                >
                  {isActive ? <Monitor size={16} className="text-green-500" /> : <MonitorOff size={16} />}
                </button>

                <button
                  onClick={() => toggleHidden(w.process_name)}
                  className="text-content-muted hover:text-content transition-colors"
                  title={isHidden ? t("settings.showInGrid") : t("settings.hideFromGrid")}
                >
                  {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate" title={w.title}>{w.title}</div>
                  <div className="text-xs text-content-muted truncate">{w.process_name}</div>
                </div>
              </div>
              {/* Tag chips — click to toggle */}
              {allExistingTags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1 ml-8">
                  {allExistingTags.map((tag) => {
                    const active = windowTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() => toggleTag(w.process_name, tag)}
                        className={`px-1.5 py-0.5 rounded text-xs transition-colors ${
                          active
                            ? "bg-blue-600 text-white"
                            : "bg-surface border border-border text-content-muted hover:text-content"
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              )}
              {/* Add new tag input */}
              <div className="flex items-center gap-1 mt-1 ml-8">
                <Tag size={12} className="text-content-muted shrink-0" />
                <input
                  type="text"
                  placeholder={t("settings.tagPlaceholder")}
                  className="flex-1 min-w-0 px-1 py-0.5 text-xs bg-transparent border border-border rounded
                             text-content placeholder:text-content-muted/50 focus:outline-none focus:border-blue-500"
                  onKeyDown={(e) => {
                    if ((e.nativeEvent as unknown as { isComposing?: boolean }).isComposing) return;
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustomTag(w.process_name, (e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).value = "";
                    }
                  }}
                  onBlur={(e) => {
                    if (e.target.value.trim()) {
                      addCustomTag(w.process_name, e.target.value);
                      e.target.value = "";
                    }
                  }}
                />
                <Plus size={12} className="text-content-muted shrink-0" />
              </div>
            </div>
          );
        })}
      </div>

      {filteredWindows.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-content-muted text-sm p-4">
          {t("settings.noWindows")}
        </div>
      )}
    </div>
  );
}
