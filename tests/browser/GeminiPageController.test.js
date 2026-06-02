const GeminiPageController = require("../../src/browser/GeminiPageController");

function createLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  };
}

function createPage({ states }) {
  let stateIndex = 0;
  const page = {
    url: jest.fn(() => "https://gemini.google.com/app"),
    title: jest.fn(async () => "Gemini"),
    goto: jest.fn(async () => {}),
    $: jest.fn(async (selector) => {
      const state = states[Math.min(stateIndex, states.length - 1)];
      if (selector.includes("Sign in") || selector.includes("登录")) {
        return state === "login_required" ? {} : null;
      }
      if (
        selector.includes("limit") ||
        selector.includes("quota") ||
        selector.includes("达到上限") ||
        selector.includes("Too many requests")
      ) {
        return state === "quota_exceeded" ? {} : null;
      }
      if (selector.includes("contenteditable") || selector === "textarea") {
        return state === "ready" ? {} : null;
      }
      return null;
    }),
  };

  page.advanceState = () => {
    stateIndex += 1;
  };

  return page;
}

describe("GeminiPageController", () => {
  test("waits for a restored auth session before treating the page as logged out", async () => {
    const page = createPage({
      states: ["login_required", "login_required", "ready"],
    });
    const logger = createLogger();
    const controller = new GeminiPageController({
      logger,
      config: {
        geminiWebUrl: "https://gemini.google.com/app",
        tempConversationMode: true,
        pageNavigationDelayMs: 0,
        authStateWaitMs: 500,
        authStatePollMs: 10,
      },
    });

    const originalDiagnosePageState =
      controller._diagnosePageState.bind(controller);
    jest
      .spyOn(controller, "_diagnosePageState")
      .mockImplementation(async (...args) => {
        const diagnostics = await originalDiagnosePageState(...args);
        page.advanceState();
        return diagnostics;
      });

    await expect(controller.ensureReady(page)).resolves.toBeUndefined();
    expect(controller._diagnosePageState).toHaveBeenCalledTimes(3);

    const logOutput = logger.debug.mock.calls
      .map((call) => call.join(" "))
      .join("\n");
    expect(logOutput).toContain("[PageController] Auth state check");
    expect(logOutput).toContain("state=login_required");
    expect(logOutput).toContain("state=ready");
    expect(logOutput).toContain("url=https://gemini.google.com/app");
    expect(logOutput).toContain("title=Gemini");
    expect(logOutput).toContain("loginSelector=text=Sign in");
    expect(logOutput).toContain("inputSelector=div[contenteditable='true']");
  });

  test("warns with page diagnostics when auth state stays logged out", async () => {
    const page = createPage({ states: ["login_required"] });
    const logger = createLogger();
    const controller = new GeminiPageController({
      logger,
      config: {
        geminiWebUrl: "https://gemini.google.com/app",
        tempConversationMode: true,
        pageNavigationDelayMs: 0,
        authStateWaitMs: 20,
        authStatePollMs: 10,
      },
    });

    await expect(controller.ensureReady(page)).rejects.toThrow(
      "Gemini page requires login.",
    );

    const warnOutput = logger.warn.mock.calls
      .map((call) => call.join(" "))
      .join("\n");
    expect(warnOutput).toContain("[PageController] Auth state failure");
    expect(warnOutput).toContain("state=login_required");
    expect(warnOutput).toContain("url=https://gemini.google.com/app");
    expect(warnOutput).toContain("title=Gemini");
    expect(warnOutput).toContain("loginSelector=text=Sign in");
  });

  test("tries localized thinking level labels before warning", async () => {
    const logger = createLogger();
    const controller = new GeminiPageController({ logger, config: {} });
    const thinkingMenu = { click: jest.fn(async () => {}) };
    const timeoutError = new Error("option timeout");
    const optionClicks = [
      jest.fn(async () => {
        throw timeoutError;
      }),
      jest.fn(async () => {}),
    ];
    const page = {
      getByText: jest
        .fn()
        .mockReturnValueOnce({
          first: jest.fn(() => ({ click: optionClicks[0] })),
        })
        .mockReturnValueOnce({
          first: jest.fn(() => ({ click: optionClicks[1] })),
        }),
    };

    jest.spyOn(controller, "_findElement").mockResolvedValueOnce(thinkingMenu);

    await controller._selectThinkingLevel(page, "extended", "req-thinking");

    expect(page.getByText).toHaveBeenNthCalledWith(1, "Extended", {
      exact: false,
    });
    expect(page.getByText).toHaveBeenNthCalledWith(2, "扩展", {
      exact: false,
    });
    expect(optionClicks[0]).toHaveBeenCalledWith({ timeout: 1400 });
    expect(optionClicks[1]).toHaveBeenCalledWith({ timeout: 1400 });
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining("Selected thinking level extended (扩展)"),
    );
  });
});
