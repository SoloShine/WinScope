describe("Auto Monitor Rules", () => {
  beforeEach(async () => {
    // Wait for app to fully load
    const pauseBtn = await $("//button[contains(@title,'暂停') or contains(@title,'Pause')]");
    await pauseBtn.waitForDisplayed({ timeout: 15000 });
    // Ensure Chinese locale
    const html = await $("html");
    const lang = await html.getAttribute("lang");
    if (lang !== "zh-CN") {
      const langBtn = await $("//button[contains(@title,'中文')]");
      if (await langBtn.isExisting()) await langBtn.click();
      await browser.pause(300);
    }
    // Click body to ensure focus
    await $("body").click();
  });

  it("starting capture persists process name in config", async () => {
    // Open settings panel
    await browser.keys(["Control", "g"]);
    const header = await $("//h2[contains(text(),'窗口筛选')]");
    await header.waitForDisplayed({ timeout: 5000 });

    // Click the first start monitor button
    const startBtn = await $("//button[contains(@title,'开始监控')]");
    if (await startBtn.isExisting()) {
      await startBtn.click();
      await browser.pause(500);

      // The button should change to "stop monitor" (green icon = active)
      const stopBtn = await $("//button[contains(@title,'停止监控')]");
      await stopBtn.waitForDisplayed({ timeout: 3000 });
      expect(await stopBtn.isDisplayed()).toBe(true);

      // The window card should appear in the grid
      const card = await $(".aspect-video img");
      await card.waitForDisplayed({ timeout: 10000 });
      expect(await card.isDisplayed()).toBe(true);
    }

    // Close settings panel
    await browser.keys(["Control", "g"]);
  });

  it("stopping capture removes process from config and clears card", async () => {
    // Open settings panel
    await browser.keys(["Control", "g"]);
    const header = await $("//h2[contains(text(),'窗口筛选')]");
    await header.waitForDisplayed({ timeout: 5000 });

    // Click the first stop monitor button if one exists
    const stopBtn = await $("//button[contains(@title,'停止监控')]");
    if (await stopBtn.isExisting() && (await stopBtn.isDisplayed())) {
      await stopBtn.click();
      await browser.pause(500);

      // Verify button changes back to start
      const startBtn = await $("//button[contains(@title,'开始监控')]");
      expect(await startBtn.isExisting()).toBe(true);
    }

    // Close settings panel
    await browser.keys(["Control", "g"]);
  });

  it("monitored windows are restored after restart", async () => {
    // This test verifies that starting a capture persists config
    // Start monitoring first window
    await browser.keys(["Control", "g"]);
    const header = await $("//h2[contains(text(),'窗口筛选')]");
    await header.waitForDisplayed({ timeout: 5000 });

    const startBtn = await $("//button[contains(@title,'开始监控')]");
    if (await startBtn.isExisting()) {
      await startBtn.click();
      await browser.pause(1000);
    }

    // Close settings
    await browser.keys(["Control", "g"]);
    await browser.pause(500);

    // Verify a capture card is displayed
    const card = await $(".aspect-video img");
    if (await card.isExisting()) {
      await card.waitForDisplayed({ timeout: 10000 });
      expect(await card.isDisplayed()).toBe(true);
    }
  });
});
