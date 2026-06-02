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

  test("thinking menu selectors include visible level labels", () => {
    expect(selectors.thinkingMenuButton).toEqual(
      expect.arrayContaining([
        "button[aria-label*='thinking']",
        "button:has-text('Standard')",
        "button:has-text('Extended')",
        "button:has-text('标准')",
        "button:has-text('扩展')",
      ]),
    );
  });
});
