describe("Settings Panel", () => {
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
    // Open settings panel
    const header = await $("//h2[contains(text(),'窗口筛选')]");
    if (!(await header.isDisplayed())) {
      await browser.keys(["Control", "g"]);
      await header.waitForDisplayed({ timeout: 5000 });
    }
  });

  it("shows window list header", async () => {
    const header = await $("//h2[contains(text(),'窗口筛选')]");
    expect(await header.isDisplayed()).toBe(true);
  });

  it("lists real windows from desktop", async () => {
    // Real app shows actual windows — just verify rows exist
    const windowRows = await $$(".border-l .overflow-auto > div");
    const count = windowRows.length;
    expect(count).toBeGreaterThan(0);
  });

  it("close button hides the panel", async () => {
    const closeBtn = await $(".border-l .border-b button");
    await closeBtn.click();
    const header = await $("//h2[contains(text(),'窗口筛选')]");
    await header.waitForDisplayed({ timeout: 3000, reverse: true });
    expect(await header.isDisplayed()).toBe(false);
  });
});
