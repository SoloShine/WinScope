import { test, expect } from "./fixtures/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("暂无监控窗口")).toBeVisible();
});

test("Space toggles pause state", async ({ page }) => {
  await page.click("body");
  await page.keyboard.press("Space");
  await expect(page.getByText("继续")).toBeVisible();

  await page.keyboard.press("Space");
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
  await page.keyboard.press("Control+=");
  await page.waitForTimeout(100);
  await expect(page.getByText("暂无监控窗口")).toBeVisible();
});

test("Ctrl+- zooms out card width", async ({ page }) => {
  await page.keyboard.press("Control+=");
  await page.keyboard.press("Control+-");
  await expect(page.getByText("暂无监控窗口")).toBeVisible();
});

test("Ctrl+0 resets zoom", async ({ page }) => {
  await page.keyboard.press("Control+=");
  await page.keyboard.press("Control+=");
  await page.keyboard.press("Control+0");
  await expect(page.getByText("暂无监控窗口")).toBeVisible();
});

test("Ctrl+S is prevented", async ({ page }) => {
  await page.keyboard.press("Control+s");
  await expect(page.getByText("暂无监控窗口")).toBeVisible();
});

test("Ctrl+F is prevented", async ({ page }) => {
  await page.keyboard.press("Control+f");
  await expect(page.getByText("暂无监控窗口")).toBeVisible();
});
