const BrowserPool = require("../../src/core/BrowserPool");

function createLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  };
}

function createAuthSource(storageState) {
  return {
    getRotationIndices: jest.fn(() => [0]),
    getAuth: jest.fn(() => storageState),
  };
}

function createBrowser() {
  return {
    newContext: jest.fn(async () => ({
      newPage: jest.fn(async () => ({})),
    })),
  };
}

describe("BrowserPool", () => {
  test("logs a safe auth storageState summary before creating context", async () => {
    const logger = createLogger();
    const browser = createBrowser();
    const browserPool = new BrowserPool({
      config: { browserHeadless: true },
      logger,
      authSource: createAuthSource({
        accountName: "user@example.com",
        expired: false,
        cookies: [
          { name: "SID", value: "secret-sid", domain: ".google.com", path: "/" },
          { name: "__Secure-1PSID", value: "secret-psid", domain: ".google.com", path: "/" },
          { name: "OTHER", value: "secret-other", domain: ".example.com", path: "/" },
        ],
        origins: [
          { origin: "https://gemini.google.com", localStorage: [] },
          { origin: "https://accounts.google.com", localStorage: [] },
        ],
      }),
    });
    browserPool.browser = browser;

    await browserPool.getCurrentSession();

    const logOutput = logger.debug.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(logOutput).toContain("[BrowserPool] Auth storageState summary");
    expect(logOutput).toContain("authIndex=0");
    expect(logOutput).toContain("accountName=user@example.com");
    expect(logOutput).toContain("cookieCount=3");
    expect(logOutput).toContain("googleCookieCount=2");
    expect(logOutput).toContain("importantCookies=SID,__Secure-1PSID");
    expect(logOutput).toContain("origins=https://accounts.google.com,https://gemini.google.com");
    expect(logOutput).not.toContain("secret-sid");
    expect(logOutput).not.toContain("secret-psid");
    expect(logOutput).not.toContain("secret-other");
  });
});
