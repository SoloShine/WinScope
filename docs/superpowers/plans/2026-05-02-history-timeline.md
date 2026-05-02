# 历史缩略图时间线实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 WinScope 添加历史缩略图时间线功能，允许用户回溯查看窗口的历史状态变化。

**Architecture:** 使用 React state 管理历史截图，在前端存储最近 20 张截图。通过时间线滑块 UI 组件实现历史回放。

**Tech Stack:** React Hooks, TypeScript, CSS Variables, Tauri Events

---

## 文件结构

- Create: `src/hooks/useHistory.ts` - 历史记录管理 hook
- Create: `src/components/HistoryTimeline.tsx` - 时间线滑块组件
- Create: `src/components/HistoryPreview.tsx` - 历史预览窗口
- Modify: `src/hooks/useCapture.ts` - 集成历史记录
- Modify: `src/components/WindowCard.tsx` - 添加历史按钮
- Modify: `src/App.tsx` - 添加历史预览窗口
- Modify: `src/types.ts` - 添加历史相关类型
- Modify: `src/i18n/locales/zh-CN.json` - 添加翻译
- Modify: `src/i18n/locales/en-US.json` - 添加翻译

---

### Task 1: 添加历史相关类型定义

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: 添加历史截图类型**

```typescript
// src/types.ts

export interface WindowInfo {
  title: string;
  process_name: string;
  process_id: number;
}

export interface CapturePayload {
  title: string;
  image: string;
}

export interface HistoryEntry {
  timestamp: number;
  image: string;
}

export interface AppConfig {
  monitored_windows: string[];
  hidden_windows: string[];
  window_tags: Record<string, string[]>;
  refresh_interval_ms: number;
  always_on_top: boolean;
  window_geometry: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  max_history_entries: number;
}
```

- [ ] **Step 2: 运行 TypeScript 检查**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: 提交更改**

```bash
git add src/types.ts
git commit -m "feat: add history entry type definition"
```

---

### Task 2: 创建 useHistory hook

**Files:**
- Create: `src/hooks/useHistory.ts`

- [ ] **Step 1: 创建 useHistory hook**

```typescript
// src/hooks/useHistory.ts

import { useState, useCallback, useRef } from "react";
import type { HistoryEntry } from "../types";

const MAX_ENTRIES = 20;

export function useHistory() {
  const [histories, setHistories] = useState<Map<string, HistoryEntry[]>>(new Map());
  const [viewingHistory, setViewingHistory] = useState<string | null>(null);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const maxEntriesRef = useRef(MAX_ENTRIES);

  const addEntry = useCallback((title: string, image: string) => {
    const entry: HistoryEntry = {
      timestamp: Date.now(),
      image,
    };

    setHistories((prev) => {
      const next = new Map(prev);
      const entries = next.get(title) || [];
      const newEntries = [entry, ...entries].slice(0, maxEntriesRef.current);
      next.set(title, newEntries);
      return next;
    });
  }, []);

  const clearHistory = useCallback((title: string) => {
    setHistories((prev) => {
      const next = new Map(prev);
      next.delete(title);
      return next;
    });
  }, []);

  const clearAllHistories = useCallback(() => {
    setHistories(new Map());
  }, []);

  const getHistory = useCallback(
    (title: string) => {
      return histories.get(title) || [];
    },
    [histories]
  );

  const startViewing = useCallback((title: string) => {
    setViewingHistory(title);
    setHistoryIndex(-1);
  }, []);

  const stopViewing = useCallback(() => {
    setViewingHistory(null);
    setHistoryIndex(-1);
  }, []);

  const setIndex = useCallback((index: number) => {
    setHistoryIndex(index);
  }, []);

  const getCurrentImage = useCallback(() => {
    if (!viewingHistory || historyIndex === -1) {
      return null;
    }
    const entries = histories.get(viewingHistory) || [];
    if (historyIndex >= 0 && historyIndex < entries.length) {
      return entries[historyIndex].image;
    }
    return null;
  }, [viewingHistory, historyIndex, histories]);

  const isViewing = viewingHistory !== null && historyIndex !== -1;

  return {
    histories,
    viewingHistory,
    historyIndex,
    isViewing,
    addEntry,
    clearHistory,
    clearAllHistories,
    getHistory,
    startViewing,
    stopViewing,
    setIndex,
    getCurrentImage,
  };
}
```

- [ ] **Step 2: 运行 TypeScript 检查**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: 提交更改**

```bash
git add src/hooks/useHistory.ts
git commit -m "feat: add useHistory hook for managing capture history"
```

---

### Task 3: 集成历史记录到 useCapture hook

**Files:**
- Modify: `src/hooks/useCapture.ts`

- [ ] **Step 1: 导入 useHistory hook**

```typescript
// src/hooks/useCapture.ts

import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import type { WindowInfo, CapturePayload, AppConfig } from "../types";
import { useHistory } from "./useHistory";
```

- [ ] **Step 2: 集成 useHistory hook**

```typescript
// src/hooks/useCapture.ts

export function useCapture() {
  const [windows, setWindows] = useState<WindowInfo[]>([]);
  const [captures, setCaptures] = useState<Map<string, string>>(new Map());
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [activeCaptures, setActiveCaptures] = useState<Set<string>>(new Set());
  const [paused, setPaused] = useState(false);

  const history = useHistory();

  const configRef = useRef(config);
  const activeCapturesRef = useRef(activeCaptures);
  configRef.current = config;
  activeCapturesRef.current = activeCaptures;

  // Load initial data
  useEffect(() => {
    async function load() {
      try {
        const [windowList, appConfig] = await Promise.all([
          invoke<WindowInfo[]>("get_windows"),
          invoke<AppConfig>("get_config"),
        ]);
        setWindows(windowList);
        setConfig(appConfig);

        // Apply always-on-top from config
        if (appConfig.always_on_top) {
          getCurrentWebviewWindow().setAlwaysOnTop(true);
        }

        // Auto-start captures for monitored windows
        if (appConfig.monitored_windows.length > 0) {
          const savedNames = new Set(appConfig.monitored_windows);
          const matches = windowList.filter((w) => savedNames.has(w.process_name));
          for (const w of matches) {
            try {
              await invoke("start_capture", { windowTitle: w.title });
              setActiveCaptures((prev) => new Set(prev).add(w.title));
            } catch {
              // Window might not exist anymore
            }
          }
        }
      } catch (e) {
        console.error("Failed to load initial data:", e);
      }
    }
    load();
  }, []);

  // Listen for capture-closed events from Rust
  useEffect(() => {
    const unlisten = listen<string>("capture-closed", (event) => {
      const title = event.payload;
      setActiveCaptures((prev) => {
        const next = new Set(prev);
        next.delete(title);
        return next;
      });
      setCaptures((prev) => {
        const next = new Map(prev);
        next.delete(title);
        return next;
      });
      // Clear history when window is closed
      history.clearHistory(title);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [history.clearHistory]);

  // Listen for capture updates
  useEffect(() => {
    const unlisten = listen<CapturePayload>("capture-update", (event) => {
      if (!paused) {
        const { title, image } = event.payload;
        setCaptures((prev) => {
          const next = new Map(prev);
          next.set(title, image);
          return next;
        });
        // Add to history
        history.addEntry(title, image);
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [paused, history.addEntry]);

  // Rest of the hook...
```

- [ ] **Step 3: 返回 history 对象**

```typescript
// src/hooks/useCapture.ts

  return {
    windows,
    captures,
    config,
    activeCaptures,
    paused,
    setPaused,
    startCapture,
    stopCapture,
    bringToFront,
    updateConfig,
    history,
  };
}
```

- [ ] **Step 4: 运行 TypeScript 检查**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: 提交更改**

```bash
git add src/hooks/useCapture.ts
git commit -m "feat: integrate history tracking into useCapture hook"
```

---

### Task 4: 创建 HistoryTimeline 组件

**Files:**
- Create: `src/components/HistoryTimeline.tsx`

- [ ] **Step 1: 创建 HistoryTimeline 组件**

```typescript
// src/components/HistoryTimeline.tsx

import { useMemo } from "react";
import type { HistoryEntry } from "../types";

interface HistoryTimelineProps {
  entries: HistoryEntry[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
}

export function HistoryTimeline({
  entries,
  currentIndex,
  onIndexChange,
}: HistoryTimelineProps) {
  const timestamps = useMemo(() => {
    return entries.map((entry) => {
      const date = new Date(entry.timestamp);
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    });
  }, [entries]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    onIndexChange(value);
  };

  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1 mt-2">
      <div className="flex justify-between text-xs text-content-muted">
        <span>{timestamps[timestamps.length - 1]}</span>
        <span>{timestamps[0]}</span>
      </div>
      <input
        type="range"
        min={0}
        max={entries.length - 1}
        value={currentIndex === -1 ? entries.length - 1 : currentIndex}
        onChange={handleChange}
        className="w-full h-1.5 bg-surface-alt rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
      />
      <div className="text-center text-xs text-content-muted">
        {currentIndex === -1
          ? "实时"
          : timestamps[currentIndex]}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 运行 TypeScript 检查**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: 提交更改**

```bash
git add src/components/HistoryTimeline.tsx
git commit -m "feat: add HistoryTimeline component"
```

---

### Task 5: 创建 HistoryPreview 组件

**Files:**
- Create: `src/components/HistoryPreview.tsx`

- [ ] **Step 1: 创建 HistoryPreview 组件**

```typescript
// src/components/HistoryPreview.tsx

import { useCallback } from "react";
import { HistoryTimeline } from "./HistoryTimeline";
import type { HistoryEntry } from "../types";
import { X, Radio } from "lucide-react";

interface HistoryPreviewProps {
  title: string;
  entries: HistoryEntry[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  onLive: () => void;
  onClose: () => void;
}

export function HistoryPreview({
  title,
  entries,
  currentIndex,
  onIndexChange,
  onLive,
  onClose,
}: HistoryPreviewProps) {
  const currentImage = useCallback(() => {
    if (currentIndex === -1 || currentIndex >= entries.length) {
      return entries[0]?.image;
    }
    return entries[currentIndex]?.image;
  }, [entries, currentIndex]);

  const image = currentImage();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl max-h-[90vh] mx-4 bg-surface rounded-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-lg font-semibold text-content truncate">
            {title}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={onLive}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                currentIndex === -1
                  ? "bg-primary text-white"
                  : "bg-surface-alt text-content-muted hover:text-content"
              }`}
            >
              <Radio size={14} className="inline mr-1" />
              实时
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-surface-alt text-content-muted hover:text-content transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Image Preview */}
        <div className="p-4 overflow-auto max-h-[60vh]">
          {image ? (
            <img
              src={`data:image/png;base64,${image}`}
              alt={title}
              className="w-full h-auto rounded border border-border"
            />
          ) : (
            <div className="flex items-center justify-center h-64 text-content-muted">
              暂无历史截图
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="p-4 border-t border-border">
          <HistoryTimeline
            entries={entries}
            currentIndex={currentIndex}
            onIndexChange={onIndexChange}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 运行 TypeScript 检查**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: 提交更改**

```bash
git add src/components/HistoryPreview.tsx
git commit -m "feat: add HistoryPreview component"
```

---

### Task 6: 更新 WindowCard 组件添加历史按钮

**Files:**
- Modify: `src/components/WindowCard.tsx`

- [ ] **Step 1: 添加历史按钮**

```typescript
// src/components/WindowCard.tsx

import { useState, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { History, Download, Eye, EyeOff } from "lucide-react";

interface WindowCardProps {
  title: string;
  processName: string;
  image: string | undefined;
  isActive: boolean;
  onBringToFront: (title: string) => void;
  onCardHover: (title: string | null) => void;
  onShowHistory: (title: string) => void;
}

export function WindowCard({
  title,
  processName,
  image,
  isActive,
  onBringToFront,
  onCardHover,
  onShowHistory,
}: WindowCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    onCardHover(title);
  }, [title, onCardHover]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    onCardHover(null);
  }, [onCardHover]);

  const handleDoubleClick = useCallback(() => {
    onBringToFront(title);
  }, [title, onBringToFront]);

  const handleHistoryClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onShowHistory(title);
    },
    [title, onShowHistory]
  );

  return (
    <div
      ref={cardRef}
      className="relative group bg-surface-alt rounded-lg overflow-hidden border border-border hover:border-primary transition-colors"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onDoubleClick={handleDoubleClick}
    >
      {/* Image */}
      <div className="aspect-video bg-black">
        {image ? (
          <img
            src={`data:image/png;base64,${image}`}
            alt={title}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-content-muted">
            {isActive ? "捕获中..." : "未激活"}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2">
        <div className="text-sm font-medium text-content truncate" title={title}>
          {title}
        </div>
        <div className="text-xs text-content-muted truncate" title={processName}>
          {processName}
        </div>
      </div>

      {/* Hover Actions */}
      {isHovered && (
        <div className="absolute top-2 right-2 flex gap-1">
          <button
            onClick={handleHistoryClick}
            className="p-1.5 rounded bg-black/50 text-white hover:bg-black/70 transition-colors"
            title="查看历史"
          >
            <History size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

export function saveImage(title: string, base64: string): Promise<void> {
  return invoke("save_screenshot", {
    path: `${title}_${Date.now()}.png`,
    base64Data: base64,
  });
}
```

- [ ] **Step 2: 运行 TypeScript 检查**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: 提交更改**

```bash
git add src/components/WindowCard.tsx
git commit -m "feat: add history button to WindowCard component"
```

---

### Task 7: 更新 WindowGrid 组件传递历史回调

**Files:**
- Modify: `src/components/WindowGrid.tsx`

- [ ] **Step 1: 添加 onShowHistory prop**

```typescript
// src/components/WindowGrid.tsx

import { WindowCard } from "./WindowCard";
import type { WindowInfo } from "../types";

interface WindowGridProps {
  windows: WindowInfo[];
  captures: Map<string, string>;
  activeCaptures: Set<string>;
  hiddenWindows: string[];
  windowTags: Record<string, string[]>;
  cardWidth: number;
  setCardWidth: (updater: number | ((prev: number) => number)) => void;
  onBringToFront: (title: string) => void;
  onCardHover: (title: string | null) => void;
  onShowHistory: (title: string) => void;
}

export function WindowGrid({
  windows,
  captures,
  activeCaptures,
  hiddenWindows,
  windowTags,
  cardWidth,
  setCardWidth,
  onBringToFront,
  onCardHover,
  onShowHistory,
}: WindowGridProps) {
  // Filter windows
  const visibleWindows = windows.filter(
    (w) => !hiddenWindows.includes(w.process_name)
  );

  // Handle wheel zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -10 : 10;
        setCardWidth((prev) => prev + delta);
      }
    },
    [setCardWidth]
  );

  return (
    <div
      className="flex-1 overflow-auto p-4"
      onWheel={handleWheel}
      style={
        {
          "--card-width": `${cardWidth}px`,
        } as React.CSSProperties
      }
    >
      {visibleWindows.length === 0 ? (
        <div className="flex items-center justify-center h-full text-content-muted">
          暂无窗口
        </div>
      ) : (
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: `repeat(auto-fill, minmax(var(--card-width), 1fr))`,
          }}
        >
          {visibleWindows.map((w) => (
            <WindowCard
              key={w.title}
              title={w.title}
              processName={w.process_name}
              image={captures.get(w.title)}
              isActive={activeCaptures.has(w.title)}
              onBringToFront={onBringToFront}
              onCardHover={onCardHover}
              onShowHistory={onShowHistory}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export const DEFAULT_WIDTH = 260;
export const MIN_WIDTH = 120;
export const MAX_WIDTH = 480;
export const ZOOM_STEP = 20;

export function getSavedWidth(): number {
  try {
    const saved = localStorage.getItem("winscope-card-width");
    if (saved) {
      const width = parseInt(saved, 10);
      if (!isNaN(width) && width >= MIN_WIDTH && width <= MAX_WIDTH) {
        return width;
      }
    }
  } catch {}
  return DEFAULT_WIDTH;
}
```

- [ ] **Step 2: 运行 TypeScript 检查**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: 提交更改**

```bash
git add src/components/WindowGrid.tsx
git commit -m "feat: add onShowHistory prop to WindowGrid component"
```

---

### Task 8: 更新 App.tsx 集成历史预览

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: 导入 HistoryPreview 组件**

```typescript
// src/App.tsx

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
import { HistoryPreview } from "./components/HistoryPreview";

import { Toolbar } from "./components/Toolbar";
import { SettingsPanel } from "./components/SettingsPanel";
import { useTranslation } from "./i18n/index.tsx";
import { useTheme } from "./theme.tsx";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";
import { Maximize, Minimize, Plus, Minus, RotateCcw } from "lucide-react";
```

- [ ] **Step 2: 添加历史预览状态**

```typescript
// src/App.tsx

function App() {
  const capture = useCapture();
  const [showSettings, setShowSettings] = useState(false);
  const [cardWidth, setCardWidthRaw] = useState(getSavedWidth);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHistory, setShowHistory] = useState<string | null>(null);
  const { t } = useTranslation();
  const { theme } = useTheme();

  // Live width ref — updated immediately, React state syncs after debounce
  const liveWidthRef = useRef(cardWidth);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Rest of the component...
```

- [ ] **Step 3: 添加历史预览处理函数**

```typescript
// src/App.tsx

  // History preview handlers
  const handleShowHistory = useCallback((title: string) => {
    setShowHistory(title);
    capture.history.startViewing(title);
  }, [capture.history.startViewing]);

  const handleCloseHistory = useCallback(() => {
    setShowHistory(null);
    capture.history.stopViewing();
  }, [capture.history.stopViewing]);

  const handleHistoryIndexChange = useCallback((index: number) => {
    capture.history.setIndex(index);
  }, [capture.history.setIndex]);

  const handleHistoryLive = useCallback(() => {
    capture.history.setIndex(-1);
  }, [capture.history.setIndex]);
```

- [ ] **Step 4: 更新 WindowGrid 渲染**

```typescript
// src/App.tsx

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
            onShowHistory={handleShowHistory}
          />
```

- [ ] **Step 5: 添加 HistoryPreview 渲染**

```typescript
// src/App.tsx

        {/* History Preview */}
        {showHistory && (
          <HistoryPreview
            title={showHistory}
            entries={capture.history.getHistory(showHistory)}
            currentIndex={capture.history.historyIndex}
            onIndexChange={handleHistoryIndexChange}
            onLive={handleHistoryLive}
            onClose={handleCloseHistory}
          />
        )}
```

- [ ] **Step 6: 运行 TypeScript 检查**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 7: 提交更改**

```bash
git add src/App.tsx
git commit -m "feat: integrate history preview into main App"
```

---

### Task 9: 添加国际化翻译

**Files:**
- Modify: `src/i18n/locales/zh-CN.json`
- Modify: `src/i18n/locales/en-US.json`

- [ ] **Step 1: 添加中文翻译**

```json
// src/i18n/locales/zh-CN.json

{
  "loading": "加载中...",
  "toolbar.pause": "暂停",
  "toolbar.resume": "继续",
  "toolbar.alwaysOnTop": "置顶",
  "toolbar.settings": "设置",
  "toolbar.language": "语言",
  "settings.title": "窗口筛选",
  "settings.close": "关闭",
  "settings.monitor": "监控",
  "settings.stop": "停止",
  "settings.hidden": "隐藏",
  "settings.visible": "显示",
  "controls.fullscreen": "全屏",
  "controls.exitFullscreen": "退出全屏",
  "controls.zoomIn": "放大",
  "controls.zoomOut": "缩小",
  "controls.zoomReset": "重置缩放",
  "history.title": "历史记录",
  "history.live": "实时",
  "history.noHistory": "暂无历史截图",
  "history.view": "查看历史",
  "history.time": "时间"
}
```

- [ ] **Step 2: 添加英文翻译**

```json
// src/i18n/locales/en-US.json

{
  "loading": "Loading...",
  "toolbar.pause": "Pause",
  "toolbar.resume": "Resume",
  "toolbar.alwaysOnTop": "Always on Top",
  "toolbar.settings": "Settings",
  "toolbar.language": "Language",
  "settings.title": "Window Filter",
  "settings.close": "Close",
  "settings.monitor": "Monitor",
  "settings.stop": "Stop",
  "settings.hidden": "Hidden",
  "settings.visible": "Visible",
  "controls.fullscreen": "Fullscreen",
  "controls.exitFullscreen": "Exit Fullscreen",
  "controls.zoomIn": "Zoom In",
  "controls.zoomOut": "Zoom Out",
  "controls.zoomReset": "Reset Zoom",
  "history.title": "History",
  "history.live": "Live",
  "history.noHistory": "No history screenshots",
  "history.view": "View History",
  "history.time": "Time"
}
```

- [ ] **Step 3: 提交更改**

```bash
git add src/i18n/locales/zh-CN.json src/i18n/locales/en-US.json
git commit -m "feat: add i18n translations for history feature"
```

---

### Task 10: 端到端测试

**Files:**
- Create: `e2e-tests/test/history.spec.js`

- [ ] **Step 1: 创建历史功能测试**

```javascript
// e2e-tests/test/history.spec.js

const { expect } = require("chai");

describe("History Timeline Feature", () => {
  it("should show history button on card hover", async () => {
    // This test requires a window to be monitored first
    // Skip if no windows are available
    const cards = await $$('[data-testid="window-card"]');
    if (cards.length === 0) {
      this.skip();
    }

    const firstCard = cards[0];
    await firstCard.moveTo();

    const historyButton = await firstCard.$('[data-testid="history-button"]');
    const isDisplayed = await historyButton.isDisplayed();
    expect(isDisplayed).to.be.true;
  });

  it("should open history preview when clicking history button", async () => {
    const cards = await $$('[data-testid="window-card"]');
    if (cards.length === 0) {
      this.skip();
    }

    const firstCard = cards[0];
    await firstCard.moveTo();

    const historyButton = await firstCard.$('[data-testid="history-button"]');
    await historyButton.click();

    const preview = await $('[data-testid="history-preview"]');
    const isDisplayed = await preview.isDisplayed();
    expect(isDisplayed).to.be.true;
  });

  it("should close history preview when clicking close button", async () => {
    const closeButton = await $('[data-testid="history-close"]');
    await closeButton.click();

    const preview = await $('[data-testid="history-preview"]');
    const isExisting = await preview.isExisting();
    expect(isExisting).to.be.false;
  });
});
```

- [ ] **Step 2: 运行测试**

Run: `cd e2e-tests && npx wdio run wdio.conf.js --spec test/history.spec.js`
Expected: PASS (or SKIP if no windows available)

- [ ] **Step 3: 提交更改**

```bash
git add e2e-tests/test/history.spec.js
git commit -m "test: add e2e tests for history timeline feature"
```

---

### Task 11: 最终集成测试

- [ ] **Step 1: 运行所有测试**

Run: `npm test`
Expected: PASS

- [ ] **Step 2: 运行 TypeScript 检查**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: 运行 ESLint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 4: 构建应用**

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: 运行后端测试**

Run: `npm run test:backend`
Expected: PASS

- [ ] **Step 6: 提交最终更改**

```bash
git add .
git commit -m "feat: complete history timeline feature implementation"
```

---

## 验证清单

- [ ] 历史截图正确存储
- [ ] 时间线滑块交互流畅
- [ ] 历史预览窗口正确显示
- [ ] 实时/历史切换正常
- [ ] 窗口关闭时历史记录清理
- [ ] 内存占用在合理范围内
- [ ] 所有测试通过
- [ ] 代码无 TypeScript 错误
- [ ] 代码无 ESLint 错误
- [ ] 应用正常构建
