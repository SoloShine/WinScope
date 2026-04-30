import type { AppConfig } from "../types";
import { Pin, PinOff, Settings, Pause, Play, RotateCcw, Languages, Sun, Moon } from "lucide-react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useTranslation } from "../i18n/index.tsx";
import { useTheme } from "../theme.tsx";

interface ToolbarProps {
  paused: boolean;
  setPaused: (paused: boolean) => void;
  config: AppConfig;
  onUpdateConfig: (config: AppConfig) => void;
  onToggleSettings: () => void;
}

const INTERVALS = [
  { key: "interval.1s", value: 1000 },
  { key: "interval.1.5s", value: 1500 },
  { key: "interval.2s", value: 2000 },
  { key: "interval.3s", value: 3000 },
];

export function Toolbar({ paused, setPaused, config, onUpdateConfig, onToggleSettings }: ToolbarProps) {
  const { t, toggleLocale } = useTranslation();
  const { theme, toggleTheme } = useTheme();

  const toggleAlwaysOnTop = async () => {
    const newOnTop = !config.always_on_top;
    const appWindow = getCurrentWebviewWindow();
    await appWindow.setAlwaysOnTop(newOnTop);
    onUpdateConfig({ ...config, always_on_top: newOnTop });
  };

  const setRefreshInterval = (ms: number) => {
    onUpdateConfig({ ...config, refresh_interval_ms: ms });
  };

  const handleToggleTheme = async () => {
    toggleTheme();
    const newTheme = theme === "dark" ? "light" : "dark";
    try {
      await getCurrentWebviewWindow().setTheme(newTheme === "dark" ? "dark" : "light");
    } catch {}
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-surface-alt border-b border-border">
      <button
        onClick={toggleAlwaysOnTop}
        className={`flex items-center gap-1 px-2 py-1 rounded text-sm transition-colors ${
          config.always_on_top ? "bg-blue-600 text-white" : "text-content-muted hover:text-content hover:bg-surface"
        }`}
      >
        {config.always_on_top ? <PinOff size={14} /> : <Pin size={14} />}
        {config.always_on_top ? t("toolbar.pinned") : t("toolbar.pin")}
      </button>

      <button
        onClick={() => setPaused(!paused)}
        className={`flex items-center gap-1 px-2 py-1 rounded text-sm transition-colors ${
          paused ? "bg-yellow-600 text-white" : "text-content-muted hover:text-content hover:bg-surface"
        }`}
      >
        {paused ? <Play size={14} /> : <Pause size={14} />}
        {paused ? t("toolbar.resume") : t("toolbar.pause")}
      </button>

      <div className="flex items-center gap-1 ml-2">
        <RotateCcw size={14} className="text-content-muted" />
        {INTERVALS.map(({ key, value }) => (
          <button
            key={value}
            onClick={() => setRefreshInterval(value)}
            className={`px-2 py-1 rounded text-xs transition-colors ${
              config.refresh_interval_ms === value ? "bg-blue-600 text-white" : "text-content-muted hover:text-content hover:bg-surface"
            }`}
          >
            {t(key)}
          </button>
        ))}
      </div>

      <div className="flex-1" />

      <button
        onClick={handleToggleTheme}
        className="text-content-muted hover:text-content transition-colors flex items-center gap-1 text-xs"
        title={theme === "dark" ? t("toolbar.theme.light") : t("toolbar.theme.dark")}
      >
        {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        {theme === "dark" ? t("toolbar.theme.light") : t("toolbar.theme.dark")}
      </button>

      <button
        onClick={toggleLocale}
        className="text-content-muted hover:text-content transition-colors flex items-center gap-1 text-xs"
        title={t("toolbar.lang")}
      >
        <Languages size={14} />
        {t("toolbar.lang")}
      </button>

      <button onClick={onToggleSettings} className="text-content-muted hover:text-content transition-colors" title={t("toolbar.settings")}>
        <Settings size={18} />
      </button>
    </div>
  );
}
