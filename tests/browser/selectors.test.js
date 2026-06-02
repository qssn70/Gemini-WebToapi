const selectors = require("../../src/browser/selectors");

describe("Gemini Web selectors", () => {
  test("model menu selectors include authenticated Gemini mode menu", () => {
    expect(selectors.modelMenuButton).toEqual(
      expect.arrayContaining([
        "[data-test-id='bard-mode-menu-button']",
        "button[aria-label*='模式选择器']",
        "button[aria-label*='mode selector']",
      ]),
    );
  });
});
