import { test, expect } from "./fixtures/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("暂无监控窗口")).toBeVisible();
});

test("switches from Chinese to English", async ({ page }) => {
  await page.getByText("English").click();
  await expect(page.getByText("No windows being monitored")).toBeVisible();
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

  await page.reload();
  await expect(page.getByText("Pause")).toBeVisible();
});

test("html lang attribute updates", async ({ page }) => {
  expect(await page.locator("html").getAttribute("lang")).toBe("zh-CN");

  await page.getByText("English").click();
  expect(await page.locator("html").getAttribute("lang")).toBe("en-US");
});
