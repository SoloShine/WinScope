describe("Smoke Test", () => {
  it("app launches and shows toolbar", async () => {
    // Wait for real Tauri bridge calls to complete (get_config, get_windows)
    const pauseBtn = await $("//*[contains(text(),'暂停')]");
    await pauseBtn.waitForDisplayed({ timeout: 15000 });
    expect(await pauseBtn.isDisplayed()).toBe(true);
  });

  it("shows pin button", async () => {
    const pinBtn = await $("//*[contains(text(),'置顶')]");
    await pinBtn.waitForDisplayed({ timeout: 5000 });
    expect(await pinBtn.isDisplayed()).toBe(true);
  });

  it("shows interval buttons", async () => {
    const btn = await $("//*[contains(text(),'1.5秒')]");
    await btn.waitForDisplayed({ timeout: 5000 });
    expect(await btn.isDisplayed()).toBe(true);
  });

  it("shows settings button", async () => {
    // The settings gear button has a tooltip containing "窗口筛选"
    const settingsBtn = await $("//button[contains(@title,'窗口筛选')]");
    await settingsBtn.waitForDisplayed({ timeout: 5000 });
    expect(await settingsBtn.isDisplayed()).toBe(true);
  });

  it("shows language toggle", async () => {
    const langBtn = await $("//*[contains(text(),'English')]");
    await langBtn.waitForDisplayed({ timeout: 5000 });
    expect(await langBtn.isDisplayed()).toBe(true);
  });
});
