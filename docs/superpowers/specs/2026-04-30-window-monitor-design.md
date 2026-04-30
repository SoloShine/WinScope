# Window Monitor - Multi-Window Real-Time Screenshot Monitor

## Overview

A lightweight Windows desktop application that displays real-time thumbnail screenshots of all foreground GUI windows. Designed for monitoring game AFK sessions, multi-window browsing, and general multi-tasking awareness.

## Requirements

### Functional Requirements

- Automatically enumerate and display all visible foreground windows as thumbnail screenshots
- Refresh screenshots at configurable intervals (default 1.5 seconds)
- Users can select which windows to monitor via a filter panel
- Window selection persists across application restarts
- Toggleable always-on-top mode for use during gaming
- Double-click a thumbnail to bring the corresponding window to front
- Remember window position and size between sessions

### Non-Functional Requirements

- Windows 10 1903+ (Build 18362) or later
- Low CPU/memory footprint (target: <100MB RAM, <5% CPU with 5 windows monitored)
- Single executable, no external runtime dependencies
- Application size target: <10MB

### Out of Scope

- Video recording or saving screenshots to disk
- Remote monitoring over network
- Window content interaction (click-through, keyboard forwarding)
- Audio capture
- Cross-platform support (Windows only)

## Architecture

```
┌─────────────────────────────────────────────┐
│                Tauri Desktop App             │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │      Frontend (React + TypeScript)   │    │
│  │                                     │    │
│  │  ┌──────────┐  ┌──────────────────┐ │    │
│  │  │ Window   │  │  Settings/Filter │ │    │
│  │  │ Grid     │  │  Panel           │ │    │
│  │  │ View     │  │  Window select   │ │    │
│  │  └──────────┘  └──────────────────┘ │    │
│  └──────────────────┬──────────────────┘    │
│                     │ Tauri IPC              │
│  ┌──────────────────┴──────────────────┐    │
│  │         Backend (Rust)               │    │
│  │                                     │    │
│  │  ┌─────────────┐ ┌──────────────┐  │    │
│  │  │ Window      │ │ Capture      │  │    │
│  │  │ Enumerator  │ │ Engine       │  │    │
│  │  │ EnumWindows │ │ WinRT        │  │    │
│  │  └─────────────┘ │ Graphics     │  │    │
│  │  ┌─────────────┐ │ Capture API  │  │    │
│  │  │ Scheduler   │ └──────────────┘  │    │
│  │  │ 1.5s ticker │ ┌──────────────┐  │    │
│  │  └─────────────┘ │ Config       │  │    │
│  │                  │ Manager      │  │    │
│  │                  └──────────────┘  │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

## Core Modules

### 1. Window Enumerator

- Uses Win32 `EnumWindows` API to iterate all top-level windows
- Filters: only visible windows (`IsWindowVisible`), with non-empty titles, excluding system tool windows
- Returns per-window metadata: hwnd, title, process name, process icon
- Window list refreshed every 5 seconds (window composition changes infrequently)

### 2. Capture Engine

- Uses `Windows.Graphics.Capture` WinRT API via the `windows` Rust crate
- Per-monitored-window `GraphicsCaptureItem` session management
- Capture pipeline:
  1. Create `GraphicsCaptureItem` from hwnd
  2. Create Direct3D device + `Direct3DSurface` render target
  3. Call frame capture to get current frame
  4. Encode to PNG, downscale to thumbnail width (320px)
  5. Base64-encode and send to frontend via Tauri IPC event
- Configurable refresh interval (default 1.5s)
- Graceful handling of window close/minimize during capture

### 3. Frontend UI

**Main Window - Grid View:**
- Responsive CSS grid layout of window thumbnail cards
- Each card: screenshot image + window title + process name
- Hover state: enlarged preview overlay
- Double-click: bring target window to foreground (`SetForegroundWindow`)

**Settings/Filter Panel (collapsible sidebar):**
- Full window list with checkboxes
- Checked = visible in grid, unchecked = hidden
- User selections persisted to config file

**Toolbar:**
- Always-on-top toggle button
- Refresh interval selector (1s / 1.5s / 2s / 3s)
- Pause/Resume capture button
- Refresh all button

### 4. Config Manager

- Storage: Tauri `app_data_dir` / `config.json`
- Config schema:
  ```json
  {
    "monitored_windows": ["chrome.exe", "game.exe"],
    "hidden_windows": ["explorer.exe"],
    "refresh_interval_ms": 1500,
    "always_on_top": false,
    "window_geometry": { "x": 100, "y": 100, "width": 800, "height": 600 }
  }
  ```
- Loaded on startup, saved on change
- Window matching by process name (exact match)

## Technology Stack

### Backend (Rust)

| Component | Crate | Purpose |
|-----------|-------|---------|
| App framework | `tauri` v2 | Desktop app shell, IPC, window management |
| Windows API | `windows` | Win32/WinRT calls (EnumWindows, Graphics.Capture) |
| Image processing | `image` | PNG encoding, downscaling |
| Serialization | `serde` + `serde_json` | Config file I/O, IPC data format |
| Base64 | `base64` | Screenshot data encoding for transfer |

### Frontend (React + TypeScript)

| Component | Library | Purpose |
|-----------|---------|---------|
| UI framework | React 18 | Interface construction |
| Build tool | Vite | Development and bundling |
| Styling | TailwindCSS | Rapid UI styling |
| Icons | Lucide React | Toolbar icons |
| State management | React built-in (useState/useReducer) | Sufficient for this scope |

## Project Structure

```
screen-capture/
├── src-tauri/               # Rust backend
│   ├── src/
│   │   ├── main.rs          # Tauri entry point, command registration
│   │   ├── capture.rs       # WinRT capture engine
│   │   ├── windows.rs       # Window enumeration
│   │   └── config.rs        # Config management
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/                     # React frontend
│   ├── App.tsx              # Main layout
│   ├── components/
│   │   ├── WindowGrid.tsx   # Grid container
│   │   ├── WindowCard.tsx   # Individual window card
│   │   ├── Toolbar.tsx      # Top toolbar
│   │   └── SettingsPanel.tsx # Filter/settings sidebar
│   ├── hooks/
│   │   └── useCapture.ts    # Screenshot data hook
│   └── types.ts             # TypeScript type definitions
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

## Data Flow

1. **Startup**: Rust loads config, enumerates windows, sends initial window list to frontend
2. **User configures**: User checks/unchecks windows in filter panel → config saved
3. **Capture loop**: Every N ms, Rust captures screenshots for monitored windows, sends base64 PNG via Tauri events
4. **Frontend update**: React receives events, updates thumbnail images in grid
5. **Interaction**: Double-click → Tauri command → Rust calls `SetForegroundWindow(hwnd)`

## Error Handling

- Window disappears during capture: silently remove from grid, log warning
- Capture API failure (GPU driver issue): fall back to GDI PrintWindow for that window
- Config file corruption: reset to defaults, show notification
- Permission denied (WinRT capture): show explanatory toast notification

## System Requirements

- OS: Windows 10 version 1903 (Build 18362) or later
- No additional runtime required
- GPU: Any GPU supporting DirectX 11 (for WinRT Capture API)
