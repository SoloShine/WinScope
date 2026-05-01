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
import { saveImage } from "./components/WindowCard";

import { Toolbar } from "./components/Toolbar";
import { SettingsPanel } from "./components/SettingsPanel";
import { useTranslation } from "./i18n/index.tsx";
import { useTheme } from "./theme.tsx";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";
import { Maximize, Minimize, Plus, Minus, RotateCcw } from "lucide-react";

function applyZoom(width: number) {
  document.documentElement.style.setProperty("--card-width", `${width}px`);
}

function App() {
  const capture = useCapture();
  const [showSettings, setShowSettings] = useState(false);
  const [cardWidth, setCardWidthRaw] = useState(getSavedWidth);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { t } = useTranslation();
  const { theme } = useTheme();

  // Live width ref — updated immediately, React state syncs after debounce
  const liveWidthRef = useRef(cardWidth);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync CSS variable on mount
  useEffect(() => {
    applyZoom(cardWidth);
  }, []);

  const setCardWidth = useCallback((updater: number | ((prev: number) => number)) => {
    const raw = typeof updater === "function" ? updater(liveWidthRef.current) : updater;
    const clamped = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, raw));
    liveWidthRef.current = clamped;
    // Update visual IMMEDIATELY via CSS variable — no React re-render
    applyZoom(clamped);
    // Debounce React state sync (for button disabled states + localStorage)
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      setCardWidthRaw(clamped);
      try {
        localStorage.setItem("winscope-card-width", String(clamped));
      } catch {}
    }, 150);
  }, []);

  // Refs for keydown listener
  const pausedRef = useRef(capture.paused);
  const configRef = useRef(capture.config);
  const isFullscreenRef = useRef(isFullscreen);
  const hoveredCardRef = useRef<string | null>(null);
  const capturesRef = useRef(capture.captures);

  pausedRef.current = capture.paused;
  configRef.current = capture.config;
  isFullscreenRef.current = isFullscreen;
  capturesRef.current = capture.captures;

  // Keyboard shortcuts — registered once
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === " " && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        capture.setPaused(!pausedRef.current);
        return;
      }

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

      if (e.key.toLowerCase() === "g" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setShowSettings((prev) => !prev);
        return;
      }

      if (e.key === "Escape") {
        setShowSettings(false);
        return;
      }

      if (e.key.toLowerCase() === "i" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        setCardWidth((w) => w + ZOOM_STEP);
        return;
      }

      if (e.key.toLowerCase() === "d" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        setCardWidth((w) => w - ZOOM_STEP);
        return;
      }

      if (e.key.toLowerCase() === "r" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        setCardWidth(DEFAULT_WIDTH);
        return;
      }

      if (e.key === "F11") {
        e.preventDefault();
        const next = !isFullscreenRef.current;
        setIsFullscreen(next);
        getCurrentWebviewWindow().setFullscreen(next);
        return;
      }

      if (e.key.toLowerCase() === "s" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const hovered = hoveredCardRef.current;
        if (hovered) {
          const img = capturesRef.current.get(hovered);
          if (img) {
            saveImage(hovered, img).catch(console.error);
          }
        }
        return;
      }

      if (e.key.toLowerCase() === "f" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        return;
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [capture.setPaused, capture.updateConfig, setCardWidth]);

  // Global hotkeys (work even when app is not focused)
  useEffect(() => {
    const setup = async () => {
      try {
        // Ctrl+Shift+M: toggle show/hide window
        await register("CommandOrControl+Shift+M", async () => {
          const win = getCurrentWebviewWindow();
          if (await win.isMinimized()) {
            await win.unminimize();
            await win.setFocus();
          } else {
            await win.minimize();
          }
        });

        // Ctrl+Shift+Space: toggle pause/resume captures
        await register("CommandOrControl+Shift+Space", () => {
          capture.setPaused(!pausedRef.current);
        });
      } catch (e) {
        console.error("Failed to register global shortcuts:", e);
      }
    };
    setup();
    return () => {
      unregister("CommandOrControl+Shift+M").catch(() => {});
      unregister("CommandOrControl+Shift+Space").catch(() => {});
    };
  }, [capture.setPaused]);

  // Sync title bar theme
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
          windowTags={capture.config.window_tags}
          cardWidth={cardWidth}
          setCardWidth={setCardWidth}
          onBringToFront={capture.bringToFront}
          onCardHover={(title) => { hoveredCardRef.current = title; }}
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
            onPointerDown={(e) => {
              e.preventDefault();
              const next = !isFullscreen;
              setIsFullscreen(next);
              getCurrentWebviewWindow().setFullscreen(next);
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
            onPointerDown={(e) => {
              e.preventDefault();
              setCardWidth((w) => w - ZOOM_STEP);
            }}
            className="p-1.5 rounded bg-surface-alt/80 border border-border text-content-muted hover:text-content hover:bg-surface transition-colors"
            style={{ opacity: liveWidthRef.current <= MIN_WIDTH ? 0.3 : undefined }}
            title={t("controls.zoomOut")}
          >
            <Minus size={14} />
          </button>
          <button
            tabIndex={-1}
            onPointerDown={(e) => {
              e.preventDefault();
              setCardWidth(DEFAULT_WIDTH);
            }}
            className="p-1.5 rounded bg-surface-alt/80 border border-border text-content-muted hover:text-content hover:bg-surface transition-colors"
            title={t("controls.zoomReset")}
          >
            <RotateCcw size={14} />
          </button>
          <button
            tabIndex={-1}
            onPointerDown={(e) => {
              e.preventDefault();
              setCardWidth((w) => w + ZOOM_STEP);
            }}
            className="p-1.5 rounded bg-surface-alt/80 border border-border text-content-muted hover:text-content hover:bg-surface transition-colors"
            style={{ opacity: liveWidthRef.current >= MAX_WIDTH ? 0.3 : undefined }}
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
