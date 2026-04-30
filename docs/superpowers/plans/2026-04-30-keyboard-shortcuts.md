# 键盘快捷键实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 WinScope 添加 8 个应用内键盘快捷键 + 2 个预留按键，覆盖暂停、置顶、设置面板、缩放、全屏等高频操作。

**Architecture:** 在 App.tsx 中通过 useEffect 注册 keydown 事件监听，直接调用现有 hook 方法和组件状态。cardWidth 状态从 WindowGrid 提升到 App.tsx 以便快捷键和滚轮共用。

**Tech Stack:** React 19, TypeScript, Tauri v2 WebviewWindow API, TailwindCSS v4

---

## 文件变更清单

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/App.tsx` | 修改 | 添加 keydown 监听、提升 cardWidth 状态、跟踪全屏状态 |
| `src/components/WindowGrid.tsx` | 修改 | cardWidth/setCardWidth 改为 props 传入 |
| `src/components/Toolbar.tsx` | 修改 | 按钮添加快捷键提示 title |
| `src/i18n/locales/zh-CN.json` | 修改 | 添加快捷键提示翻译 |
| `src/i18n/locales/en-US.json` | 修改 | 添加快捷键提示翻译 |

---

### Task 1: 将 cardWidth 状态从 WindowGrid 提升到 App.tsx

**Files:**
- Modify: `src/components/WindowGrid.tsx` (全文)
- Modify: `src/App.tsx` (全文)

- [ ] **Step 1: 修改 WindowGrid.tsx，cardWidth 和 setCardWidth 改为 props**

将 `WindowGrid.tsx` 中的内部 `cardWidth` state 替换为 props。保留 `MIN_WIDTH`、`MAX_WIDTH`、`ZOOM_STEP` 常量在文件内（其他组件也需要用）。导出 `DEFAULT_WIDTH` 和 `ZOOM_STEP` 供 App.tsx 使用。

```tsx
// src/components/WindowGrid.tsx
import { useCallback } from "react";
import type { WindowInfo } from "../types";
import { WindowCard } from "./WindowCard";
import { useTranslation } from "../i18n/index.tsx";

export const MIN_WIDTH = 120;
export const MAX_WIDTH = 720;
export const ZOOM_STEP = 30;
export const DEFAULT_WIDTH = 260;
const STORAGE_KEY = "winscope-card-width";

export function getSavedWidth(): number {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const n = parseInt(saved, 10);
      if (n >= MIN_WIDTH && n <= MAX_WIDTH) return n;
    }
  } catch {}
  return DEFAULT_WIDTH;
}

interface WindowGridProps {
  windows: WindowInfo[];
  captures: Map<string, string>;
  activeCaptures: Set<string>;
  hiddenWindows: string[];
  onBringToFront: (title: string) => void;
  cardWidth: number;
  setCardWidth: (width: number) => void;
}

export function WindowGrid({
  windows,
  captures,
  activeCaptures,
  hiddenWindows,
  onBringToFront,
  cardWidth,
  setCardWidth,
}: WindowGridProps) {
  const { t } = useTranslation();

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setCardWidth(
        Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, cardWidth + (e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP)))
      );
    }
  }, [cardWidth, setCardWidth]);

  const visibleWindows = windows.filter(
    (w) =>
      activeCaptures.has(w.title) &&
      !hiddenWindows.includes(w.process_name)
  );

  if (visibleWindows.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-content-muted">
        <div className="text-center">
          <p className="text-lg mb-2">{t("grid.empty.title")}</p>
          <p className="text-sm">{t("grid.empty.hint")}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex-1 overflow-auto p-4"
      onWheel={handleWheel}
    >
      <div
        className="grid gap-4 auto-rows-min"
        style={{
          gridTemplateColumns: `repeat(auto-fill, minmax(${cardWidth}px, 1fr))`,
        }}
      >
        {visibleWindows.map((w) => (
          <WindowCard
            key={w.title}
            title={w.title}
            processName={w.process_name}
            imageBase64={captures.get(w.title)}
            isCapturing={activeCaptures.has(w.title)}
            onDoubleClick={() => onBringToFront(w.title)}
          />
        ))}
      </div>
    </div>
  );
}
```

注意：`setCardWidth` 的签名从 `React.Dispatch<React.SetStateAction<number>>` 简化为 `(width: number) => void`，所以 `handleWheel` 里不能用函数式更新，改为直接计算新值。同时 localStorage 的保存需要在 `App.tsx` 的 `setCardWidth` wrapper 中处理。

- [ ] **Step 2: 修改 App.tsx，提升 cardWidth 状态并传给 WindowGrid**

在 `App.tsx` 中添加 `cardWidth` state，封装带 localStorage 持久化的 setter，传递给 `WindowGrid`。

```tsx
// src/App.tsx — 仅展示变更部分

import { useState, useEffect } from "react";
import { useCapture } from "./hooks/useCapture";
import { WindowGrid, getSavedWidth, DEFAULT_WIDTH, MIN_WIDTH, MAX_WIDTH, ZOOM_STEP } from "./components/WindowGrid";
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
          onBringToFront={capture.bringToFront}
          cardWidth={cardWidth}
          setCardWidth={setCardWidth}
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
```

- [ ] **Step 3: 运行 `npx tauri dev` 验证缩放功能正常**

验证 Ctrl+滚轮缩放仍然正常工作，localStorage 持久化生效。

- [ ] **Step 4: 提交**

```bash
git add src/App.tsx src/components/WindowGrid.tsx
git commit -m "refactor: lift cardWidth state from WindowGrid to App"
```

---

### Task 2: 添加 keydown 事件监听和所有快捷键处理

**Files:**
- Modify: `src/App.tsx` — 在已有的 App 组件中添加 keydown useEffect

- [ ] **Step 1: 在 App.tsx 中添加键盘快捷键 useEffect**

在 `App` 组件内，紧接 `setCardWidth` 定义之后、title bar theme effect 之前，添加以下代码：

```tsx
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
```

需要在文件顶部添加 import：

```tsx
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
```

- [ ] **Step 2: 运行 `npx tauri dev` 测试所有快捷键**

逐个验证：
- Space 暂停/恢复
- Ctrl+P 置顶/取消
- Ctrl+G 设置面板开关
- Esc 关闭设置面板
- Ctrl+= 放大、Ctrl+- 缩小、Ctrl+0 重置
- F11 全屏切换
- Ctrl+S 和 Ctrl+F 不触发浏览器默认行为

- [ ] **Step 3: 提交**

```bash
git add src/App.tsx
git commit -m "feat: add keyboard shortcuts for all toolbar actions and zoom"
```

---

### Task 3: 添加 Toolbar 按钮的快捷键提示

**Files:**
- Modify: `src/components/Toolbar.tsx` — 按钮添加 title 提示
- Modify: `src/i18n/locales/zh-CN.json` — 快捷键提示翻译
- Modify: `src/i18n/locales/en-US.json` — 快捷键提示翻译

- [ ] **Step 1: 更新 zh-CN.json，添加快捷键提示**

在 `zh-CN.json` 末尾（`"interval.3s"` 后面）添加：

```json
  "toolbar.pin.hint": "置顶 (Ctrl+P)",
  "toolbar.pause.hint": "暂停 (Space)",
  "toolbar.resume.hint": "继续 (Space)",
  "toolbar.settings.hint": "窗口筛选 (Ctrl+G)"
```

- [ ] **Step 2: 更新 en-US.json，添加快捷键提示**

在 `en-US.json` 末尾添加：

```json
  "toolbar.pin.hint": "Pin (Ctrl+P)",
  "toolbar.pause.hint": "Pause (Space)",
  "toolbar.resume.hint": "Resume (Space)",
  "toolbar.settings.hint": "Window Filter (Ctrl+G)"
```

- [ ] **Step 3: 修改 Toolbar.tsx，按钮添加 title 属性**

在 `Toolbar.tsx` 中，为置顶、暂停/恢复、设置按钮的 `title` 属性添加快捷键提示。

置顶按钮：
```tsx
title={config.always_on_top ? t("toolbar.pin.hint") : t("toolbar.pin.hint")}
```

将置顶按钮的 `onClick` 那行改为：
```tsx
      <button
        onClick={toggleAlwaysOnTop}
        title={t("toolbar.pin.hint")}
        className={`flex items-center gap-1 px-2 py-1 rounded text-sm transition-colors ${
          config.always_on_top ? "bg-blue-600 text-white" : "text-content-muted hover:text-content hover:bg-surface"
        }`}
      >
```

暂停/恢复按钮：
```tsx
      <button
        onClick={() => setPaused(!paused)}
        title={paused ? t("toolbar.resume.hint") : t("toolbar.pause.hint")}
        className={`flex items-center gap-1 px-2 py-1 rounded text-sm transition-colors ${
          paused ? "bg-yellow-600 text-white" : "text-content-muted hover:text-content hover:bg-surface"
        }`}
      >
```

设置按钮（最后一行的 button）：
```tsx
      <button onClick={onToggleSettings} className="text-content-muted hover:text-content transition-colors" title={t("toolbar.settings.hint")}>
```

- [ ] **Step 4: 运行 `npx tauri dev` 验证悬停提示**

鼠标悬停在置顶、暂停、设置按钮上，确认 tooltip 显示快捷键。

- [ ] **Step 5: 提交**

```bash
git add src/components/Toolbar.tsx src/i18n/locales/zh-CN.json src/i18n/locales/en-US.json
git commit -m "feat: add keyboard shortcut hints to toolbar button tooltips"
```

---

### Task 4: 最终验证和清理

- [ ] **Step 1: 运行完整应用测试**

启动 `npx tauri dev`，逐一验证：

1. **Space** — 暂停/恢复截图（观察缩略图是否停止更新）
2. **Ctrl+P** — 置顶/取消置顶（WinScope 是否始终在最前）
3. **Ctrl+G** — 设置面板开关
4. **Esc** — 关闭已打开的设置面板
5. **Ctrl+=** — 缩略图放大
6. **Ctrl+-** — 缩略图缩小
7. **Ctrl+0** — 重置到默认宽度
8. **F11** — 全屏切换
9. **Ctrl+S** — 不弹出浏览器保存对话框
10. **Ctrl+F** — 不弹出浏览器查找框
11. **Ctrl+滚轮** — 缩放仍正常（回归测试）
12. **悬停提示** — 按钮 tooltip 显示快捷键
13. **输入框** — 如果有 INPUT/TEXTAREA 元素，快捷键不干扰

- [ ] **Step 2: 提交 CLAUDE.md 更新（如果未提交）**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with keyboard shortcuts and feature backlog"
```
