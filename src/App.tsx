import { useState } from "react";
import { useCapture } from "./hooks/useCapture";
import { WindowGrid } from "./components/WindowGrid";
import { Toolbar } from "./components/Toolbar";
import { SettingsPanel } from "./components/SettingsPanel";

function App() {
  const capture = useCapture();
  const [showSettings, setShowSettings] = useState(false);

  if (!capture.config) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">Loading...</div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
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
