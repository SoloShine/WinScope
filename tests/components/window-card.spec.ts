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
  });

  test("shows loading state before capture data arrives", async ({ page }) => {
    await page.goto("/");
    // Card should be visible (process name or title renders)
    await expect(page.getByText("testapp1")).toBeVisible({ timeout: 10000 });
    // Loading text shown when capturing but no image yet
    await expect(page.getByText("加载中...")).toBeVisible();
  });

  test("card shows process name and title", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Test Window 1")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("testapp1")).toBeVisible();
  });

  test("double-click on card triggers bring_to_front", async ({ page }) => {
    await page.goto("/");
    // Wait for card to render
    await expect(page.getByText("Test Window 1")).toBeVisible({ timeout: 10000 });

    const card = page.locator(".rounded-lg").first();
    await expect(card).toBeVisible();
    await card.dblclick();

    const log = await page.evaluate(() => (window as any).__TAURI_INVOKE_LOG__);
    const bringCall = log.find((c: any) => c.cmd === "bring_to_front");
    expect(bringCall).toBeTruthy();
    expect(bringCall.args).toEqual({ windowTitle: "Test Window 1" });
  });

  test("green dot appears for active capture", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Test Window 1")).toBeVisible({ timeout: 10000 });
    const dot = page.locator(".animate-pulse");
    await expect(dot).toBeVisible();
  });

  test("only monitored window appears, not unmonitored ones", async ({ page }) => {
    await page.goto("/");
    // testapp1 is monitored, should appear
    await expect(page.getByText("Test Window 1")).toBeVisible({ timeout: 10000 });
    // testapp2 is NOT monitored, should not appear as a card
    await expect(page.getByText("Test Window 2")).not.toBeVisible();
  });
});

test.describe("WindowCard not-monitored state", () => {
  test.use({
    mockTauri: {
      config: {
        monitored_windows: [],
        hidden_windows: [],
        refresh_interval_ms: 1500,
        always_on_top: false,
        window_geometry: null,
      },
    },
  });

  test("no cards shown when no windows are monitored", async ({ page }) => {
    await page.goto("/");
    // Empty state message
    await expect(page.getByText("暂无监控窗口")).toBeVisible();
    // No cards rendered
    await expect(page.locator(".rounded-lg")).toHaveCount(0);
  });
});

test.describe("WindowCard with hidden windows", () => {
  test.use({
    mockTauri: {
      config: {
        monitored_windows: ["testapp1", "testapp2"],
        hidden_windows: ["testapp2"],
        refresh_interval_ms: 1500,
        always_on_top: false,
        window_geometry: null,
      },
    },
  });

  test("hidden window is not shown even if monitored", async ({ page }) => {
    await page.goto("/");
    // testapp1 should be visible
    await expect(page.getByText("Test Window 1")).toBeVisible({ timeout: 10000 });
    // testapp2 is hidden, should not render a card
    await expect(page.getByText("Test Window 2")).not.toBeVisible();
  });
});
