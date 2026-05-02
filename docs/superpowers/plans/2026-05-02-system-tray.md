# 系统托盘实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 WinScope 添加系统托盘功能，允许应用最小化到托盘继续运行。

**Architecture:** 使用 Tauri 托盘插件实现系统托盘，通过 Tauri 命令控制窗口显示/隐藏。

**Tech Stack:** Tauri Plugin Tray, Rust, TypeScript

---

## 文件结构

- Modify: `src-tauri/Cargo.toml` - 添加托盘插件依赖
- Modify: `src-tauri/src/lib.rs` - 添加托盘初始化和命令
- Create: `src-tauri/icons/tray-icon.png` - 托盘图标
- Modify: `src/App.tsx` - 添加最小化到托盘逻辑
- Modify: `src/types.ts` - 添加托盘相关类型
- Modify: `src/i18n/locales/zh-CN.json` - 添加翻译
- Modify: `src/i18n/locales/en-US.json` - 添加翻译

---

### Task 1: 添加托盘插件依赖

**Files:**
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: 添加托盘插件依赖**

```toml
# src-tauri/Cargo.toml

[package]
name = "window-monitor"
version = "0.1.0"
edition = "2021"

[lib]
name = "window_monitor_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
windows-capture = "1"
windows = { version = "0.61", features = [
    "Win32_Foundation",
    "Win32_UI_WindowsAndMessaging",
    "Win32_Graphics_Dwm",
] }
image = "0.25"
base64 = "0.22"
tauri-plugin-dialog = "2.7.0"
tauri-plugin-global-shortcut = "2.3.1"
tauri-plugin-tray = "2"

[dev-dependencies]
tempfile = "3"
```

- [ ] **Step 2: 验证依赖添加成功**

Run: `cd src-tauri && cargo check`
Expected: PASS

- [ ] **Step 3: 提交更改**

```bash
git add src-tauri/Cargo.toml
git commit -m "feat: add tauri-plugin-tray dependency"
```

---

### Task 2: 创建托盘图标

**Files:**
- Create: `src-tauri/icons/tray-icon.png`

- [ ] **Step 1: 创建托盘图标**

创建一个 32x32 像素的 PNG 图标，可以使用应用的 logo 或简化版本。

图标要求：
- 尺寸：32x32 像素
- 格式：PNG
- 背景：透明
- 颜色：与应用主题一致

- [ ] **Step 2: 验证图标文件存在**

Run: `ls src-tauri/icons/tray-icon.png`
Expected: 文件存在

- [ ] **Step 3: 提交更改**

```bash
git add src-tauri/icons/tray-icon.png
git commit -m "feat: add tray icon image"
```

---

### Task 3: 添加托盘初始化代码

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: 导入托盘插件**

```rust
// src-tauri/src/lib.rs

mod capture;
pub mod config;
mod windows;

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
use tauri_plugin_tray::TrayIconBuilder;
```

- [ ] **Step 2: 添加托盘初始化函数**

```rust
// src-tauri/src/lib.rs

fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("WinScope")
        .on_tray_icon_event(|tray, event| {
            if let tauri::tray::TrayIconEvent::Click {
                button: tauri::tray::MouseButton::Left,
                button_state: tauri::tray::MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
        })
        .menu(|app| {
            let show_item = tauri::menu::MenuItemBuilder::new("显示主窗口")
                .id("show")
                .build(app);
            let pause_item = tauri::menu::MenuItemBuilder::new("暂停截图")
                .id("pause")
                .build(app);
            let top_item = tauri::menu::MenuItemBuilder::new("窗口置顶")
                .id("top")
                .build(app);
            let quit_item = tauri::menu::MenuItemBuilder::new("退出")
                .id("quit")
                .build(app);

            let menu = tauri::menu::MenuBuilder::new(app)
                .item(&show_item)
                .item(&pause_item)
                .item(&top_item)
                .separator()
                .item(&quit_item)
                .build()?;

            Ok(menu)
        })
        .on_menu_event(|app, event| {
            match event.id().as_ref() {
                "show" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "pause" => {
                    let _ = app.emit("toggle-pause", ());
                }
                "top" => {
                    let _ = app.emit("toggle-always-on-top", ());
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .build(app)?;

    Ok(())
}
```

- [ ] **Step 3: 在 setup 中调用托盘初始化**

```rust
// src-tauri/src/lib.rs

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let config = config::load_config(app.handle());
            app.manage(AppState {
                config: Mutex::new(config),
                stop_senders: Mutex::new(HashMap::new()),
            });

            // Apply dark title bar on startup
            if let Some(webview_window) = app.get_webview_window("main") {
                if let Ok(hwnd_val) = webview_window.hwnd() {
                    apply_title_bar_dark(HWND(hwnd_val.0 as *mut _), true);
                }
            }

            // Setup system tray
            setup_tray(app)?;

            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_tray::Builder::new().build())
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
            minimize_to_tray
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 4: 添加 minimize_to_tray 命令**

```rust
// src-tauri/src/lib.rs

#[tauri::command]
fn minimize_to_tray(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.hide().map_err(|e| format!("Failed to hide window: {}", e))?;
    }
    Ok(())
}
```

- [ ] **Step 5: 验证编译成功**

Run: `cd src-tauri && cargo check`
Expected: PASS

- [ ] **Step 6: 提交更改**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: add system tray initialization and minimize_to_tray command"
```

---

### Task 4: 更新 Tauri 权限配置

**Files:**
- Modify: `src-tauri/capabilities/default.json`

- [ ] **Step 1: 添加托盘权限**

```json
// src-tauri/capabilities/default.json

{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:default",
    "global-shortcut:default",
    "tray:default",
    "window:default",
    "window:allow-show",
    "window:allow-hide",
    "window:allow-set-focus",
    "window:allow-is-visible",
    "window:allow-close",
    "window:allow-minimize",
    "window:allow-unminimize",
    "window:allow-set-always-on-top",
    "window:allow-set-fullscreen",
    "window:allow-inner-size",
    "window:allow-outer-position"
  ]
}
```

- [ ] **Step 2: 验证权限配置正确**

Run: `cd src-tauri && cargo check`
Expected: PASS

- [ ] **Step 3: 提交更改**

```bash
git add src-tauri/capabilities/default.json
git commit -m "feat: add tray permissions to capabilities"
```

---

### Task 5: 更新前端处理关闭按钮

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: 导入 invoke 函数**

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

import { Toolbar } from "./components/Toolbar";
import { SettingsPanel } from "./components/SettingsPanel";
import { useTranslation } from "./i18n/index.tsx";
import { useTheme } from "./theme.tsx";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";
import { Maximize, Minimize, Plus, Minus, RotateCcw } from "lucide-react";
```

- [ ] **Step 2: 添加关闭事件处理**

```typescript
// src/App.tsx

  // Handle window close - minimize to tray instead of quitting
  useEffect(() => {
    const setup = async () => {
      const win = getCurrentWebviewWindow();
      
      // Listen for close event
      await win.onCloseRequested(async (event) => {
        // Prevent default close behavior
        event.preventDefault();
        
        // Minimize to tray
        try {
          await invoke("minimize_to_tray");
        } catch (e) {
          console.error("Failed to minimize to tray:", e);
        }
      });
    };
    
    setup();
  }, []);
```

- [ ] **Step 3: 添加托盘事件监听**

```typescript
// src/App.tsx

  // Listen for tray events
  useEffect(() => {
    const setup = async () => {
      // Listen for toggle-pause event from tray
      const unlistenPause = await listen("toggle-pause", () => {
        capture.setPaused(!capture.paused);
      });

      // Listen for toggle-always-on-top event from tray
      const unlistenTop = await listen("toggle-always-on-top", () => {
        const cfg = capture.config;
        if (cfg) {
          const newOnTop = !cfg.always_on_top;
          getCurrentWebviewWindow().setAlwaysOnTop(newOnTop);
          capture.updateConfig({ ...cfg, always_on_top: newOnTop });
        }
      });

      return () => {
        unlistenPause();
        unlistenTop();
      };
    };
    
    setup();
  }, [capture.paused, capture.config, capture.setPaused, capture.updateConfig]);
```

- [ ] **Step 4: 运行 TypeScript 检查**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: 提交更改**

```bash
git add src/App.tsx
git commit -m "feat: handle window close to minimize to tray"
```

---

### Task 6: 添加国际化翻译

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
  "tray.quit": "退出"
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
  "tray.quit": "Quit"
}
```

- [ ] **Step 3: 提交更改**

```bash
git add src/i18n/locales/zh-CN.json src/i18n/locales/en-US.json
git commit -m "feat: add i18n translations for tray feature"
```

---

### Task 7: 端到端测试

**Files:**
- Create: `e2e-tests/test/tray.spec.js`

- [ ] **Step 1: 创建托盘功能测试**

```javascript
// e2e-tests/test/tray.spec.js

const { expect } = require("chai");

describe("System Tray Feature", () => {
  it("should minimize to tray when clicking close button", async () => {
    // Get the main window
    const mainWindow = await browser.getWindowHandle();
    
    // Click close button
    const closeButton = await $('[data-testid="close-button"]');
    await closeButton.click();
    
    // Wait for window to hide
    await browser.pause(500);
    
    // Check if window is visible
    const isVisible = await browser.execute(() => {
      return document.visibilityState === "visible";
    });
    
    expect(isVisible).to.be.false;
  });

  it("should restore window when double-clicking tray icon", async () => {
    // This test requires manual interaction with tray icon
    // Skip in automated tests
    this.skip();
  });
});
```

- [ ] **Step 2: 运行测试**

Run: `cd e2e-tests && npx wdio run wdio.conf.js --spec test/tray.spec.js`
Expected: PASS (or SKIP for manual tests)

- [ ] **Step 3: 提交更改**

```bash
git add e2e-tests/test/tray.spec.js
git commit -m "test: add e2e tests for system tray feature"
```

---

### Task 8: 最终集成测试

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
git commit -m "feat: complete system tray feature implementation"
```

---

## 验证清单

- [ ] 托盘图标正确显示
- [ ] 关闭按钮最小化到托盘
- [ ] 双击托盘图标恢复窗口
- [ ] 托盘菜单功能正常
- [ ] 暂停/恢复截图功能正常
- [ ] 窗口置顶切换功能正常
- [ ] 退出应用功能正常
- [ ] 所有测试通过
- [ ] 代码无 TypeScript 错误
- [ ] 代码无 ESLint 错误
- [ ] 应用正常构建
