# Window Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Windows desktop app that displays real-time thumbnail screenshots of foreground GUI windows for monitoring during game AFK or multi-window browsing.

**Architecture:** Tauri v2 app with React+TypeScript frontend and Rust backend. Uses the `windows-capture` crate for WinRT Graphics Capture API to capture individual windows including hardware-accelerated content (games, GPU browsers). Each monitored window gets a dedicated capture thread. Frames are downscaled, PNG-encoded, and sent to the frontend as base64 via Tauri events. Frontend renders a responsive grid of thumbnail cards.

**Tech Stack:** Rust, TypeScript, React, Tauri v2, `windows-capture` crate, `image` crate, TailwindCSS v4, Lucide React

**Design spec:** `docs/superpowers/specs/2026-04-30-window-monitor-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src-tauri/Cargo.toml` | Rust dependencies |
| Create | `src-tauri/src/main.rs` | Tauri entry point, commands, state setup |
| Create | `src-tauri/src/capture.rs` | Window capture engine (GraphicsCaptureApiHandler) |
| Create | `src-tauri/src/windows.rs` | Window enumeration wrapper |
| Create | `src-tauri/src/config.rs` | Config load/save with serde |
| Create | `src-tauri/tauri.conf.json` | Tauri app configuration |
| Create | `src-tauri/capabilities/default.json` | Tauri permissions |
| Create | `src/types.ts` | Shared TypeScript types |
| Create | `src/App.tsx` | Main layout |
| Create | `src/main.tsx` | React entry |
| Create | `src/index.css` | Tailwind import |
| Create | `src/components/WindowGrid.tsx` | Grid container for window cards |
| Create | `src/components/WindowCard.tsx` | Individual window thumbnail card |
| Create | `src/components/Toolbar.tsx` | Top toolbar with controls |
| Create | `src/components/SettingsPanel.tsx` | Collapsible sidebar for window filter |
| Create | `src/hooks/useCapture.ts` | Hook for capture event subscription |
| Create | `package.json` | Frontend dependencies |
| Create | `vite.config.ts` | Vite + Tailwind config |
| Create | `index.html` | HTML entry point |

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/index.css`
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/capabilities/default.json`
- Create: `src-tauri/build.rs`

- [ ] **Step 1: Create Tauri v2 project with React + TypeScript**

Run:
```bash
cd d:/Project/screen-capture
npm create vite@latest . -- --template react-ts
```

If prompted about non-empty directory, confirm overwrite. Then install dependencies:
```bash
npm install
npm install -D @tauri-apps/cli@latest
npm install @tauri-apps/api
npm install -D tailwindcss @tailwindcss/vite
npm install lucide-react
```

- [ ] **Step 2: Initialize Tauri backend**

Run:
```bash
npx tauri init
```

Answer prompts:
- App name: `window-monitor`
- Window title: `Window Monitor`
- Dev server URL: `http://localhost:5173`
- Dev command: `npm run dev`
- Build command: `npm run build`
- Output directory: `../dist`

- [ ] **Step 3: Configure frontend build**

Replace `vite.config.ts`:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 5174 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
});
```

Replace `src/index.css`:

```css
@import "tailwindcss";

html,
body,
#root {
  height: 100%;
  margin: 0;
  overflow: hidden;
}
```

Add `"type": "module"` to `package.json` if not present.

- [ ] **Step 4: Configure Cargo.toml dependencies**

Replace `src-tauri/Cargo.toml`:

```toml
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
image = "0.25"
base64 = "0.22"
```

- [ ] **Step 5: Configure Tauri permissions and verify build**

Replace `src-tauri/capabilities/default.json`:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Window Monitor capabilities",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:allow-set-always-on-top",
    "core:window:allow-set-size",
    "core:window:allow-set-position",
    "core:window:allow-get-size",
    "core:window:allow-get-position"
  ]
}
```

Replace `src-tauri/src/lib.rs` with minimal entry:

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

Replace `src-tauri/src/main.rs`:

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    window_monitor_lib::run()
}
```

Run:
```bash
npx tauri dev
```

Expected: A blank Tauri window opens with "React + TypeScript + Vite" default page. The Rust backend compiles (first build may take several minutes). Close the window to exit.

- [ ] **Step 6: Commit scaffolding**

```bash
git init
git add -A
git commit -m "feat: scaffold Tauri v2 + React + TypeScript project"
```

---

### Task 2: Window Enumeration & Shared Types

**Files:**
- Create: `src-tauri/src/windows.rs`
- Create: `src/types.ts`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Write window enumeration module**

Create `src-tauri/src/windows.rs`:

```rust
use serde::Serialize;
use windows_capture::window::Window;

#[derive(Debug, Clone, Serialize)]
pub struct WindowInfo {
    pub title: String,
    pub process_name: String,
    pub process_id: u32,
}

pub fn enumerate_windows() -> Vec<WindowInfo> {
    match Window::enumerate() {
        Ok(windows) => windows
            .into_iter()
            .filter(|w| w.is_valid())
            .filter_map(|w| {
                let title = w.title().ok()?;
                if title.is_empty() {
                    return None;
                }
                let process_name = w
                    .process_name()
                    .unwrap_or_else(|_| "unknown".to_string());
                let process_id = w.process_id().unwrap_or(0);
                Some(WindowInfo {
                    title,
                    process_name,
                    process_id,
                })
            })
            .collect(),
        Err(e) => {
            eprintln!("Failed to enumerate windows: {}", e);
            Vec::new()
        }
    }
}
```

- [ ] **Step 2: Write frontend TypeScript types**

Create `src/types.ts`:

```typescript
export interface WindowInfo {
  title: string;
  process_name: string;
  process_id: number;
}

export interface CapturePayload {
  title: string;
  image: string;
}

export interface AppConfig {
  monitored_windows: string[];
  hidden_windows: string[];
  refresh_interval_ms: number;
  always_on_top: boolean;
  window_geometry: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
}
```

- [ ] **Step 3: Add enumerate_windows Tauri command**

Modify `src-tauri/src/lib.rs`:

```rust
mod windows;

use windows::WindowInfo;

#[tauri::command]
fn get_windows() -> Vec<WindowInfo> {
    windows::enumerate_windows()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_windows])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 4: Verify window enumeration works**

Run `npx tauri dev`, then open browser DevTools console (F12) and execute:

```javascript
const { invoke } = window.__TAURI__.core;
const wins = await invoke('get_windows');
console.log(wins);
```

Expected: Array of `{ title, process_name, process_id }` objects for all visible windows.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add window enumeration via windows-capture crate"
```

---

### Task 3: Window Capture Engine

**Files:**
- Create: `src-tauri/src/capture.rs`
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: Write capture handler**

Create `src-tauri/src/capture.rs`:

```rust
use std::io::Cursor;
use std::sync::mpsc::Receiver;

use base64::Engine;
use image::imageops::FilterType;
use tauri::{AppHandle, Emitter};
use windows_capture::capture::{Context, GraphicsCaptureApiHandler};
use windows_capture::frame::Frame;
use windows_capture::graphics_capture_api::InternalCaptureControl;
use windows_capture::settings::{
    ColorFormat, CursorCaptureSettings, DirtyRegionSettings, DrawBorderSettings,
    MinimumUpdateIntervalSettings, SecondaryWindowSettings, Settings,
};

use serde::Serialize;

#[derive(Clone, Serialize)]
pub struct CapturePayload {
    pub title: String,
    pub image: String,
}

pub struct WindowCapture {
    app: AppHandle,
    stop_rx: Receiver<()>,
    window_title: String,
    thumbnail_width: u32,
}

impl GraphicsCaptureApiHandler for WindowCapture {
    type Flags = (AppHandle, Receiver<()>, String, u32);
    type Error = Box<dyn std::error::Error + Send + Sync>;

    fn new(ctx: Context<Self::Flags>) -> Result<Self, Self::Error> {
        let (app, stop_rx, window_title, thumbnail_width) = ctx.flags;
        Ok(Self {
            app,
            stop_rx,
            window_title,
            thumbnail_width,
        })
    }

    fn on_frame_arrived(
        &mut self,
        frame: &mut Frame,
        capture_control: InternalCaptureControl,
    ) -> Result<(), Self::Error> {
        // Check stop signal (non-blocking)
        if self.stop_rx.try_recv().is_ok() {
            capture_control.stop();
            return Ok(());
        }

        let width = frame.width();
        let height = frame.height();
        if width == 0 || height == 0 {
            return Ok(());
        }

        // Get raw pixel buffer (BGRA format)
        let mut buffer = frame.buffer()?;
        let mut unpacked = Vec::new();
        let raw = if buffer.has_padding() {
            buffer.as_nopadding_buffer(&mut unpacked);
            unpacked.as_slice()
        } else {
            buffer.as_raw_buffer()
        };

        // Convert BGRA to RGBA
        let mut rgba = raw.to_vec();
        for chunk in rgba.chunks_exact_mut(4) {
            chunk.swap(0, 2);
        }

        // Create image and downscale
        let img = match image::RgbaImage::from_raw(width, height, rgba) {
            Some(img) => img,
            None => return Ok(()),
        };

        let thumb_height = (self.thumbnail_width as f32 * height as f32 / width as f32) as u32;
        let thumbnail =
            image::imageops::resize(&img, self.thumbnail_width, thumb_height, FilterType::Triangle);

        // Encode to PNG
        let mut png_data = Vec::new();
        thumbnail.write_to(&mut Cursor::new(&mut png_data), image::ImageFormat::Png)?;

        // Base64 encode
        let b64 = base64::engine::general_purpose::STANDARD.encode(&png_data);

        // Emit to frontend
        let _ = self.app.emit(
            "capture-update",
            CapturePayload {
                title: self.window_title.clone(),
                image: b64,
            },
        );

        Ok(())
    }

    fn on_closed(&mut self) -> Result<(), Self::Error> {
        Ok(())
    }
}
```

- [ ] **Step 2: Commit capture engine**

```bash
git add -A
git commit -m "feat: add window capture engine with GraphicsCaptureApiHandler"
```

---

### Task 4: Config Management

**Files:**
- Create: `src-tauri/src/config.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Write config module**

Create `src-tauri/src/config.rs`:

```rust
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowGeometry {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    #[serde(default)]
    pub monitored_windows: Vec<String>,
    #[serde(default)]
    pub hidden_windows: Vec<String>,
    #[serde(default = "default_interval")]
    pub refresh_interval_ms: u64,
    #[serde(default)]
    pub always_on_top: bool,
    #[serde(default)]
    pub window_geometry: Option<WindowGeometry>,
}

fn default_interval() -> u64 {
    1500
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            monitored_windows: Vec::new(),
            hidden_windows: Vec::new(),
            refresh_interval_ms: 1500,
            always_on_top: false,
            window_geometry: None,
        }
    }
}

pub fn config_path(app: &tauri::AppHandle) -> PathBuf {
    app.path().app_data_dir().unwrap().join("config.json")
}

pub fn load_config(app: &tauri::AppHandle) -> AppConfig {
    let path = config_path(app);
    match fs::read_to_string(&path) {
        Ok(data) => serde_json::from_str(&data).unwrap_or_default(),
        Err(_) => AppConfig::default(),
    }
}

pub fn save_config(app: &tauri::AppHandle, config: &AppConfig) -> Result<(), String> {
    let path = config_path(app);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let data = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(&path, data).map_err(|e| e.to_string())
}
```

- [ ] **Step 2: Add config Tauri commands**

Add to `src-tauri/src/lib.rs`:

```rust
mod capture;
mod config;
mod windows;

use capture::CapturePayload;
use config::AppConfig;
use std::collections::HashMap;
use std::sync::mpsc::{channel, Sender};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};
use windows::WindowInfo;

struct AppState {
    config: Mutex<AppConfig>,
    stop_senders: Mutex<HashMap<String, Sender<()>>>,
}

#[tauri::command]
fn get_windows() -> Vec<WindowInfo> {
    windows::enumerate_windows()
}

#[tauri::command]
fn get_config(state: State<'_, AppState>) -> AppConfig {
    state.config.lock().unwrap().clone()
}

#[tauri::command]
fn update_config(
    app: AppHandle,
    state: State<'_, AppState>,
    config: AppConfig,
) -> Result<(), String> {
    config::save_config(&app, &config)?;
    *state.config.lock().unwrap() = config;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let config = config::load_config(app.handle());
            app.manage(AppState {
                config: Mutex::new(config),
                stop_senders: Mutex::new(HashMap::new()),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_windows, get_config, update_config])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3: Verify config commands**

Run `npx tauri dev`, open DevTools console:

```javascript
const { invoke } = window.__TAURI__.core;
const cfg = await invoke('get_config');
console.log(cfg);
// Should show default config
await invoke('update_config', { config: { ...cfg, always_on_top: true } });
const cfg2 = await invoke('get_config');
console.log(cfg2);
// Should show always_on_top: true
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add config management with JSON persistence"
```

---

### Task 5: Capture Manager & Tauri Integration

**Files:**
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/capture.rs`

- [ ] **Step 1: Add start_capture and stop_capture commands**

Add these commands to `src-tauri/src/lib.rs`:

```rust
use windows_capture::window::Window;
use windows_capture::settings::{
    ColorFormat, CursorCaptureSettings, DirtyRegionSettings, DrawBorderSettings,
    MinimumUpdateIntervalSettings, SecondaryWindowSettings, Settings,
};

#[tauri::command]
fn start_capture(
    app: AppHandle,
    state: State<'_, AppState>,
    window_title: String,
) -> Result<(), String> {
    // Don't start duplicate captures
    {
        let senders = state.stop_senders.lock().unwrap();
        if senders.contains_key(&window_title) {
            return Ok(());
        }
    }

    // Find the window
    let win = Window::from_contains_name(&window_title)
        .map_err(|e| format!("Window not found: {}", e))?;

    let item = win
        .as_capture_item()
        .map_err(|e| format!("Failed to create capture item: {}", e))?;

    let interval_ms = state.config.lock().unwrap().refresh_interval_ms;
    let (stop_tx, stop_rx) = channel::<()>();

    // Store stop sender
    state
        .stop_senders
        .lock()
        .unwrap()
        .insert(window_title.clone(), stop_tx);

    let title_clone = window_title.clone();
    let app_clone = app.clone();

    std::thread::spawn(move || {
        let settings = Settings::new(
            item,
            CursorCaptureSettings::WithoutCursor,
            DrawBorderSettings::WithoutBorder,
            SecondaryWindowSettings::Default,
            MinimumUpdateIntervalSettings::Custom(std::time::Duration::from_millis(
                interval_ms,
            )),
            DirtyRegionSettings::Default,
            ColorFormat::Bgra8,
            (app_clone, stop_rx, title_clone, 320u32),
        );

        if let Err(e) = capture::WindowCapture::start(settings) {
            eprintln!("Capture error: {}", e);
        }
    });

    Ok(())
}

#[tauri::command]
fn stop_capture(
    state: State<'_, AppState>,
    window_title: String,
) -> Result<(), String> {
    if let Some(sender) = state.stop_senders.lock().unwrap().remove(&window_title) {
        let _ = sender.send(());
    }
    Ok(())
}

#[tauri::command]
fn bring_to_front(window_title: String) -> Result<(), String> {
    let win = Window::from_contains_name(&window_title)
        .map_err(|e| format!("Window not found: {}", e))?;
    // The windows-capture Window type wraps an HWND internally.
    // Use the windows crate to call SetForegroundWindow.
    use windows::Win32::UI::WindowsAndMessaging::SetForegroundWindow;
    use windows::Win32::Foundation::HWND;
    // Get the raw HWND from the Window's internal representation.
    // Window::foreground() returns the foreground window; we need our specific window.
    // Since Window wraps an HWND, we reconstruct it via title match.
    // The simplest approach is to find the hwnd via EnumWindows.
    // For now, we try to use Window's internal hwnd if accessible,
    // otherwise fall back to EnumWindows title matching.
    let hwnd = HWND(win.hwnd().map_err(|e| e.to_string())? as *mut _);
    unsafe {
        SetForegroundWindow(hwnd).ok().map_err(|e| format!("SetForegroundWindow failed: {}", e))?;
    }
    Ok(())
}
```

Update the `invoke_handler` registration:

```rust
.invoke_handler(tauri::generate_handler![
    get_windows,
    get_config,
    update_config,
    start_capture,
    stop_capture,
    bring_to_front
])
```

Note: The `Window::hwnd()` and `Window::as_capture_item()` methods need to be verified against the actual `windows-capture` crate API. If `Window` doesn't expose `hwnd()` directly, the `bring_to_front` command will need to use the `windows` crate's `FindWindowW` or `EnumWindows` to locate the window by title. Similarly, if `Window` doesn't have `as_capture_item()`, use `GraphicsCaptureItem::from_window_title()` or convert via the `Into<GraphicsCaptureItem>` trait.

- [ ] **Step 2: Add `windows` crate dependency for SetForegroundWindow**

Add to `src-tauri/Cargo.toml` dependencies:

```toml
windows = { version = "0.58", features = [
    "Win32_Foundation",
    "Win32_UI_WindowsAndMessaging",
] }
```

- [ ] **Step 3: Verify capture pipeline end-to-end**

Run `npx tauri dev`, open DevTools console:

```javascript
const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

// Start listening for capture events
const unlisten = await listen('capture-update', (event) => {
    console.log('Capture from:', event.payload.title, 'image size:', event.payload.image.length);
});

// Start capturing a window (use a title substring that matches an open window)
await invoke('start_capture', { windowTitle: 'Notepad' });

// Wait 3 seconds, should see capture events in console
// Then stop
await new Promise(r => setTimeout(r, 3000));
await invoke('stop_capture', { windowTitle: 'Notepad' });
unlisten();
```

Expected: Console logs showing capture events with base64 image data every ~1.5 seconds.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add capture manager with start/stop commands and bring-to-front"
```

---

### Task 6: Frontend - Types, Hooks & Data Layer

**Files:**
- Create: `src/hooks/useCapture.ts`
- Modify: `src/types.ts` (already created in Task 2)

- [ ] **Step 1: Write capture data hook**

Create `src/hooks/useCapture.ts`:

```typescript
import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { WindowInfo, CapturePayload, AppConfig } from "../types";

export function useCapture() {
  const [windows, setWindows] = useState<WindowInfo[]>([]);
  const [captures, setCaptures] = useState<Map<string, string>>(new Map());
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [activeCaptures, setActiveCaptures] = useState<Set<string>>(new Set());
  const [paused, setPaused] = useState(false);

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
      } catch (e) {
        console.error("Failed to load initial data:", e);
      }
    }
    load();
  }, []);

  // Listen for capture updates
  useEffect(() => {
    const unlisten = listen<CapturePayload>("capture-update", (event) => {
      if (!paused) {
        setCaptures((prev) => {
          const next = new Map(prev);
          next.set(event.payload.title, event.payload.image);
          return next;
        });
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [paused]);

  // Refresh window list periodically
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const windowList = await invoke<WindowInfo[]>("get_windows");
        setWindows(windowList);
      } catch {
        // Window enumeration might fail transiently
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const startCapture = useCallback(async (title: string) => {
    try {
      await invoke("start_capture", { windowTitle: title });
      setActiveCaptures((prev) => new Set(prev).add(title));
    } catch (e) {
      console.error("Failed to start capture:", e);
    }
  }, []);

  const stopCapture = useCallback(async (title: string) => {
    try {
      await invoke("stop_capture", { windowTitle: title });
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
    } catch (e) {
      console.error("Failed to stop capture:", e);
    }
  }, []);

  const bringToFront = useCallback(async (title: string) => {
    try {
      await invoke("bring_to_front", { windowTitle: title });
    } catch (e) {
      console.error("Failed to bring to front:", e);
    }
  }, []);

  const updateConfig = useCallback(
    async (newConfig: AppConfig) => {
      try {
        await invoke("update_config", { config: newConfig });
        setConfig(newConfig);
      } catch (e) {
        console.error("Failed to update config:", e);
      }
    },
    []
  );

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
  };
}
```

- [ ] **Step 2: Verify hook works with DevTools**

Temporarily add to `src/App.tsx` for testing:

```tsx
import { useCapture } from "./hooks/useCapture";

function App() {
  const { windows, captures, startCapture } = useCapture();
  return (
    <div>
      <h2>Windows ({windows.length})</h2>
      <ul>
        {windows.map((w) => (
          <li key={w.title}>
            {w.title} ({w.process_name})
            <button onClick={() => startCapture(w.title)}>Capture</button>
            {captures.has(w.title) && " [capturing]"}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
```

Run `npx tauri dev`. Expected: List of windows with "Capture" buttons. Clicking a button starts capture and shows "[capturing]".

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add useCapture hook with capture event subscription"
```

---

### Task 7: Frontend - Main Layout & Window Grid

**Files:**
- Modify: `src/App.tsx`
- Create: `src/components/WindowGrid.tsx`
- Create: `src/components/WindowCard.tsx`

- [ ] **Step 1: Write WindowCard component**

Create `src/components/WindowCard.tsx`:

```tsx
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
```

- [ ] **Step 2: Write WindowGrid component**

Create `src/components/WindowGrid.tsx`:

```tsx
import type { WindowInfo } from "../types";
import { WindowCard } from "./WindowCard";

interface WindowGridProps {
  windows: WindowInfo[];
  captures: Map<string, string>;
  activeCaptures: Set<string>;
  hiddenWindows: string[];
  onBringToFront: (title: string) => void;
}

export function WindowGrid({
  windows,
  captures,
  activeCaptures,
  hiddenWindows,
  onBringToFront,
}: WindowGridProps) {
  const visibleWindows = windows.filter(
    (w) =>
      activeCaptures.has(w.title) &&
      !hiddenWindows.includes(w.process_name)
  );

  if (visibleWindows.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <p className="text-lg mb-2">No windows being monitored</p>
          <p className="text-sm">
            Open the settings panel and select windows to monitor
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 auto-rows-min">
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

- [ ] **Step 3: Write main App layout**

Replace `src/App.tsx`:

```tsx
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
      <div className="h-full flex items-center justify-center text-gray-500">
        Loading...
      </div>
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
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add WindowCard, WindowGrid, and main App layout"
```

---

### Task 8: Frontend - Settings Panel & Toolbar

**Files:**
- Create: `src/components/SettingsPanel.tsx`
- Create: `src/components/Toolbar.tsx`

- [ ] **Step 1: Write SettingsPanel component**

Create `src/components/SettingsPanel.tsx`:

```tsx
import type { WindowInfo, AppConfig } from "../types";
import { Eye, EyeOff, X, Monitor, MonitorOff } from "lucide-react";

interface SettingsPanelProps {
  windows: WindowInfo[];
  config: AppConfig;
  activeCaptures: Set<string>;
  onStartCapture: (title: string) => void;
  onStopCapture: (title: string) => void;
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
  const toggleHidden = (processName: string) => {
    const newConfig = { ...config };
    if (newConfig.hidden_windows.includes(processName)) {
      newConfig.hidden_windows = newConfig.hidden_windows.filter(
        (p) => p !== processName
      );
    } else {
      newConfig.hidden_windows = [...newConfig.hidden_windows, processName];
    }
    onUpdateConfig(newConfig);
  };

  return (
    <div className="w-72 bg-gray-800 border-l border-gray-700 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <h2 className="text-sm font-semibold">Window Filter</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Window list */}
      <div className="flex-1 overflow-auto">
        {windows.map((w) => {
          const isActive = activeCaptures.has(w.title);
          const isHidden = config.hidden_windows.includes(w.process_name);

          return (
            <div
              key={w.title}
              className="flex items-center gap-2 px-4 py-2 border-b border-gray-700/50 hover:bg-gray-700/50"
            >
              {/* Monitor toggle */}
              <button
                onClick={() =>
                  isActive
                    ? onStopCapture(w.title, w.process_name)
                    : onStartCapture(w.title, w.process_name)
                }
                className="text-gray-400 hover:text-white transition-colors"
                title={isActive ? "Stop monitoring" : "Start monitoring"}
              >
                {isActive ? (
                  <Monitor size={16} className="text-green-400" />
                ) : (
                  <MonitorOff size={16} />
                )}
              </button>

              {/* Hide/show toggle */}
              <button
                onClick={() => toggleHidden(w.process_name)}
                className="text-gray-400 hover:text-white transition-colors"
                title={isHidden ? "Show in grid" : "Hide from grid"}
              >
                {isHidden ? (
                  <EyeOff size={14} />
                ) : (
                  <Eye size={14} />
                )}
              </button>

              {/* Window info */}
              <div className="flex-1 min-w-0">
                <div
                  className="text-sm truncate"
                  title={w.title}
                >
                  {w.title}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {w.process_name}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {windows.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm p-4">
          No windows found
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write Toolbar component**

Create `src/components/Toolbar.tsx`:

```tsx
import type { AppConfig } from "../types";
import {
  Pin,
  PinOff,
  Settings,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/webviewWindow";

interface ToolbarProps {
  paused: boolean;
  setPaused: (paused: boolean) => void;
  config: AppConfig;
  onUpdateConfig: (config: AppConfig) => void;
  onToggleSettings: () => void;
}

const INTERVALS = [
  { label: "1s", value: 1000 },
  { label: "1.5s", value: 1500 },
  { label: "2s", value: 2000 },
  { label: "3s", value: 3000 },
];

export function Toolbar({
  paused,
  setPaused,
  config,
  onUpdateConfig,
  onToggleSettings,
}: ToolbarProps) {
  const toggleAlwaysOnTop = async () => {
    const newOnTop = !config.always_on_top;
    const appWindow = getCurrentWindow();
    await appWindow.setAlwaysOnTop(newOnTop);
    onUpdateConfig({ ...config, always_on_top: newOnTop });
  };

  const setInterval = (ms: number) => {
    onUpdateConfig({ ...config, refresh_interval_ms: ms });
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-gray-800 border-b border-gray-700">
      {/* Always on top */}
      <button
        onClick={toggleAlwaysOnTop}
        className={`flex items-center gap-1 px-2 py-1 rounded text-sm transition-colors ${
          config.always_on_top
            ? "bg-blue-600 text-white"
            : "text-gray-400 hover:text-white hover:bg-gray-700"
        }`}
        title={config.always_on_top ? "Unpin from top" : "Pin to top"}
      >
        {config.always_on_top ? <PinOff size={14} /> : <Pin size={14} />}
        {config.always_on_top ? "Pinned" : "Pin"}
      </button>

      {/* Pause/Resume */}
      <button
        onClick={() => setPaused(!paused)}
        className={`flex items-center gap-1 px-2 py-1 rounded text-sm transition-colors ${
          paused
            ? "bg-yellow-600 text-white"
            : "text-gray-400 hover:text-white hover:bg-gray-700"
        }`}
      >
        {paused ? <Play size={14} /> : <Pause size={14} />}
        {paused ? "Resume" : "Pause"}
      </button>

      {/* Refresh interval */}
      <div className="flex items-center gap-1 ml-2">
        <RotateCcw size={14} className="text-gray-500" />
        {INTERVALS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setInterval(value)}
            className={`px-2 py-1 rounded text-xs transition-colors ${
              config.refresh_interval_ms === value
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:text-white hover:bg-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Settings */}
      <button
        onClick={onToggleSettings}
        className="text-gray-400 hover:text-white transition-colors"
        title="Window filter"
      >
        <Settings size={18} />
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Apply always-on-top on startup**

Modify `src/App.tsx` to apply saved always-on-top state on mount. Add this to the `useCapture` hook in `src/hooks/useCapture.ts`, inside the initial load effect:

```typescript
import { getCurrentWindow } from "@tauri-apps/api/webviewWindow";

// Inside the useEffect for initial load, after setting config:
if (appConfig.always_on_top) {
    getCurrentWindow().setAlwaysOnTop(true);
}
```

- [ ] **Step 4: End-to-end test**

Run `npx tauri dev`. Verify:
1. App shows toolbar with Pin, Pause, and interval buttons
2. Clicking Settings icon opens the right sidebar
3. Sidebar shows all visible windows with Monitor/Hide toggles
4. Clicking Monitor on a window starts showing its thumbnail in the grid
5. Thumbnails refresh every ~1.5 seconds
6. Clicking Pin makes the window always on top
7. Double-clicking a thumbnail brings that window to front
8. Clicking Pause stops thumbnail updates

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add SettingsPanel and Toolbar with full controls"
```

---

### Task 9: Integration & Polish

**Files:**
- Modify: `src-tauri/src/lib.rs` — add window-close cleanup
- Modify: `src/hooks/useCapture.ts` — add auto-start from config

- [ ] **Step 1: Auto-start captures from saved config**

Add to `src/hooks/useCapture.ts` — after loading config, automatically start captures for `monitored_windows`:

```typescript
// In the initial load useEffect, after setConfig(appConfig):
if (appConfig.monitored_windows.length > 0) {
    // Match saved process names to current windows
    const savedNames = new Set(appConfig.monitored_windows);
    const matches = windowList.filter((w) => savedNames.has(w.process_name));
    for (const w of matches) {
        try {
            await invoke("start_capture", { windowTitle: w.title });
        } catch {
            // Window might not exist anymore
        }
    }
}
```

Also update `monitored_windows` in config when starting/stopping captures. Modify `startCapture` and `stopCapture` in the hook:

```typescript
const startCapture = useCallback(
    async (title: string, processName: string) => {
        try {
            await invoke("start_capture", { windowTitle: title });
            setActiveCaptures((prev) => new Set(prev).add(title));
            // Persist to config
            if (config && !config.monitored_windows.includes(processName)) {
                const newConfig = {
                    ...config,
                    monitored_windows: [...config.monitored_windows, processName],
                };
                await invoke("update_config", { config: newConfig });
                setConfig(newConfig);
            }
        } catch (e) {
            console.error("Failed to start capture:", e);
        }
    },
    [config]
);

const stopCapture = useCallback(
    async (title: string, processName: string) => {
        try {
            await invoke("stop_capture", { windowTitle: title });
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
            // Remove from config
            if (config) {
                const newConfig = {
                    ...config,
                    monitored_windows: config.monitored_windows.filter(
                        (p) => p !== processName
                    ),
                };
                await invoke("update_config", { config: newConfig });
                setConfig(newConfig);
            }
        } catch (e) {
            console.error("Failed to stop capture:", e);
        }
    },
    [config]
);
```

Update component calls to pass `processName` as well.

- [ ] **Step 2: Clean up stale captures when windows close**

In `src-tauri/src/lib.rs`, add cleanup in the `start_capture` thread — when the capture thread exits (because the window closed), remove it from `stop_senders`:

```rust
// At the end of the thread spawn in start_capture, after Capture::start returns:
state.stop_senders.lock().unwrap().remove(&title_clone);
let _ = app_clone.emit("capture-closed", title_clone);
```

Add a listener in the frontend hook:

```typescript
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
    });
    return () => {
        unlisten.then((fn) => fn());
    };
}, []);
```

- [ ] **Step 3: Final build and verification**

Run:
```bash
npx tauri build
```

Expected: Build succeeds and produces a single `.exe` in `src-tauri/target/release/`.

Manual verification checklist:
- [ ] App opens and shows toolbar
- [ ] Window list populates in settings panel
- [ ] Starting capture on a window shows live thumbnails
- [ ] Thumbnails update every ~1.5 seconds
- [ ] Pausing stops updates, resuming continues
- [ ] Pin keeps window on top of other windows
- [ ] Double-click brings target window to front
- [ ] Closing a captured window removes it from grid
- [ ] Restarting app restores previous monitored windows
- [ ] Closing and reopening the app remembers window position (if geometry was set)

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: add auto-start from config and window-close cleanup"
```

---

## Known Limitations & Future Enhancements

1. **Full-screen exclusive games**: The WinRT Graphics Capture API may not capture full-screen exclusive DirectX games. Windowed or borderless-windowed mode works. A future enhancement could add DXGI Desktop Duplication as a fallback.

2. **Yellow border notification**: Windows shows a yellow border (or notification icon on Win11) around windows being captured. This is a Windows security feature that cannot be suppressed.

3. **Window matching by process name**: The config stores `monitored_windows` as process names. If multiple windows share the same process name (e.g., multiple Chrome windows), all will be monitored. Future: match by window title pattern.

4. **Window geometry persistence**: The current plan saves geometry in config but doesn't read/apply it on startup. This can be added by reading the geometry from config in the Tauri `setup` hook and resizing the main window.
