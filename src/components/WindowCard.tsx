import { useState } from "react";
import { Download } from "lucide-react";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "../i18n/index.tsx";

interface WindowCardProps {
  title: string;
  processName: string;
  imageBase64: string | undefined;
  isCapturing: boolean;
  onDoubleClick: () => void;
  onHover?: (title: string | null) => void;
}

function formatTimestamp() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
}

export async function saveImage(title: string, _thumbnailBase64: string) {
  const sanitized = title.replace(/[<>:"/\\|?*]/g, "_").slice(0, 60);
  const defaultName = `WinScope_${sanitized}_${formatTimestamp()}.png`;

  const path = await save({
    defaultPath: defaultName,
    filters: [{ name: "PNG", extensions: ["png"] }],
  });

  if (path) {
    // Capture full-resolution screenshot and save
    const fullBase64 = await invoke<string>("capture_full_screenshot", { windowTitle: title });
    await invoke("save_screenshot", { path, base64Data: fullBase64 });
  }
}

export function WindowCard({
  title,
  processName,
  imageBase64,
  isCapturing,
  onDoubleClick,
  onHover,
}: WindowCardProps) {
  const [hovered, setHovered] = useState(false);
  const { t } = useTranslation();

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!imageBase64) return;
    try {
      await saveImage(title, imageBase64);
    } catch (err) {
      console.error("Failed to save screenshot:", err);
    }
  };

  return (
    <div
      className="relative bg-surface-alt rounded-lg overflow-hidden border border-border
                 hover:border-blue-500 transition-colors cursor-pointer select-none"
      style={{ contain: "layout style paint" }}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => { setHovered(true); if (imageBase64) onHover?.(title); }}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="aspect-video bg-surface-deep flex items-center justify-center">
        {imageBase64 ? (
          <img
            src={`data:image/png;base64,${imageBase64}`}
            alt={title}
            className="w-full h-full object-contain"
            draggable={false}
          />
        ) : isCapturing ? (
          <div className="text-content-muted text-sm">{t("card.loading")}</div>
        ) : (
          <div className="text-content-muted text-sm">{t("card.notMonitored")}</div>
        )}
      </div>

      <div className="px-3 py-2 flex items-center gap-2">
        <span className="text-xs text-content-muted truncate flex-1" title={processName}>
          {processName}
        </span>
        <span className="text-sm text-content truncate flex-1 text-right" title={title}>
          {title}
        </span>
      </div>

      {isCapturing && (
        <div className="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
      )}

      {hovered && imageBase64 && (
        <div className="absolute inset-0 z-10 bg-black/90 flex items-center justify-center p-2">
          <img
            src={`data:image/png;base64,${imageBase64}`}
            alt={title}
            className="max-w-full max-h-full object-contain"
            draggable={false}
          />
          <button
            onPointerDown={(e) => e.preventDefault()}
            onClick={handleSave}
            className="absolute bottom-3 right-3 p-2 rounded bg-surface-alt/90 border border-border
                       text-content-muted hover:text-content hover:bg-surface transition-colors"
            title={t("card.save")}
          >
            <Download size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
