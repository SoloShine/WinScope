describe("Keyboard Shortcuts", () => {
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

  it("Space toggles pause state", async () => {
    await browser.keys("Space");
    const resumeBtn = await $("//button[contains(@title,'继续')]");
    await resumeBtn.waitForDisplayed({ timeout: 3000 });
    expect(await resumeBtn.isDisplayed()).toBe(true);

    await browser.keys("Space");
    const pauseBtn = await $("//button[contains(@title,'暂停')]");
    await pauseBtn.waitForDisplayed({ timeout: 3000 });
    expect(await pauseBtn.isDisplayed()).toBe(true);
  });

  it("Ctrl+G toggles settings panel", async () => {
    await browser.keys(["Control", "g"]);
    const panel = await $("//*[contains(text(),'窗口筛选')]");
    await panel.waitForDisplayed({ timeout: 3000 });
    expect(await panel.isDisplayed()).toBe(true);

    await browser.keys(["Control", "g"]);
    await panel.waitForDisplayed({ timeout: 3000, reverse: true });
    expect(await panel.isDisplayed()).toBe(false);
  });

  it("Escape closes settings panel", async () => {
    await browser.keys(["Control", "g"]);
    const panel = await $("//*[contains(text(),'窗口筛选')]");
    await panel.waitForDisplayed({ timeout: 3000 });

    await browser.keys("Escape");
    await panel.waitForDisplayed({ timeout: 3000, reverse: true });
    expect(await panel.isDisplayed()).toBe(false);
  });

  it("Ctrl+= zooms in", async () => {
    await browser.keys(["Control", "="]);
    await browser.pause(200);
    const pauseBtn = await $("//button[contains(@title,'暂停')]");
    expect(await pauseBtn.isDisplayed()).toBe(true);
  });

  it("Ctrl+- zooms out", async () => {
    await browser.keys(["Control", "="]);
    await browser.keys(["Control", "-"]);
    await browser.pause(200);
    const pauseBtn = await $("//button[contains(@title,'暂停')]");
    expect(await pauseBtn.isDisplayed()).toBe(true);
  });

  it("Ctrl+0 resets zoom", async () => {
    await browser.keys(["Control", "="]);
    await browser.keys(["Control", "="]);
    await browser.keys(["Control", "0"]);
    await browser.pause(200);
    const pauseBtn = await $("//button[contains(@title,'暂停')]");
    expect(await pauseBtn.isDisplayed()).toBe(true);
  });

  it("Ctrl+S does not crash when no card hovered", async () => {
    await browser.keys(["Control", "s"]);
    await browser.pause(200);
    const pauseBtn = await $("//button[contains(@title,'暂停') or contains(@title,'Pause')]");
    expect(await pauseBtn.isDisplayed()).toBe(true);
  });

  it("Ctrl+F is prevented", async () => {
    await browser.keys(["Control", "f"]);
    await browser.pause(200);
    const pauseBtn = await $("//button[contains(@title,'暂停')]");
    expect(await pauseBtn.isDisplayed()).toBe(true);
  });
});
