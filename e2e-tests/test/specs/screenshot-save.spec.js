describe("Screenshot Save", () => {
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

  it("save button appears when hovering a card with image", async () => {
    // Open settings panel and start capturing a window
    await browser.keys(["Control", "g"]);
    const header = await $("//h2[contains(text(),'窗口筛选')]");
    await header.waitForDisplayed({ timeout: 5000 });

    // Click the first "start monitor" button (MonitorOff icon)
    const startBtn = await $("//button[contains(@title,'开始监控')]");
    if (await startBtn.isExisting()) {
      await startBtn.click();
      await browser.pause(3000);
    }

    // Close settings panel
    await browser.keys(["Control", "g"]);
    await browser.pause(500);

    // Wait for a window card with image to appear
    const card = await $(".aspect-video img");
    await card.waitForDisplayed({ timeout: 10000 });

    // Hover over the card to trigger the overlay
    const cardContainer = await $(".aspect-video");
    await cardContainer.moveTo();

    // The save button should appear in the hover overlay
    const saveBtn = await $("//button[contains(@title,'保存截图') or contains(@title,'Save Screenshot')]");
    await saveBtn.waitForDisplayed({ timeout: 3000 });
    expect(await saveBtn.isDisplayed()).toBe(true);
  });

  it("Ctrl+S does not crash when no card is hovered", async () => {
    // Ensure no card is hovered by clicking body
    await $("body").click();
    await browser.pause(200);

    // Ctrl+S should not crash — app remains responsive
    await browser.keys(["Control", "s"]);
    await browser.pause(300);

    const pauseBtn = await $("//button[contains(@title,'暂停') or contains(@title,'Pause')]");
    expect(await pauseBtn.isDisplayed()).toBe(true);
  });

  it("Ctrl+S does not crash when a card is hovered", async () => {
    // Find a card with an image
    const card = await $(".aspect-video img");
    if (await card.isExisting()) {
      await card.waitForDisplayed({ timeout: 5000 });
      const cardContainer = await $(".aspect-video");
      await cardContainer.moveTo();
      await browser.pause(200);
    }

    // Ctrl+S may open a save dialog — just verify app is still responsive
    await browser.keys(["Control", "s"]);
    await browser.pause(500);

    // App toolbar should still be visible
    const pauseBtn = await $("//button[contains(@title,'暂停') or contains(@title,'Pause') or contains(@title,'继续') or contains(@title,'Resume')]");
    expect(await pauseBtn.isDisplayed()).toBe(true);
  });
});
