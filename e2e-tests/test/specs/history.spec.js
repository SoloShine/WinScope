const { expect } = require("chai");

describe("History Timeline Feature", () => {
  it("should show history button on card hover", async () => {
    // This test requires a window to be monitored first
    // Skip if no windows are available
    const cards = await $$('[data-testid="window-card"]');
    if (cards.length === 0) {
      this.skip();
    }

    const firstCard = cards[0];
    await firstCard.moveTo();

    const historyButton = await firstCard.$('[data-testid="history-button"]');
    const isDisplayed = await historyButton.isDisplayed();
    expect(isDisplayed).to.be.true;
  });

  it("should open history preview when clicking history button", async () => {
    const cards = await $$('[data-testid="window-card"]');
    if (cards.length === 0) {
      this.skip();
    }

    const firstCard = cards[0];
    await firstCard.moveTo();

    const historyButton = await firstCard.$('[data-testid="history-button"]');
    await historyButton.click();

    const preview = await $('[data-testid="history-preview"]');
    const isDisplayed = await preview.isDisplayed();
    expect(isDisplayed).to.be.true;
  });

  it("should close history preview when clicking close button", async () => {
    const closeButton = await $('[data-testid="history-close"]');
    await closeButton.click();

    const preview = await $('[data-testid="history-preview"]');
    const isExisting = await preview.isExisting();
    expect(isExisting).to.be.false;
  });
});
