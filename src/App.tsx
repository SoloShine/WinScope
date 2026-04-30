import { useState, useEffect, useRef, useCallback } from "react";
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
import { Maximize, Minimize, Plus, Minus, RotateCcw } from "lucide-react";

function App() {
  const capture = useCapture();
  const [showSettings, setShowSettings] = useState(false);
  const [cardWidth, setCardWidthRaw] = useState(getSavedWidth);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { t } = useTranslation();
  const { theme } = useTheme();

  // Refs to avoid re-registering keydown listener
  const cardWidthRef = useRef(cardWidth);
  const pausedRef = useRef(capture.paused);
  const configRef = useRef(capture.config);
  const isFullscreenRef = useRef(isFullscreen);

  cardWidthRef.current = cardWidth;
  pausedRef.current = capture.paused;
  configRef.current = capture.config;
  isFullscreenRef.current = isFullscreen;

  // Debounced localStorage write
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setCardWidth = useCallback((updater: number | ((prev: number) => number)) => {
    setCardWidthRaw(prev => {
      const raw = typeof updater === "function" ? updater(prev) : updater;
      const clamped = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, raw));
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        try {
          localStorage.setItem("winscope-card-width", String(clamped));
        } catch {}
      }, 300);
      return clamped;
    });
  }, []);

  // Keyboard shortcuts — registered once, reads refs for current values
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      // Space — pause/resume
      if (e.key === " " && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        capture.setPaused(!pausedRef.current);
        return;
      }

      // Ctrl+P — toggle always-on-top
      if (e.key.toLowerCase() === "p" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const cfg = configRef.current;
        if (cfg) {
          const newOnTop = !cfg.always_on_top;
          getCurrentWebviewWindow().setAlwaysOnTop(newOnTop);
          capture.updateConfig({ ...cfg, always_on_top: newOnTop });
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

      // Ctrl+I — zoom in
      if (e.key.toLowerCase() === "i" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        setCardWidth((w) => w + ZOOM_STEP);
        return;
      }

      // Ctrl+D — zoom out
      if (e.key.toLowerCase() === "d" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        setCardWidth((w) => w - ZOOM_STEP);
        return;
      }

      // Ctrl+R — reset zoom
      if (e.key.toLowerCase() === "r" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        setCardWidth(DEFAULT_WIDTH);
        return;
      }

      // F11 — toggle fullscreen
      if (e.key === "F11") {
        e.preventDefault();
        const next = !isFullscreenRef.current;
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
  }, [capture.setPaused, capture.updateConfig, setCardWidth]);

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
      <div className="flex-1 flex overflow-hidden relative">
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
        {/* Floating buttons */}
        <div className="absolute bottom-3 left-3 flex gap-1 z-20">
          <button
            tabIndex={-1}
            onClick={async () => {
              const next = !isFullscreen;
              setIsFullscreen(next);
              await getCurrentWebviewWindow().setFullscreen(next);
            }}
            className="p-1.5 rounded bg-surface-alt/80 border border-border text-content-muted hover:text-content hover:bg-surface transition-colors"
            title={isFullscreen ? t("controls.exitFullscreen") : t("controls.fullscreen")}
          >
            {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
          </button>
        </div>
        <div className="absolute bottom-3 right-3 flex gap-1 z-20">
          <button
            tabIndex={-1}
            onClick={() => setCardWidth((w) => w - ZOOM_STEP)}
            disabled={cardWidth <= MIN_WIDTH}
            className="p-1.5 rounded bg-surface-alt/80 border border-border text-content-muted hover:text-content hover:bg-surface transition-colors disabled:opacity-30"
            title={t("controls.zoomOut")}
          >
            <Minus size={14} />
          </button>
          <button
            tabIndex={-1}
            onClick={() => setCardWidth(DEFAULT_WIDTH)}
            className="p-1.5 rounded bg-surface-alt/80 border border-border text-content-muted hover:text-content hover:bg-surface transition-colors"
            title={t("controls.zoomReset")}
          >
            <RotateCcw size={14} />
          </button>
          <button
            tabIndex={-1}
            onClick={() => setCardWidth((w) => w + ZOOM_STEP)}
            disabled={cardWidth >= MAX_WIDTH}
            className="p-1.5 rounded bg-surface-alt/80 border border-border text-content-muted hover:text-content hover:bg-surface transition-colors disabled:opacity-30"
            title={t("controls.zoomIn")}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
