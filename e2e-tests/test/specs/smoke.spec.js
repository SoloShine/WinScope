describe("Smoke Test", () => {
  it("app launches and shows toolbar", async () => {
    const pauseBtn = await $("//button[contains(@title,'暂停') or contains(@title,'Pause')]");
    await pauseBtn.waitForDisplayed({ timeout: 15000 });
    expect(await pauseBtn.isDisplayed()).toBe(true);
  });

  it("shows pin button", async () => {
    const pinBtn = await $("//button[contains(@title,'置顶') or contains(@title,'Pin')]");
    await pinBtn.waitForDisplayed({ timeout: 5000 });
    expect(await pinBtn.isDisplayed()).toBe(true);
  });

  it("shows interval buttons", async () => {
    const btn = await $("//button[contains(text(),'1.5') or contains(text(),'1秒')]");
    await btn.waitForDisplayed({ timeout: 5000 });
    expect(await btn.isDisplayed()).toBe(true);
  });

  it("shows settings button", async () => {
    const settingsBtn = await $("//button[contains(@title,'窗口筛选') or contains(@title,'Window Filter')]");
    await settingsBtn.waitForDisplayed({ timeout: 5000 });
    expect(await settingsBtn.isDisplayed()).toBe(true);
  });

  it("shows language toggle", async () => {
    const langBtn = await $("//button[contains(text(),'English') or contains(text(),'中文')]");
    await langBtn.waitForDisplayed({ timeout: 5000 });
    expect(await langBtn.isDisplayed()).toBe(true);
  });
});
