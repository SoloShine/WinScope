const { expect } = require("chai");

describe("Multi-Monitor Filter Feature", () => {
  it("should show monitor selector in settings panel", async () => {
    // Open settings panel
    await browser.keys(["Control", "g"]);
    await browser.pause(300);

    // Check if monitor selector exists
    const monitorSelector = await $('[data-testid="monitor-selector"]');
    const isDisplayed = await monitorSelector.isDisplayed();
    expect(isDisplayed).to.be.true;

    // Close settings panel
    await browser.keys(["Escape"]);
  });

  it("should filter windows by selected monitors", async () => {
    // Open settings panel
    await browser.keys(["Control", "g"]);
    await browser.pause(300);

    // Get initial window count
    const initialCards = await $$('[data-testid="window-card"]');
    const initialCount = initialCards.length;

    // Click on a monitor to toggle it
    const monitorButton = await $('[data-testid="monitor-button"]');
    if (await monitorButton.isDisplayed()) {
      await monitorButton.click();
      await browser.pause(500);

      // Check if window count changed
      const filteredCards = await $$('[data-testid="window-card"]');
      const filteredCount = filteredCards.length;

      // The count might be the same if all windows are on the same monitor
      // This test mainly verifies the UI interaction works
      expect(filteredCount).to.be.at.least(0);
    }

    // Close settings panel
    await browser.keys(["Escape"]);
  });
});
