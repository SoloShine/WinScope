describe("Toolbar", () => {
  beforeEach(async () => {
    // Ensure Chinese locale for predictable selectors
    const html = await $("html");
    const lang = await html.getAttribute("lang");
    if (lang !== "zh-CN") {
      const langBtn = await $("//button[contains(@title,'中文')]");
      if (await langBtn.isExisting()) await langBtn.click();
      await browser.pause(300);
    }
    // Wait for app to load
    const pauseBtn = await $("//button[contains(@title,'Space')]");
    await pauseBtn.waitForDisplayed({ timeout: 15000 });
  });

  it("pause button toggles to resume", async () => {
    const pauseBtn = await $("//button[contains(@title,'暂停')]");
    await pauseBtn.click();
    const resumeBtn = await $("//button[contains(@title,'继续')]");
    await resumeBtn.waitForDisplayed({ timeout: 3000 });
    expect(await resumeBtn.isDisplayed()).toBe(true);
  });

  it("resume button toggles back to pause", async () => {
    const resumeBtn = await $("//button[contains(@title,'继续')]");
    await resumeBtn.click();
    const pauseBtn = await $("//button[contains(@title,'暂停')]");
    await pauseBtn.waitForDisplayed({ timeout: 3000 });
    expect(await pauseBtn.isDisplayed()).toBe(true);
  });

  it("pin button toggles always-on-top", async () => {
    const pinBtn = await $("//button[contains(@title,'置顶')]");
    await pinBtn.click();
    // After clicking, text changes to "已置顶" but title stays "置顶 (Ctrl+P)"
    const pinnedText = await $("//*[contains(text(),'已置顶')]");
    await pinnedText.waitForDisplayed({ timeout: 3000 });
    expect(await pinnedText.isDisplayed()).toBe(true);

    // Click again to unpin — use the same button (title unchanged)
    const pinBtnAgain = await $("//button[contains(@title,'置顶')]");
    await pinBtnAgain.click();
    const unpinnedText = await $("//*[contains(text(),'置顶') and not(contains(text(),'已'))]");
    await unpinnedText.waitForDisplayed({ timeout: 3000 });
    expect(await unpinnedText.isDisplayed()).toBe(true);
  });

  it("interval buttons change active state", async () => {
    const btn2s = await $("//button[text()='2秒']");
    await btn2s.click();
    await browser.pause(500);
    const btnClass = await btn2s.getAttribute("class");
    expect(btnClass).toContain("bg-blue-600");
  });

  it("settings gear opens settings panel", async () => {
    const settingsBtn = await $("//button[contains(@title,'窗口筛选')]");
    await settingsBtn.click();
    const panel = await $("//h2[contains(text(),'窗口筛选')]");
    await panel.waitForDisplayed({ timeout: 3000 });
    expect(await panel.isDisplayed()).toBe(true);
  });

  it("theme toggle switches data-theme", async () => {
    const themeBtn = await $("//button[contains(@title,'浅色')]");
    if (await themeBtn.isExisting()) {
      await themeBtn.click();
      await browser.pause(500);
      const html = await $("html");
      const theme = await html.getAttribute("data-theme");
      expect(theme).toBe("light");
    }
  });

  it("language toggle switches to English", async () => {
    const langBtn = await $("//button[contains(@title,'English')]");
    await langBtn.click();
    const pauseEn = await $("//button[contains(@title,'Pause')]");
    await pauseEn.waitForDisplayed({ timeout: 3000 });
    expect(await pauseEn.isDisplayed()).toBe(true);
  });
});
