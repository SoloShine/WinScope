import { useState } from "react";
import { useTranslation } from "../i18n/index.tsx";

interface WindowCardProps {
  title: string;
  processName: string;
  imageBase64: string | undefined;
  isCapturing: boolean;
  onDoubleClick: () => void;
}

export function WindowCard({
  title,
  processName,
  imageBase64,
  isCapturing,
  onDoubleClick,
}: WindowCardProps) {
  const [hovered, setHovered] = useState(false);
  const { t } = useTranslation();

  return (
    <div
      className="relative bg-surface-alt rounded-lg overflow-hidden border border-border
                 hover:border-blue-500 transition-colors cursor-pointer select-none"
      style={{ contain: "layout style paint" }}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => setHovered(true)}
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
        </div>
      )}
    </div>
  );
}
