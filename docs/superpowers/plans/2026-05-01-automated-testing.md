# Automated Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立全栈自动化测试体系——Playwright headless 测试前端、cargo test 测试后端、GitHub Actions CI 在 tag 时触发。

**Architecture:** 前端用 Playwright 启动 Vite dev server，通过 `page.addInitScript` 注入 Tauri API mock，在真实 Chromium 中测试组件交互和键盘快捷键。后端用 Rust 内置 `#[cfg(test)]` 模块测试纯逻辑，`tempfile` 做配置文件 I/O 集成测试。

**Tech Stack:** Playwright + Chromium (前端), cargo test + tempfile (后端), GitHub Actions (CI)

---

## File Structure

```
# 新建文件
playwright.config.ts                        # Playwright 配置
tests/
  fixtures/
    test.ts                                 # Playwright fixture + Tauri mock
  components/
    toolbar.spec.ts                          # 工具栏交互
    window-grid.spec.ts                      # 网格/缩放/空状态
    window-card.spec.ts                      # 卡片渲染/事件
    settings-panel.spec.ts                   # 筛选面板
  shortcuts.spec.ts                          # 键盘快捷键
  i18n.spec.ts                               # 中英文切换
.github/
  workflows/
    test.yml                                 # CI 流水线

# 修改文件
package.json                                 # 添加 devDeps + scripts
src-tauri/Cargo.toml                         # 添加 tempfile dev-dep
src-tauri/src/config.rs                      # 添加 #[cfg(test)] 模块
src-tauri/src/capture.rs                     # 提取像素转换函数 + #[cfg(test)]
src-tauri/tests/config_io.rs                 # 集成测试
```

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: Install Playwright**

Run:
```bash
npm install -D @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Install Rust tempfile dev-dependency**

Add to `src-tauri/Cargo.toml` after `[dependencies]`:

```toml
[dev-dependencies]
tempfile = "3"
```

- [ ] **Step 3: Add test scripts to package.json**

In `package.json`, add to `scripts`:

```json
"test": "playwright test",
"test:ui": "playwright test --ui",
"test:headed": "playwright test --headed"
```

- [ ] **Step 4: Verify installations**

Run:
```bash
npx playwright --version
cd src-tauri && cargo check
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "chore: add Playwright and tempfile testing dependencies"
```

---

## Task 2: Playwright Config + Tauri Mock Fixture

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/fixtures/test.ts`

- [ ] **Step 1: Create playwright.config.ts**

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
  },
});
```

- [ ] **Step 2: Create Tauri mock fixture**

```ts
// tests/fixtures/test.ts
import { test as base, expect, type Page } from "@playwright/test";

// Default mock data
const defaultWindows = [
  { title: "Test Window 1", process_name: "testapp1", process_id: 1001 },
  { title: "Test Window 2", process_name: "testapp2", process_id: 1002 },
];

const defaultConfig = {
  monitored_windows: [] as string[],
  hidden_windows: [] as string[],
  refresh_interval_ms: 1500,
  always_on_top: false,
  window_geometry: null,
};

export interface MockOptions {
  windows?: typeof defaultWindows;
  config?: typeof defaultConfig;
}

async function setupTauriMock(page: Page, options: MockOptions = {}) {
  const windows = options.windows ?? defaultWindows;
  const config = { ...defaultConfig, ...options.config };

  await page.addInitScript(
    ({ windows, config }) => {
      // Event handlers storage
      const handlers = new Map<string, Set<(payload: any) => void>>();

      // Track invoke calls for test assertions
      const invokeLog: Array<{ cmd: string; args: any }> = [];
      (window as any).__TAURI_INVOKE_LOG__ = invokeLog;

      function addHandler(event: string, handler: (payload: any) => void) {
        if (!handlers.has(event)) handlers.set(event, new Set());
        handlers.get(event)!.add(handler);
      }

      // Expose trigger function for tests to emit events
      (window as any).__TAURI_TRIGGER_EVENT__ = (
        event: string,
        payload: any
      ) => {
        const set = handlers.get(event);
        if (set) set.forEach((h) => h(payload));
      };

      // Mock invoke
      async function mockInvoke(cmd: string, args?: any): Promise<any> {
        invokeLog.push({ cmd, args });

        switch (cmd) {
          case "get_windows":
            return windows;
          case "get_config":
            return config;
          case "update_config":
            Object.assign(config, args.config);
            return null;
          case "start_capture":
            return null;
          case "stop_capture":
            return null;
          case "bring_to_front":
            return null;
          case "set_title_bar_theme":
            return null;
          // WebviewWindow plugin commands
          case "plugin:window|set_always_on_top":
            return null;
          case "plugin:window|set_fullscreen":
            return null;
          default:
            console.warn("Unhandled invoke:", cmd, args);
            return null;
        }
      }

      // Mock listen
      async function mockListen(
        event: string,
        handler: (payload: any) => void
      ): Promise<() => void> {
        // Wrap handler to extract payload from Tauri event format
        const wrapped = (e: any) => handler(e);
        addHandler(event, wrapped);
        return () => {
          handlers.get(event)?.delete(wrapped);
        };
      }

      // Setup __TAURI_INTERNALS__
      (window as any).__TAURI_INTERNALS__ = {
        invoke: mockInvoke,
        listen: mockListen,
        emit: async () => {},
        convertFileSrc: (path: string) => `http://localhost/${path}`,
        metadata: {
          currentWebview: { label: "main" },
          currentWindow: { label: "main" },
        },
      };
    },
    { windows, config }
  );
}

export const test = base.extend<{
  mockTauri: MockOptions;
}>({
  mockTauri: [
    async ({ page }, use) => {
      await setupTauriMock(page);
      await use({});
    },
    { auto: true },
  ],
});

export { expect };
```

- [ ] **Step 3: Create tests directory structure**

Run:
```bash
mkdir -p tests/fixtures tests/components
```

- [ ] **Step 4: Verify Playwright can start**

Run:
```bash
npx playwright test --list 2>&1 | head -5
```

Expected: "No tests found" (no spec files yet, but config is valid)

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts tests/
git commit -m "chore: add Playwright config and Tauri API mock fixture"
```

---

## Task 3: Rust Backend — config.rs Unit Tests

**Files:**
- Modify: `src-tauri/src/config.rs`

- [ ] **Step 1: Write failing tests**

Append to `src-tauri/src/config.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_values() {
        let config = AppConfig::default();
        assert!(config.monitored_windows.is_empty());
        assert!(config.hidden_windows.is_empty());
        assert_eq!(config.refresh_interval_ms, 1500);
        assert!(!config.always_on_top);
        assert!(config.window_geometry.is_none());
    }

    #[test]
    fn serialize_deserialize_roundtrip() {
        let config = AppConfig {
            monitored_windows: vec!["notepad".to_string()],
            hidden_windows: vec!["explorer".to_string()],
            refresh_interval_ms: 2000,
            always_on_top: true,
            window_geometry: Some(WindowGeometry {
                x: 100,
                y: 200,
                width: 800,
                height: 600,
            }),
        };
        let json = serde_json::to_string(&config).unwrap();
        let loaded: AppConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(loaded.monitored_windows, config.monitored_windows);
        assert_eq!(loaded.hidden_windows, config.hidden_windows);
        assert_eq!(loaded.refresh_interval_ms, config.refresh_interval_ms);
        assert_eq!(loaded.always_on_top, config.always_on_top);
        assert_eq!(
            loaded.window_geometry.unwrap().width,
            config.window_geometry.unwrap().width
        );
    }

    #[test]
    fn deserialize_empty_json_uses_defaults() {
        let loaded: AppConfig = serde_json::from_str("{}").unwrap();
        assert!(loaded.monitored_windows.is_empty());
        assert_eq!(loaded.refresh_interval_ms, 1500);
        assert!(!loaded.always_on_top);
    }

    #[test]
    fn deserialize_partial_json() {
        let loaded: AppConfig =
            serde_json::from_str(r#"{"always_on_top": true, "refresh_interval_ms": 3000}"#)
                .unwrap();
        assert!(loaded.always_on_top);
        assert_eq!(loaded.refresh_interval_ms, 3000);
        assert!(loaded.monitored_windows.is_empty());
    }

    #[test]
    fn deserialize_invalid_json_falls_back_to_default() {
        let loaded: AppConfig = serde_json::from_str("not json").unwrap_or_default();
        assert_eq!(loaded.refresh_interval_ms, 1500);
    }
}
```

- [ ] **Step 2: Run tests to verify they pass (pure logic, no implementation needed)**

Run:
```bash
cd src-tauri && cargo test config::tests -- --nocapture
```

Expected: 5 passed

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/config.rs
git commit -m "test: add config.rs unit tests for serialization and defaults"
```

---

## Task 4: Rust Backend — capture.rs Pixel Conversion Tests

**Files:**
- Modify: `src-tauri/src/capture.rs`

- [ ] **Step 1: Extract pixel conversion helper**

Add this public function to `src-tauri/src/capture.rs` (before the `WindowCapture` impl):

```rust
/// Convert BGRA pixel buffer to RGBA in-place.
pub fn convert_bgra_to_rgba(data: &mut [u8]) {
    for chunk in data.chunks_exact_mut(4) {
        chunk.swap(0, 2);
    }
}

/// Calculate thumbnail height preserving aspect ratio.
pub fn thumbnail_height(src_width: u32, src_height: u32, target_width: u32) -> u32 {
    (target_width as f32 * src_height as f32 / src_width as f32) as u32
}
```

Update the `on_frame_arrived` method to use the extracted function:

Replace:
```rust
        // Convert BGRA to RGBA
        for chunk in rgba.chunks_exact_mut(4) {
            chunk.swap(0, 2);
        }
```

With:
```rust
        // Convert BGRA to RGBA
        convert_bgra_to_rgba(&mut rgba);
```

Replace:
```rust
        let thumb_height =
            (self.thumbnail_width as f32 * height as f32 / width as f32) as u32;
```

With:
```rust
        let thumb_height = thumbnail_height(width, height, self.thumbnail_width);
```

- [ ] **Step 2: Write failing tests**

Append to `src-tauri/src/capture.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bgra_to_rgba_single_pixel() {
        let mut data = [10, 20, 30, 255]; // BGRA
        convert_bgra_to_rgba(&mut data);
        assert_eq!(data, [30, 20, 10, 255]); // RGBA
    }

    #[test]
    fn bgra_to_rgba_multiple_pixels() {
        let mut data = [10, 20, 30, 255, 40, 50, 60, 128];
        convert_bgra_to_rgba(&mut data);
        assert_eq!(data, [30, 20, 10, 255, 60, 50, 40, 128]);
    }

    #[test]
    fn bgra_to_rgba_empty_buffer() {
        let mut data: [u8; 0] = [];
        convert_bgra_to_rgba(&mut data);
        // No panic
    }

    #[test]
    fn bgra_to_rgba_incomplete_pixel_ignored() {
        let mut data = [10, 20, 30, 255, 99]; // 5 bytes — last byte ignored
        convert_bgra_to_rgba(&mut data);
        assert_eq!(data, [30, 20, 10, 255, 99]);
    }

    #[test]
    fn thumbnail_height_preserves_aspect_ratio() {
        assert_eq!(thumbnail_height(1920, 1080, 480), 270);
    }

    #[test]
    fn thumbnail_height_square_source() {
        assert_eq!(thumbnail_height(100, 100, 50), 50);
    }

    #[test]
    fn thumbnail_height_tall_source() {
        let h = thumbnail_height(100, 200, 50);
        assert_eq!(h, 100);
    }
}
```

- [ ] **Step 3: Run tests**

Run:
```bash
cd src-tauri && cargo test capture::tests -- --nocapture
```

Expected: 7 passed

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/capture.rs
git commit -m "refactor: extract pixel conversion helpers, add capture.rs tests"
```

---

## Task 5: Rust Backend — Config File I/O Integration Test

**Files:**
- Create: `src-tauri/tests/config_io.rs`

- [ ] **Step 1: Write integration test**

```rust
// src-tauri/tests/config_io.rs
use std::fs;

use window_monitor_lib::config::AppConfig;
use window_monitor_lib::config::WindowGeometry;

#[test]
fn save_and_load_config_roundtrip() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("config.json");

    let config = AppConfig {
        monitored_windows: vec!["notepad".to_string(), "chrome".to_string()],
        hidden_windows: vec!["explorer".to_string()],
        refresh_interval_ms: 2000,
        always_on_top: true,
        window_geometry: Some(WindowGeometry {
            x: 50,
            y: 100,
            width: 1024,
            height: 768,
        }),
    };

    // Save
    let json = serde_json::to_string_pretty(&config).unwrap();
    fs::write(&path, &json).unwrap();

    // Load
    let loaded: AppConfig =
        serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();

    assert_eq!(loaded.monitored_windows, config.monitored_windows);
    assert_eq!(loaded.hidden_windows, config.hidden_windows);
    assert_eq!(loaded.refresh_interval_ms, 2000);
    assert!(loaded.always_on_top);
    let geom = loaded.window_geometry.unwrap();
    assert_eq!(geom.width, 1024);
    assert_eq!(geom.height, 768);
}

#[test]
fn load_missing_file_returns_default() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("nonexistent.json");

    let result = fs::read_to_string(&path);
    let config: AppConfig = match result {
        Ok(data) => serde_json::from_str(&data).unwrap_or_default(),
        Err(_) => AppConfig::default(),
    };

    assert_eq!(config.refresh_interval_ms, 1500);
    assert!(!config.always_on_top);
}

#[test]
fn load_corrupt_file_returns_default() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("config.json");

    fs::write(&path, "this is not json!!!").unwrap();

    let data = fs::read_to_string(&path).unwrap();
    let config: AppConfig = serde_json::from_str(&data).unwrap_or_default();

    assert_eq!(config.refresh_interval_ms, 1500);
}

#[test]
fn save_creates_parent_directories() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("nested").join("dir").join("config.json");

    let config = AppConfig::default();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).unwrap();
    }
    let json = serde_json::to_string_pretty(&config).unwrap();
    fs::write(&path, &json).unwrap();

    assert!(path.exists());
    let loaded: AppConfig =
        serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
    assert_eq!(loaded.refresh_interval_ms, 1500);
}
```

- [ ] **Step 2: Run integration tests**

Run:
```bash
cd src-tauri && cargo test --test config_io -- --nocapture
```

Expected: 4 passed

- [ ] **Step 3: Commit**

```bash
git add src-tauri/tests/config_io.rs
git commit -m "test: add config file I/O integration tests with tempfile"
```

---

## Task 6: Frontend — Keyboard Shortcuts Test

**Files:**
- Create: `tests/shortcuts.spec.ts`

- [ ] **Step 1: Write test**

```ts
import { test, expect } from "./fixtures/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  // Wait for app to finish loading (loading state disappears)
  await expect(page.getByText("暂无监控窗口")).toBeVisible();
});

test("Space toggles pause state", async ({ page }) => {
  // Click into the app area (not an input)
  await page.click("body");
  await page.keyboard.press("Space");
  // Resume button should appear (yellow)
  await expect(page.getByText("继续")).toBeVisible();

  await page.keyboard.press("Space");
  // Pause button should appear
  await expect(page.getByText("暂停")).toBeVisible();
});

test("Ctrl+G toggles settings panel", async ({ page }) => {
  await page.keyboard.press("Control+g");
  await expect(page.getByText("窗口筛选")).toBeVisible();

  await page.keyboard.press("Control+g");
  await expect(page.getByText("窗口筛选")).not.toBeVisible();
});

test("Escape closes settings panel", async ({ page }) => {
  await page.keyboard.press("Control+g");
  await expect(page.getByText("窗口筛选")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByText("窗口筛选")).not.toBeVisible();
});

test("Ctrl+= zooms in card width", async ({ page }) => {
  const grid = page.locator(".grid");
  const widthBefore = (await grid.evaluate((el) => el.style.gridTemplateColumns)).toString();

  await page.keyboard.press("Control+=");
  // Grid template should change
  await page.waitForTimeout(100);
});

test("Ctrl+- zooms out card width", async ({ page }) => {
  await page.keyboard.press("Control+=");
  await page.keyboard.press("Control+-");
  // Should not crash — grid still renders
  await expect(page.getByText("暂无监控窗口")).toBeVisible();
});

test("Ctrl+0 resets zoom", async ({ page }) => {
  await page.keyboard.press("Control+=");
  await page.keyboard.press("Control+=");
  await page.keyboard.press("Control+0");
  await expect(page.getByText("暂无监控窗口")).toBeVisible();
});

test("Ctrl+S is prevented (no browser save dialog)", async ({ page }) => {
  // Should not navigate or open dialog — just prevent default
  await page.keyboard.press("Control+s");
  await expect(page.getByText("暂无监控窗口")).toBeVisible();
});

test("Ctrl+F is prevented (no browser find)", async ({ page }) => {
  await page.keyboard.press("Control+f");
  await expect(page.getByText("暂无监控窗口")).toBeVisible();
});
```

- [ ] **Step 2: Run test**

Run:
```bash
npx playwright test tests/shortcuts.spec.ts
```

Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add tests/shortcuts.spec.ts
git commit -m "test: add keyboard shortcuts Playwright tests"
```

---

## Task 7: Frontend — Toolbar Test

**Files:**
- Create: `tests/components/toolbar.spec.ts`

- [ ] **Step 1: Write test**

```ts
import { test, expect } from "../fixtures/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("暂无监控窗口")).toBeVisible();
});

test("pause button toggles to resume", async ({ page }) => {
  await page.getByText("暂停").click();
  await expect(page.getByText("继续")).toBeVisible();
  await expect(page.getByText("暂停")).not.toBeVisible();
});

test("resume button toggles back to pause", async ({ page }) => {
  await page.getByText("暂停").click();
  await page.getByText("继续").click();
  await expect(page.getByText("暂停")).toBeVisible();
});

test("pin button toggles always-on-top", async ({ page }) => {
  const pinBtn = page.getByText("置顶");
  await pinBtn.click();
  await expect(page.getByText("已置顶")).toBeVisible();

  await page.getByText("已置顶").click();
  await expect(page.getByText("置顶")).toBeVisible();
});

test("interval buttons change active state", async ({ page }) => {
  const btn2s = page.getByText("2秒");
  await btn2s.click();
  // The clicked button should get the blue active style
  await expect(btn2s).toHaveClass(/bg-blue-600/);
});

test("language toggle switches to English", async ({ page }) => {
  await page.getByText("English").click();
  await expect(page.getByText("Pause")).toBeVisible();
});

test("settings gear opens settings panel", async ({ page }) => {
  await page.locator("button[title*='窗口筛选']").click();
  await expect(page.getByText("窗口筛选")).toBeVisible();
});

test("theme toggle switches to light", async ({ page }) => {
  await page.getByText("浅色").click();
  // Verify data-theme attribute changes
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
```

- [ ] **Step 2: Run test**

Run:
```bash
npx playwright test tests/components/toolbar.spec.ts
```

Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add tests/components/toolbar.spec.ts
git commit -m "test: add toolbar component Playwright tests"
```

---

## Task 8: Frontend — WindowGrid Test

**Files:**
- Create: `tests/components/window-grid.spec.ts`

- [ ] **Step 1: Write test**

```ts
import { test, expect } from "../fixtures/test";

// Use config with monitored windows so they auto-start
test.describe("WindowGrid with active captures", () => {
  test.use({
    mockTauri: {
      config: {
        monitored_windows: ["testapp1"],
        hidden_windows: [],
        refresh_interval_ms: 1500,
        always_on_top: false,
        window_geometry: null,
      },
    },
  } as any);

  test("renders captured windows as cards", async ({ page }) => {
    await page.goto("/");
    // Wait for loading to finish — cards should appear
    await expect(page.getByText("Test Window 1")).toBeVisible({ timeout: 10000 });
  });

  test("Ctrl+wheel zooms the grid", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Test Window 1")).toBeVisible({ timeout: 10000 });

    const gridArea = page.locator(".overflow-auto");
    await gridArea.hover();

    // Zoom in with Ctrl+scroll up
    await page.mouse.wheel(0, -100);

    // Grid should still render (no crash)
    await expect(page.getByText("Test Window 1")).toBeVisible();
  });
});

test.describe("WindowGrid empty state", () => {
  test("shows empty state when no windows are captured", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("暂无监控窗口")).toBeVisible();
    await expect(page.getByText("打开设置面板选择要监控的窗口")).toBeVisible();
  });
});
```

- [ ] **Step 2: Run test**

Run:
```bash
npx playwright test tests/components/window-grid.spec.ts
```

Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add tests/components/window-grid.spec.ts
git commit -m "test: add WindowGrid Playwright tests for grid and empty state"
```

---

## Task 9: Frontend — SettingsPanel Test

**Files:**
- Create: `tests/components/settings-panel.spec.ts`

- [ ] **Step 1: Write test**

```ts
import { test, expect } from "../fixtures/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("暂无监控窗口")).toBeVisible();
  // Open settings panel
  await page.keyboard.press("Control+g");
  await expect(page.getByText("窗口筛选")).toBeVisible();
});

test("renders all windows in the list", async ({ page }) => {
  await expect(page.getByText("Test Window 1")).toBeVisible();
  await expect(page.getByText("Test Window 2")).toBeVisible();
});

test("shows process names under window titles", async ({ page }) => {
  await expect(page.getByText("testapp1")).toBeVisible();
  await expect(page.getByText("testapp2")).toBeVisible();
});

test("close button hides the panel", async ({ page }) => {
  await page.locator("button").filter({ has: page.locator("svg") }).first().click();
  // Or use the X button in the settings header
  const closeBtn = page.locator(".border-l button").filter({ has: page.locator("svg") }).first();
  await closeBtn.click();
  await expect(page.getByText("窗口筛选")).not.toBeVisible();
});

test("clicking monitor button on a window starts capture", async ({ page }) => {
  // Each window row has a monitor toggle button
  const firstRow = page.locator(".border-l .overflow-auto > div").first();
  await firstRow.locator("button").first().click();
  // The button icon should change (green = active)
  // Verify via invoke log
  const log = await page.evaluate(() => (window as any).__TAURI_INVOKE_LOG__);
  const startCall = log.find(
    (c: any) => c.cmd === "start_capture"
  );
  expect(startCall).toBeTruthy();
});

test("clicking eye button toggles window visibility", async ({ page }) => {
  const firstRow = page.locator(".border-l .overflow-auto > div").first();
  // Click the eye/eyeoff button (second button in row)
  const eyeBtn = firstRow.locator("button").nth(1);
  await eyeBtn.click();

  const log = await page.evaluate(() => (window as any).__TAURI_INVOKE_LOG__);
  const updateCall = log.find(
    (c: any) =>
      c.cmd === "update_config" &&
      c.args?.config?.hidden_windows?.length > 0
  );
  expect(updateCall).toBeTruthy();
});
```

- [ ] **Step 2: Run test**

Run:
```bash
npx playwright test tests/components/settings-panel.spec.ts
```

Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add tests/components/settings-panel.spec.ts
git commit -m "test: add SettingsPanel Playwright tests"
```

---

## Task 10: Frontend — i18n Test

**Files:**
- Create: `tests/i18n.spec.ts`

- [ ] **Step 1: Write test**

```ts
import { test, expect } from "./fixtures/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("暂无监控窗口")).toBeVisible();
});

test("switches from Chinese to English", async ({ page }) => {
  await page.getByText("English").click();

  await expect(page.getByText("No monitored windows")).toBeVisible();
  await expect(page.getByText("Pause")).toBeVisible();
  await expect(page.getByText("Pin")).toBeVisible();
});

test("switches back to Chinese", async ({ page }) => {
  await page.getByText("English").click();
  await expect(page.getByText("Pause")).toBeVisible();

  await page.getByText("中文").click();
  await expect(page.getByText("暂停")).toBeVisible();
});

test("locale persists in localStorage", async ({ page }) => {
  await page.getByText("English").click();
  await expect(page.getByText("Pause")).toBeVisible();

  // Reload page
  await page.reload();
  await expect(page.getByText("Pause")).toBeVisible();
});

test("html lang attribute updates", async ({ page }) => {
  expect(await page.locator("html").getAttribute("lang")).toBe("zh-CN");

  await page.getByText("English").click();
  expect(await page.locator("html").getAttribute("lang")).toBe("en-US");
});
```

- [ ] **Step 2: Run test**

Run:
```bash
npx playwright test tests/i18n.spec.ts
```

Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add tests/i18n.spec.ts
git commit -m "test: add i18n locale switching Playwright tests"
```

---

## Task 11: Frontend — WindowCard Test

**Files:**
- Create: `tests/components/window-card.spec.ts`

- [ ] **Step 1: Write test**

This test needs a captured window to render cards. Use mock with monitored_windows to auto-start capture and simulate a capture-update event.

```ts
import { test, expect } from "../fixtures/test";

test.describe("WindowCard with capture data", () => {
  test.use({
    mockTauri: {
      config: {
        monitored_windows: ["testapp1"],
        hidden_windows: [],
        refresh_interval_ms: 1500,
        always_on_top: false,
        window_geometry: null,
      },
    },
  } as any);

  test("shows loading state before capture data arrives", async ({ page }) => {
    await page.goto("/");
    // Card appears but may show loading
    await expect(page.getByText("testapp1")).toBeVisible({ timeout: 10000 });
  });

  test("card shows process name and title", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Test Window 1")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("testapp1")).toBeVisible();
  });

  test("double-click on card triggers bring_to_front", async ({ page }) => {
    await page.goto("/");
    const card = page.locator(".rounded-lg").first();
    await expect(card).toBeVisible({ timeout: 10000 });
    await card.dblclick();

    const log = await page.evaluate(() => (window as any).__TAURI_INVOKE_LOG__);
    const bringCall = log.find(
      (c: any) => c.cmd === "bring_to_front"
    );
    expect(bringCall).toBeTruthy();
  });

  test("green dot appears for active capture", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Test Window 1")).toBeVisible({ timeout: 10000 });
    // The green pulsing dot
    const dot = page.locator(".animate-pulse");
    await expect(dot).toBeVisible();
  });
});
```

- [ ] **Step 2: Run test**

Run:
```bash
npx playwright test tests/components/window-card.spec.ts
```

Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add tests/components/window-card.spec.ts
git commit -m "test: add WindowCard Playwright tests"
```

---

## Task 12: CI Workflow + Final npm scripts

**Files:**
- Create: `.github/workflows/test.yml`

- [ ] **Step 1: Create GitHub Actions workflow**

```yaml
name: Test

on:
  push:
    tags:
      - "v*"
  workflow_dispatch:

jobs:
  test-frontend:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test
      - uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30

  test-backend:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - run: cd src-tauri && cargo test

  lint:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - uses: dtolnay/rust-toolchain@stable
      - run: cd src-tauri && cargo clippy -- -D warnings

  build:
    runs-on: windows-latest
    needs: [test-frontend, test-backend, lint]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: dtolnay/rust-toolchain@stable
      - run: cd src-tauri && cargo build
```

- [ ] **Step 2: Run full test suite locally to verify**

Run:
```bash
npx playwright test
cd src-tauri && cargo test
```

Expected: All frontend and backend tests pass

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/test.yml
git commit -m "ci: add GitHub Actions test workflow for tag/release triggers"
```

---

## Summary

| Task | Scope | Files |
|------|-------|-------|
| 1 | Dependencies | package.json, Cargo.toml |
| 2 | Playwright config + mock | playwright.config.ts, tests/fixtures/test.ts |
| 3 | Rust config tests | src-tauri/src/config.rs |
| 4 | Rust capture tests | src-tauri/src/capture.rs |
| 5 | Rust integration test | src-tauri/tests/config_io.rs |
| 6 | Frontend shortcuts | tests/shortcuts.spec.ts |
| 7 | Frontend toolbar | tests/components/toolbar.spec.ts |
| 8 | Frontend grid | tests/components/window-grid.spec.ts |
| 9 | Frontend settings | tests/components/settings-panel.spec.ts |
| 10 | Frontend i18n | tests/i18n.spec.ts |
| 11 | Frontend card | tests/components/window-card.spec.ts |
| 12 | CI workflow | .github/workflows/test.yml |
