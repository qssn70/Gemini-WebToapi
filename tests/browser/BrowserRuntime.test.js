const {
  buildLaunchOptions,
  buildContextOptions,
  createBrowserType,
  formatAuthSummary,
  parseViewport,
} = require("../../src/browser/BrowserRuntime");

jest.mock("playwright", () => ({
  chromium: { name: "chromium" },
  firefox: { name: "firefox" },
}));

describe("BrowserRuntime", () => {
  test("selects chromium and firefox browser types", () => {
    expect(createBrowserType({ browserEngine: "chromium" }).name).toBe(
      "chromium",
    );
    expect(createBrowserType({ browserEngine: "firefox" }).name).toBe(
      "firefox",
    );
  });

  test("builds launch options with executable path and proxy", () => {
    const options = buildLaunchOptions({
      browserHeadless: false,
      browserExecutablePath: "/path/to/browser",
      browserProxy: "http://127.0.0.1:8080",
    });

    expect(options).toEqual({
      headless: false,
      executablePath: "/path/to/browser",
      proxy: { server: "http://127.0.0.1:8080" },
    });
  });

  test("parses viewport strings", () => {
    expect(parseViewport("1920x1080")).toEqual({ width: 1920, height: 1080 });
    expect(parseViewport("bad")).toBeNull();
    expect(parseViewport(null)).toBeNull();
  });

  test("builds context options without leaking storageState", () => {
    const options = buildContextOptions(
      {
        browserUserAgent: "TestAgent/1.0",
        browserViewport: "1920x1080",
        browserProxy: "http://127.0.0.1:8080",
      },
      { cookies: [], origins: [] },
    );

    expect(options).toEqual({
      storageState: { cookies: [], origins: [] },
      userAgent: "TestAgent/1.0",
      viewport: { width: 1920, height: 1080 },
      proxy: { server: "http://127.0.0.1:8080" },
    });
  });

  test("formats auth summary without cookie values", () => {
    const summary = formatAuthSummary(0, {
      accountName: "user@example.com",
      expired: true,
      cookies: [
        { name: "SID", value: "secret", domain: ".google.com" },
        { name: "OTHER", value: "also-secret", domain: ".example.com" },
      ],
      origins: [{ origin: "https://gemini.google.com", localStorage: [] }],
    });

    expect(summary).toContain("authIndex=0");
    expect(summary).toContain("accountName=user@example.com");
    expect(summary).toContain("expired=true");
    expect(summary).toContain("importantCookies=SID");
    expect(summary).not.toContain("secret");
    expect(summary).not.toContain("also-secret");
  });
});
