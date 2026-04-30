import { test, expect } from "../fixtures/test";

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
  });

  test("renders captured windows as cards", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Test Window 1")).toBeVisible({ timeout: 10000 });
  });

  test("Ctrl+wheel zooms the grid", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Test Window 1")).toBeVisible({ timeout: 10000 });

    const gridArea = page.locator(".overflow-auto");
    await gridArea.hover();
    await page.mouse.wheel(0, -100);
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
