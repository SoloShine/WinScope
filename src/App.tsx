import { useState, useEffect } from "react";
import { useCapture } from "./hooks/useCapture";
import {
  WindowGrid,
  getSavedWidth,
  DEFAULT_WIDTH,
  MIN_WIDTH,
  MAX_WIDTH,
  ZOOM_STEP,
} from "./components/WindowGrid";

import { Toolbar } from "./components/Toolbar";
import { SettingsPanel } from "./components/SettingsPanel";
import { useTranslation } from "./i18n/index.tsx";
import { useTheme } from "./theme.tsx";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

function App() {
  const capture = useCapture();
  const [showSettings, setShowSettings] = useState(false);
  const [cardWidth, setCardWidthRaw] = useState(getSavedWidth);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { t } = useTranslation();
  const { theme } = useTheme();

  const setCardWidth = (width: number) => {
    const clamped = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width));
    setCardWidthRaw(clamped);
    try {
      localStorage.setItem("winscope-card-width", String(clamped));
    } catch {}
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      // Space — pause/resume
      if (e.key === " " && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        capture.setPaused(!capture.paused);
        return;
      }

      // Ctrl+P — toggle always-on-top
      if (e.key.toLowerCase() === "p" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (capture.config) {
          const newOnTop = !capture.config.always_on_top;
          getCurrentWebviewWindow().setAlwaysOnTop(newOnTop);
          capture.updateConfig({ ...capture.config, always_on_top: newOnTop });
        }
        return;
      }

      // Ctrl+G — toggle settings panel
      if (e.key.toLowerCase() === "g" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setShowSettings((prev) => !prev);
        return;
      }

      // Escape — close settings panel
      if (e.key === "Escape") {
        setShowSettings(false);
        return;
      }

      // Ctrl+= — zoom in
      if (e.key === "=" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setCardWidth(cardWidth + ZOOM_STEP);
        return;
      }

      // Ctrl+- — zoom out
      if (e.key === "-" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setCardWidth(cardWidth - ZOOM_STEP);
        return;
      }

      // Ctrl+0 — reset zoom
      if (e.key === "0" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setCardWidth(DEFAULT_WIDTH);
        return;
      }

      // F11 — toggle fullscreen
      if (e.key === "F11") {
        e.preventDefault();
        const next = !isFullscreen;
        setIsFullscreen(next);
        getCurrentWebviewWindow().setFullscreen(next);
        return;
      }

      // Ctrl+S — reserved (prevent browser save)
      if (e.key.toLowerCase() === "s" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        return;
      }

      // Ctrl+F — reserved (prevent browser find)
      if (e.key.toLowerCase() === "f" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        return;
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [capture.paused, capture.config, cardWidth, isFullscreen]);

  // Sync title bar theme on mount and theme change
  useEffect(() => {
    invoke("set_title_bar_theme", { dark: theme === "dark" }).catch(() => {});
  }, [theme]);

  if (!capture.config) {
    return (
      <div className="h-full flex items-center justify-center text-content-muted">{t("loading")}</div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-surface text-content">
      <Toolbar
        paused={capture.paused}
        setPaused={capture.setPaused}
        config={capture.config}
        onUpdateConfig={capture.updateConfig}
        onToggleSettings={() => setShowSettings(!showSettings)}
      />
      <div className="flex-1 flex overflow-hidden">
        <WindowGrid
          windows={capture.windows}
          captures={capture.captures}
          activeCaptures={capture.activeCaptures}
          hiddenWindows={capture.config.hidden_windows}
          cardWidth={cardWidth}
          setCardWidth={setCardWidth}
          onBringToFront={capture.bringToFront}
        />
        {showSettings && (
          <SettingsPanel
            windows={capture.windows}
            config={capture.config}
            activeCaptures={capture.activeCaptures}
            onStartCapture={capture.startCapture}
            onStopCapture={capture.stopCapture}
            onUpdateConfig={capture.updateConfig}
            onClose={() => setShowSettings(false)}
          />
        )}
      </div>
    </div>
  );
}

export default App;
