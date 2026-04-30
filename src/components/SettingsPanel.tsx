import type { WindowInfo, AppConfig } from "../types";
import { Eye, EyeOff, X, Monitor, MonitorOff } from "lucide-react";

interface SettingsPanelProps {
  windows: WindowInfo[];
  config: AppConfig;
  activeCaptures: Set<string>;
  onStartCapture: (title: string) => void;
  onStopCapture: (title: string) => void;
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
    <div className="w-72 bg-gray-800 border-l border-gray-700 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <h2 className="text-sm font-semibold">Window Filter</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
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
              className="flex items-center gap-2 px-4 py-2 border-b border-gray-700/50 hover:bg-gray-700/50"
            >
              <button
                onClick={() => isActive ? onStopCapture(w.title) : onStartCapture(w.title)}
                className="text-gray-400 hover:text-white transition-colors"
                title={isActive ? "Stop monitoring" : "Start monitoring"}
              >
                {isActive ? <Monitor size={16} className="text-green-400" /> : <MonitorOff size={16} />}
              </button>

              <button
                onClick={() => toggleHidden(w.process_name)}
                className="text-gray-400 hover:text-white transition-colors"
                title={isHidden ? "Show in grid" : "Hide from grid"}
              >
                {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>

              <div className="flex-1 min-w-0">
                <div className="text-sm truncate" title={w.title}>{w.title}</div>
                <div className="text-xs text-gray-500 truncate">{w.process_name}</div>
              </div>
            </div>
          );
        })}
      </div>

      {windows.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm p-4">
          No windows found
        </div>
      )}
    </div>
  );
}
