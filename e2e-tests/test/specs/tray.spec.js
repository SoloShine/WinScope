const { expect } = require("chai");

describe("System Tray Feature", () => {
  it("should minimize to tray when clicking close button", async () => {
    // Get the main window
    const mainWindow = await browser.getWindowHandle();
    
    // Click close button
    const closeButton = await $('[data-testid="close-button"]');
    await closeButton.click();
    
    // Wait for window to hide
    await browser.pause(500);
    
    // Check if window is visible
    const isVisible = await browser.execute(() => {
      return document.visibilityState === "visible";
    });
    
    expect(isVisible).to.be.false;
  });

  it("should restore window when double-clicking tray icon", async () => {
    // This test requires manual interaction with tray icon
    // Skip in automated tests
    this.skip();
  });
});
