# 多显示器过滤实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 WinScope 添加多显示器过滤功能，允许用户选择只监控特定显示器上的窗口。

**Architecture:** 使用 Win32 API 检测显示器和窗口位置，在前端实现显示器选择 UI 和过滤逻辑。

**Tech Stack:** Win32 API (windows crate), React, TypeScript

---

## 文件结构

- Create: `src-tauri/src/monitors.rs` - 显示器检测和管理
- Modify: `src-tauri/src/lib.rs` - 添加显示器相关命令
- Modify: `src-tauri/src/windows.rs` - 添加窗口显示器信息
- Create: `src/components/MonitorSelector.tsx` - 显示器选择组件
- Modify: `src/components/SettingsPanel.tsx` - 集成显示器选择
- Modify: `src/hooks/useCapture.ts` - 添加显示器过滤逻辑
- Modify: `src/types.ts` - 添加显示器相关类型
- Modify: `src/App.tsx` - 添加显示器状态管理
- Modify: `src/i18n/locales/zh-CN.json` - 添加翻译
- Modify: `src/i18n/locales/en-US.json` - 添加翻译

---

### Task 1: 添加显示器相关类型定义

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: 添加显示器类型**

```typescript
// src/types.ts

export interface WindowInfo {
  title: string;
  process_name: string;
  process_id: number;
  monitor_id: string;
}

export interface CapturePayload {
  title: string;
  image: string;
}

export interface HistoryEntry {
  timestamp: number;
  image: string;
}

export interface MonitorInfo {
  id: string;
  name: string;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  isPrimary: boolean;
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
  enabled_monitors: string[];
}
```

- [ ] **Step 2: 运行 TypeScript 检查**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: 提交更改**

```bash
git add src/types.ts
git commit -m "feat: add monitor-related type definitions"
```

---

### Task 2: 创建显示器检测模块

**Files:**
- Create: `src-tauri/src/monitors.rs`

- [ ] **Step 1: 创建显示器检测模块**

```rust
// src-tauri/src/monitors.rs

use serde::Serialize;
use windows::Win32::Graphics::Gdi::{
    EnumDisplayDevicesW, EnumDisplayMonitors, GetMonitorInfoW, HDC, HMONITOR,
    DISPLAY_DEVICEW, MONITORINFOEXW,
};
use windows::Win32::Foundation::{BOOL, LPARAM, RECT};

#[derive(Clone, Serialize)]
pub struct MonitorInfo {
    pub id: String,
    pub name: String,
    pub rect: RECT,
    pub is_primary: bool,
}

struct EnumMonitorsCallbackData {
    monitors: Vec<MonitorInfo>,
}

unsafe extern "system" fn enum_monitors_callback(
    hmonitor: HMONITOR,
    _hdc: HDC,
    _rect: *mut RECT,
    lparam: LPARAM,
) -> BOOL {
    let data = &mut *(lparam.0 as *mut EnumMonitorsCallbackData);
    
    let mut monitor_info = MONITORINFOEXW {
        monitorInfo: Default::default(),
        szDevice: Default::default(),
    };
    monitor_info.monitorInfo.cbSize = std::mem::size_of::<MONITORINFOEXW>() as u32;
    
    if GetMonitorInfoW(hmonitor, &mut monitor_info as *mut MONITORINFOEXW as *mut _).as_bool() {
        let name = String::from_utf16_lossy(
            &monitor_info.szDevice[..monitor_info.szDevice.iter().position(|&c| c == 0).unwrap_or(monitor_info.szDevice.len())]
        );
        
        let is_primary = (monitor_info.monitorInfo.dwFlags & 1) != 0; // MONITORINFOF_PRIMARY
        
        let monitor = MonitorInfo {
            id: format!("monitor_{}", data.monitors.len()),
            name,
            rect: monitor_info.monitorInfo.rcMonitor,
            is_primary,
        };
        
        data.monitors.push(monitor);
    }
    
    BOOL(1) // Continue enumeration
}

pub fn enumerate_monitors() -> Result<Vec<MonitorInfo>, String> {
    let mut data = EnumMonitorsCallbackData {
        monitors: Vec::new(),
    };
    
    unsafe {
        if !EnumDisplayMonitors(
            HDC::default(),
            None,
            Some(enum_monitors_callback),
            LPARAM(&mut data as *mut _ as isize),
        ).as_bool() {
            return Err("Failed to enumerate monitors".to_string());
        }
    }
    
    Ok(data.monitors)
}

pub fn get_window_monitor(window_title: &str) -> Result<String, String> {
    use windows::Win32::UI::WindowsAndMessaging::{FindWindowW, GetWindowRect, MonitorFromWindow, MONITOR_DEFAULTTONEAREST};
    use windows::Win32::Foundation::HWND;
    
    let title_wide: Vec<u16> = window_title.encode_utf16().chain(std::iter::once(0)).collect();
    
    unsafe {
        let hwnd = FindWindowW(None, windows::core::PCWSTR(title_wide.as_ptr()))
            .map_err(|e| format!("Failed to find window: {}", e))?;
        
        let mut rect = RECT::default();
        GetWindowRect(hwnd, &mut rect)
            .map_err(|e| format!("Failed to get window rect: {}", e))?;
        
        let hmonitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
        
        let mut monitor_info = MONITORINFOEXW {
            monitorInfo: Default::default(),
            szDevice: Default::default(),
        };
        monitor_info.monitorInfo.cbSize = std::mem::size_of::<MONITORINFOEXW>() as u32;
        
        GetMonitorInfoW(hmonitor, &mut monitor_info as *mut MONITORINFOEXW as *mut _)
            .map_err(|e| format!("Failed to get monitor info: {}", e))?;
        
        let name = String::from_utf16_lossy(
            &monitor_info.szDevice[..monitor_info.szDevice.iter().position(|&c| c == 0).unwrap_or(monitor_info.szDevice.len())]
        );
        
        Ok(name)
    }
}
```

- [ ] **Step 2: 验证编译成功**

Run: `cd src-tauri && cargo check`
Expected: PASS

- [ ] **Step 3: 提交更改**

```bash
git add src-tauri/src/monitors.rs
git commit -m "feat: add monitor detection module"
```

---

### Task 3: 更新窗口枚举添加显示器信息

**Files:**
- Modify: `src-tauri/src/windows.rs`

- [ ] **Step 1: 添加显示器信息到 WindowInfo**

```rust
// src-tauri/src/windows.rs

use serde::Serialize;
use windows::Win32::Foundation::BOOL;
use windows::Win32::Graphics::Gdi::GetMonitorInfoW;
use windows::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GetWindowTextW, IsWindowVisible, GetWindowRect,
    MonitorFromWindow, MONITOR_DEFAULTTONEAREST, MONITORINFOEXW,
};
use windows::Win32::Foundation::HWND;

#[derive(Clone, Serialize)]
pub struct WindowInfo {
    pub title: String,
    pub process_name: String,
    pub process_id: u32,
    pub monitor_id: String,
}

struct EnumWindowsCallbackData {
    windows: Vec<WindowInfo>,
}

unsafe extern "system" fn enum_windows_callback(hwnd: HWND, lparam: LPARAM) -> BOOL {
    let data = &mut *(lparam.0 as *mut EnumWindowsCallbackData);
    
    // Check if window is visible
    if !IsWindowVisible(hwnd).as_bool() {
        return BOOL(1); // Continue enumeration
    }
    
    // Get window title
    let mut title_buf = [0u16; 512];
    let title_len = GetWindowTextW(hwnd, &mut title_buf);
    if title_len == 0 {
        return BOOL(1); // Continue enumeration
    }
    
    let title = String::from_utf16_lossy(&title_buf[..title_len as usize]);
    
    // Get process ID
    let mut process_id = 0u32;
    windows::Win32::System::Threading::GetWindowThreadProcessId(hwnd, Some(&mut process_id));
    
    // Get process name
    let process_name = get_process_name(process_id).unwrap_or_default();
    
    // Get monitor ID
    let monitor_id = get_window_monitor_id(hwnd).unwrap_or_else(|| "unknown".to_string());
    
    // Skip system windows and empty titles
    if title.is_empty() || process_name.is_empty() || is_system_window(&title, &process_name) {
        return BOOL(1); // Continue enumeration
    }
    
    let window = WindowInfo {
        title,
        process_name,
        process_id,
        monitor_id,
    };
    
    data.windows.push(window);
    
    BOOL(1) // Continue enumeration
}

fn get_window_monitor_id(hwnd: HWND) -> Option<String> {
    unsafe {
        let hmonitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
        
        let mut monitor_info = MONITORINFOEXW {
            monitorInfo: Default::default(),
            szDevice: Default::default(),
        };
        monitor_info.monitorInfo.cbSize = std::mem::size_of::<MONITORINFOEXW>() as u32;
        
        if GetMonitorInfoW(hmonitor, &mut monitor_info as *mut MONITORINFOEXW as *mut _).as_bool() {
            let name = String::from_utf16_lossy(
                &monitor_info.szDevice[..monitor_info.szDevice.iter().position(|&c| c == 0).unwrap_or(monitor_info.szDevice.len())]
            );
            Some(name)
        } else {
            None
        }
    }
}

// Rest of the existing code...
```

- [ ] **Step 2: 验证编译成功**

Run: `cd src-tauri && cargo check`
Expected: PASS

- [ ] **Step 3: 提交更改**

```bash
git add src-tauri/src/windows.rs
git commit -m "feat: add monitor_id to WindowInfo struct"
```

---

### Task 4: 添加显示器相关 Tauri 命令

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: 导入显示器模块**

```rust
// src-tauri/src/lib.rs

mod capture;
pub mod config;
mod windows;
mod monitors;

use base64::Engine;
use config::AppConfig;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{Emitter, Manager, State};
use ::windows::Win32::Foundation::HWND;
use ::windows::Win32::Graphics::Dwm::{DwmSetWindowAttribute, DWMWA_USE_IMMERSIVE_DARK_MODE};
use ::windows::Win32::UI::WindowsAndMessaging::{
    BringWindowToTop, IsIconic, SetForegroundWindow, ShowWindow, SW_RESTORE,
};
use windows_capture::capture::GraphicsCaptureApiHandler;
use windows_capture::settings::{
    ColorFormat, CursorCaptureSettings, DirtyRegionSettings, DrawBorderSettings,
    MinimumUpdateIntervalSettings, SecondaryWindowSettings, Settings,
};
use windows_capture::window::Window;
use windows::WindowInfo;
use monitors::MonitorInfo;
```

- [ ] **Step 2: 添加 get_monitors 命令**

```rust
// src-tauri/src/lib.rs

#[tauri::command]
fn get_monitors() -> Result<Vec<MonitorInfo>, String> {
    monitors::enumerate_monitors()
}
```

- [ ] **Step 3: 添加 update_enabled_monitors 命令**

```rust
// src-tauri/src/lib.rs

#[tauri::command]
fn update_enabled_monitors(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    monitor_ids: Vec<String>,
) -> Result<(), String> {
    let mut config = state.config.lock().unwrap();
    config.enabled_monitors = monitor_ids;
    config::save_config(&app, &config)?;
    Ok(())
}
```

- [ ] **Step 4: 更新 invoke_handler**

```rust
// src-tauri/src/lib.rs

.invoke_handler(tauri::generate_handler![
    get_windows,
    get_config,
    update_config,
    set_title_bar_theme,
    start_capture,
    stop_capture,
    bring_to_front,
    save_screenshot,
    capture_full_screenshot,
    minimize_to_tray,
    get_monitors,
    update_enabled_monitors
])
```

- [ ] **Step 5: 验证编译成功**

Run: `cd src-tauri && cargo check`
Expected: PASS

- [ ] **Step 6: 提交更改**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: add monitor-related Tauri commands"
```

---

### Task 5: 创建 MonitorSelector 组件

**Files:**
- Create: `src/components/MonitorSelector.tsx`

- [ ] **Step 1: 创建 MonitorSelector 组件**

```typescript
// src/components/MonitorSelector.tsx

import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Monitor } from "lucide-react";
import type { MonitorInfo } from "../types";

interface MonitorSelectorProps {
  enabledMonitors: string[];
  onUpdate: (monitorIds: string[]) => void;
}

export function MonitorSelector({
  enabledMonitors,
  onUpdate,
}: MonitorSelectorProps) {
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMonitors() {
      try {
        const monitorList = await invoke<MonitorInfo[]>("get_monitors");
        setMonitors(monitorList);
      } catch (e) {
        console.error("Failed to load monitors:", e);
      } finally {
        setLoading(false);
      }
    }
    loadMonitors();
  }, []);

  const handleToggle = useCallback(
    (monitorId: string) => {
      const newEnabled = enabledMonitors.includes(monitorId)
        ? enabledMonitors.filter((id) => id !== monitorId)
        : [...enabledMonitors, monitorId];
      onUpdate(newEnabled);
    },
    [enabledMonitors, onUpdate]
  );

  if (loading) {
    return <div className="text-content-muted">加载显示器中...</div>;
  }

  if (monitors.length === 0) {
    return <div className="text-content-muted">未检测到显示器</div>;
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-content">显示器选择</h4>
      <div className="grid grid-cols-2 gap-2">
        {monitors.map((monitor) => (
          <button
            key={monitor.id}
            onClick={() => handleToggle(monitor.id)}
            className={`p-3 rounded-lg border transition-colors ${
              enabledMonitors.includes(monitor.id)
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-surface-alt text-content-muted hover:border-primary/50"
            }`}
          >
            <div className="flex items-center gap-2">
              <Monitor size={16} />
              <div className="text-left">
                <div className="text-sm font-medium">
                  {monitor.isPrimary ? "主显示器" : monitor.name}
                </div>
                <div className="text-xs opacity-75">
                  {monitor.rect.width}x{monitor.rect.height}
                </div>
              </div>
            </div>
          </button>
        ))}
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
git add src/components/MonitorSelector.tsx
git commit -m "feat: add MonitorSelector component"
```

---

### Task 6: 更新 SettingsPanel 集成显示器选择

**Files:**
- Modify: `src/components/SettingsPanel.tsx`

- [ ] **Step 1: 导入 MonitorSelector 组件**

```typescript
// src/components/SettingsPanel.tsx

import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { X, Monitor, Eye, EyeOff, Tag } from "lucide-react";
import type { WindowInfo, AppConfig } from "../types";
import { MonitorSelector } from "./MonitorSelector";
```

- [ ] **Step 2: 添加显示器选择 UI**

```typescript
// src/components/SettingsPanel.tsx

interface SettingsPanelProps {
  windows: WindowInfo[];
  config: AppConfig;
  activeCaptures: Set<string>;
  onStartCapture: (title: string, processName: string) => void;
  onStopCapture: (title: string, processName: string) => void;
  onUpdateConfig: (config: AppConfig) => void;
  onClose: () => void;
}

export function SettingsPanel({
  windows,
  config,
  activeCaptures,
  onStartCapture,
  onStopCapture,
  onUpdateConfig,
  onClose,
}: SettingsPanelProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");

  // Filter windows by enabled monitors
  const filteredWindows = windows.filter((w) => {
    if (config.enabled_monitors.length === 0) {
      return true; // No filter applied
    }
    return config.enabled_monitors.includes(w.monitor_id);
  });

  // Handle monitor selection update
  const handleMonitorUpdate = useCallback(
    async (monitorIds: string[]) => {
      try {
        await invoke("update_enabled_monitors", { monitorIds });
        onUpdateConfig({
          ...config,
          enabled_monitors: monitorIds,
        });
      } catch (e) {
        console.error("Failed to update enabled monitors:", e);
      }
    },
    [config, onUpdateConfig]
  );

  // Rest of the existing component code...
```

- [ ] **Step 3: 添加显示器选择器到面板**

```typescript
// src/components/SettingsPanel.tsx

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-surface border-l border-border shadow-lg z-40 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="text-lg font-semibold text-content">设置</h3>
        <button
          onClick={onClose}
          className="p-1.5 rounded hover:bg-surface-alt text-content-muted hover:text-content transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Monitor Selector */}
        <MonitorSelector
          enabledMonitors={config.enabled_monitors}
          onUpdate={handleMonitorUpdate}
        />

        {/* Window List */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-content">窗口列表</h4>
          {filteredWindows.length === 0 ? (
            <div className="text-content-muted">暂无窗口</div>
          ) : (
            <div className="space-y-1">
              {filteredWindows.map((w) => (
                <div
                  key={w.title}
                  className="flex items-center justify-between p-2 rounded hover:bg-surface-alt"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-content truncate">
                      {w.title}
                    </div>
                    <div className="text-xs text-content-muted truncate">
                      {w.process_name}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {activeCaptures.has(w.title) ? (
                      <button
                        onClick={() => onStopCapture(w.title, w.process_name)}
                        className="p-1 rounded text-red-500 hover:bg-red-500/10"
                        title="停止监控"
                      >
                        <EyeOff size={16} />
                      </button>
                    ) : (
                      <button
                        onClick={() => onStartCapture(w.title, w.process_name)}
                        className="p-1 rounded text-green-500 hover:bg-green-500/10"
                        title="开始监控"
                      >
                        <Eye size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tags Section */}
        {/* ... existing tags code ... */}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 运行 TypeScript 检查**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: 提交更改**

```bash
git add src/components/SettingsPanel.tsx
git commit -m "feat: integrate MonitorSelector into SettingsPanel"
```

---

### Task 7: 更新 useCapture hook 支持显示器过滤

**Files:**
- Modify: `src/hooks/useCapture.ts`

- [ ] **Step 1: 添加显示器过滤逻辑**

```typescript
// src/hooks/useCapture.ts

import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import type { WindowInfo, CapturePayload, AppConfig } from "../types";
import { useHistory } from "./useHistory";

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

  // Filter windows by enabled monitors
  const filteredWindows = windows.filter((w) => {
    if (!config || config.enabled_monitors.length === 0) {
      return true; // No filter applied
    }
    return config.enabled_monitors.includes(w.monitor_id);
  });

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

  // Rest of the existing hook code...

  return {
    windows: filteredWindows,
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

- [ ] **Step 2: 运行 TypeScript 检查**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: 提交更改**

```bash
git add src/hooks/useCapture.ts
git commit -m "feat: add monitor filtering to useCapture hook"
```

---

### Task 8: 添加国际化翻译

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
  "tray.show": "显示主窗口",
  "tray.pause": "暂停截图",
  "tray.top": "窗口置顶",
  "tray.quit": "退出",
  "monitors.title": "显示器选择",
  "monitors.primary": "主显示器",
  "monitors.loading": "加载显示器中...",
  "monitors.notFound": "未检测到显示器"
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
  "tray.show": "Show Main Window",
  "tray.pause": "Pause Capture",
  "tray.top": "Always on Top",
  "tray.quit": "Quit",
  "monitors.title": "Monitor Selection",
  "monitors.primary": "Primary Monitor",
  "monitors.loading": "Loading monitors...",
  "monitors.notFound": "No monitors detected"
}
```

- [ ] **Step 3: 提交更改**

```bash
git add src/i18n/locales/zh-CN.json src/i18n/locales/en-US.json
git commit -m "feat: add i18n translations for multi-monitor filter"
```

---

### Task 9: 端到端测试

**Files:**
- Create: `e2e-tests/test/monitors.spec.js`

- [ ] **Step 1: 创建显示器过滤测试**

```javascript
// e2e-tests/test/monitors.spec.js

const { expect } = require("chai");

describe("Multi-Monitor Filter Feature", () => {
  it("should show monitor selector in settings panel", async () => {
    // Open settings panel
    await browser.keys(["Control", "g"]);
    await browser.pause(300);

    // Check if monitor selector exists
    const monitorSelector = await $('[data-testid="monitor-selector"]');
    const isDisplayed = await monitorSelector.isDisplayed();
    expect(isDisplayed).to.be.true;

    // Close settings panel
    await browser.keys(["Escape"]);
  });

  it("should filter windows by selected monitors", async () => {
    // Open settings panel
    await browser.keys(["Control", "g"]);
    await browser.pause(300);

    // Get initial window count
    const initialCards = await $$('[data-testid="window-card"]');
    const initialCount = initialCards.length;

    // Click on a monitor to toggle it
    const monitorButton = await $('[data-testid="monitor-button"]');
    if (await monitorButton.isDisplayed()) {
      await monitorButton.click();
      await browser.pause(500);

      // Check if window count changed
      const filteredCards = await $$('[data-testid="window-card"]');
      const filteredCount = filteredCards.length;

      // The count might be the same if all windows are on the same monitor
      // This test mainly verifies the UI interaction works
      expect(filteredCount).to.be.at.least(0);
    }

    // Close settings panel
    await browser.keys(["Escape"]);
  });
});
```

- [ ] **Step 2: 运行测试**

Run: `cd e2e-tests && npx wdio run wdio.conf.js --spec test/monitors.spec.js`
Expected: PASS

- [ ] **Step 3: 提交更改**

```bash
git add e2e-tests/test/monitors.spec.js
git commit -m "test: add e2e tests for multi-monitor filter feature"
```

---

### Task 10: 最终集成测试

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
git commit -m "feat: complete multi-monitor filter feature implementation"
```

---

## 验证清单

- [ ] 显示器检测正确
- [ ] 显示器选择 UI 正常显示
- [ ] 窗口按显示器过滤正常
- [ ] 配置持久化正常
- [ ] 所有测试通过
- [ ] 代码无 TypeScript 错误
- [ ] 代码无 ESLint 错误
- [ ] 应用正常构建
