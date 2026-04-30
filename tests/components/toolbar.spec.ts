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
  await page.getByText("置顶").click();
  await expect(page.getByText("已置顶")).toBeVisible();

  await page.getByText("已置顶").click();
  await expect(page.getByText("置顶")).toBeVisible();
});

test("interval buttons change active state", async ({ page }) => {
  const btn2s = page.getByText("2秒");
  await btn2s.click();
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
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
