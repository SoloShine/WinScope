import { test, expect } from "../fixtures/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("暂无监控窗口")).toBeVisible();
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
  // The X button is in the settings panel header, next to "窗口筛选"
  const panel = page.locator(".border-l");
  await panel.locator("button").filter({ has: page.locator("svg") }).first().click();
  await expect(page.getByText("窗口筛选")).not.toBeVisible();
});

test("clicking monitor button triggers start_capture", async ({ page }) => {
  // Each window row inside the scrollable area has buttons; first button is the monitor toggle
  const scrollArea = page.locator(".border-l .overflow-auto");
  const firstRow = scrollArea.locator("> div").first();
  await firstRow.locator("button").first().click();

  const log = await page.evaluate(() => (window as any).__TAURI_INVOKE_LOG__);
  const startCall = log.find((c: any) => c.cmd === "start_capture");
  expect(startCall).toBeTruthy();
});

test("clicking eye button toggles window visibility", async ({ page }) => {
  // Each window row: second button is the eye toggle
  const scrollArea = page.locator(".border-l .overflow-auto");
  const firstRow = scrollArea.locator("> div").first();
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
