import { useState } from "react";

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

  return (
    <div
      className="relative bg-gray-800 rounded-lg overflow-hidden border border-gray-700
                 hover:border-blue-500 transition-colors cursor-pointer select-none"
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-gray-900 flex items-center justify-center">
        {imageBase64 ? (
          <img
            src={`data:image/png;base64,${imageBase64}`}
            alt={title}
            className="w-full h-full object-contain"
            draggable={false}
          />
        ) : isCapturing ? (
          <div className="text-gray-500 text-sm">Loading...</div>
        ) : (
          <div className="text-gray-600 text-sm">Not monitored</div>
        )}
      </div>

      {/* Title bar */}
      <div className="px-3 py-2 flex items-center gap-2">
        <span className="text-xs text-gray-400 truncate flex-1" title={processName}>
          {processName}
        </span>
        <span className="text-sm text-gray-200 truncate flex-1 text-right" title={title}>
          {title}
        </span>
      </div>

      {/* Status indicator */}
      {isCapturing && (
        <div className="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
      )}

      {/* Hover preview */}
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
