import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Monitor } from "lucide-react";
import type { MonitorInfo } from "../types";
import { useTranslation } from "../i18n/index.tsx";

interface MonitorSelectorProps {
  enabledMonitors: string[];
  onUpdate: (monitorIds: string[]) => void;
}

export function MonitorSelector({
  enabledMonitors,
  onUpdate,
}: MonitorSelectorProps) {
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();

  useEffect(() => {
    async function loadMonitors() {
      try {
        const monitorList = await invoke<MonitorInfo[]>("get_monitors");
        setMonitors(monitorList);
      } catch (e) {
        console.error("Failed to load monitors:", e);
      } finally {
        setLoading(false);
      }
    }
    loadMonitors();
  }, []);

  const handleToggle = useCallback(
    (monitorId: string) => {
      const newEnabled = enabledMonitors.includes(monitorId)
        ? enabledMonitors.filter((id) => id !== monitorId)
        : [...enabledMonitors, monitorId];
      onUpdate(newEnabled);
    },
    [enabledMonitors, onUpdate]
  );

  if (loading) {
    return <div className="text-content-muted">{t("monitors.loading")}</div>;
  }

  if (monitors.length === 0) {
    return <div className="text-content-muted">{t("monitors.notFound")}</div>;
  }

  return (
    <div className="space-y-2" data-testid="monitor-selector">
      <h4 className="text-sm font-medium text-content">{t("monitors.title")}</h4>
      <div className="grid grid-cols-2 gap-2">
        {monitors.map((monitor) => (
          <button
            key={monitor.id}
            data-testid="monitor-button"
            onClick={() => handleToggle(monitor.id)}
            className={`p-3 rounded-lg border transition-colors ${
              enabledMonitors.includes(monitor.id)
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-surface-alt text-content-muted hover:border-primary/50"
            }`}
          >
            <div className="flex items-center gap-2">
              <Monitor size={16} />
              <div className="text-left">
                <div className="text-sm font-medium">
                  {monitor.isPrimary ? t("monitors.primary") : monitor.name}
                </div>
                <div className="text-xs opacity-75">
                  {monitor.rect.width}x{monitor.rect.height}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
