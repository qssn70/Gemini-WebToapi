const {
  parseArgs,
  summarizePageDiagnostics,
  isLoggedInGeminiState,
} = require("../../scripts/debugAuth");

describe("debugAuth helpers", () => {
  test("parseArgs reads auth index and no-artifacts flag", () => {
    expect(parseArgs(["--auth-index", "3", "--no-artifacts"])).toEqual({
      authIndex: 3,
      saveArtifacts: false,
    });
  });

  test("parseArgs defaults to auth index 0 and saves artifacts", () => {
    expect(parseArgs([])).toEqual({ authIndex: 0, saveArtifacts: true });
  });

  test("summarizePageDiagnostics detects unsafe browser rejection", () => {
    const summary = summarizePageDiagnostics({
      url: "https://accounts.google.com/v3/signin/rejected",
      title: "Sign in - Google Accounts",
      bodyText: "Couldn’t sign you in This browser or app may not be secure.",
      signInCount: 1,
      inputCount: 0,
    });

    expect(summary.unsafeBrowserRejected).toBe(true);
    expect(summary.loginRequired).toBe(true);
  });

  test("isLoggedInGeminiState requires no login prompt and an input", () => {
    expect(
      isLoggedInGeminiState({
        loginRequired: false,
        inputCount: 1,
        unsafeBrowserRejected: false,
      }),
    ).toBe(true);
    expect(
      isLoggedInGeminiState({
        loginRequired: true,
        inputCount: 1,
        unsafeBrowserRejected: false,
      }),
    ).toBe(false);
  });
});
