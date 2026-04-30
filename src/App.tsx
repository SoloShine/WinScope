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

// DEFAULT_WIDTH, ZOOM_STEP used by keyboard shortcuts (Task 2)
void DEFAULT_WIDTH;
void ZOOM_STEP;
import { Toolbar } from "./components/Toolbar";
import { SettingsPanel } from "./components/SettingsPanel";
import { useTranslation } from "./i18n/index.tsx";
import { useTheme } from "./theme.tsx";
import { invoke } from "@tauri-apps/api/core";

function App() {
  const capture = useCapture();
  const [showSettings, setShowSettings] = useState(false);
  const [cardWidth, setCardWidthRaw] = useState(getSavedWidth);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // isFullscreen / setIsFullscreen used by keyboard shortcuts (Task 2)
  void isFullscreen;
  void setIsFullscreen;
  const { t } = useTranslation();
  const { theme } = useTheme();

  const setCardWidth = (width: number) => {
    const clamped = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width));
    setCardWidthRaw(clamped);
    try {
      localStorage.setItem("winscope-card-width", String(clamped));
    } catch {}
  };

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
