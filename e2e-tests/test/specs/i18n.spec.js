describe("i18n", () => {
  beforeEach(async () => {
    // Ensure Chinese locale for predictable selectors
    const html = await $("html");
    const lang = await html.getAttribute("lang");
    if (lang !== "zh-CN") {
      const langBtn = await $("//button[contains(@title,'中文')]");
      if (await langBtn.isExisting()) await langBtn.click();
      await browser.pause(300);
    }
    const pauseBtn = await $("//button[contains(@title,'暂停')]");
    await pauseBtn.waitForDisplayed({ timeout: 15000 });
  });

  it("switches from Chinese to English", async () => {
    const langBtn = await $("//button[contains(@title,'English')]");
    await langBtn.click();
    const pauseEn = await $("//button[contains(@title,'Pause')]");
    await pauseEn.waitForDisplayed({ timeout: 3000 });
    expect(await pauseEn.isDisplayed()).toBe(true);
  });

  it("switches back to Chinese", async () => {
    const langBtn = await $("//button[contains(@title,'English')]");
    await langBtn.click();
    const pauseEn = await $("//button[contains(@title,'Pause')]");
    await pauseEn.waitForDisplayed({ timeout: 3000 });

    const langBtnCn = await $("//button[contains(@title,'中文')]");
    await langBtnCn.click();
    const pauseCn = await $("//button[contains(@title,'暂停')]");
    await pauseCn.waitForDisplayed({ timeout: 3000 });
    expect(await pauseCn.isDisplayed()).toBe(true);
  });

  it("html lang attribute updates", async () => {
    const html = await $("html");
    const lang = await html.getAttribute("lang");
    expect(lang).toBe("zh-CN");

    const langBtn = await $("//button[contains(@title,'English')]");
    await langBtn.click();
    await browser.pause(500);
    const langAfter = await html.getAttribute("lang");
    expect(langAfter).toBe("en-US");
  });
});
