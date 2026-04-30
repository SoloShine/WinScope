import type { WindowInfo, AppConfig } from "../types";
import { Eye, EyeOff, X, Monitor, MonitorOff } from "lucide-react";
import { useTranslation } from "../i18n/index.tsx";

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

  return (
    <div className="w-72 bg-surface-alt border-l border-border flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold">{t("settings.title")}</h2>
        <button onClick={onClose} className="text-content-muted hover:text-content transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {windows.map((w) => {
          const isActive = activeCaptures.has(w.title);
          const isHidden = config.hidden_windows.includes(w.process_name);

          return (
            <div
              key={w.title}
              className="flex items-center gap-2 px-4 py-2 border-b border-border/50 hover:bg-surface"
            >
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
          );
        })}
      </div>

      {windows.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-content-muted text-sm p-4">
          {t("settings.noWindows")}
        </div>
      )}
    </div>
  );
}
