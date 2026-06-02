const BrowserPool = require("../../src/core/BrowserPool");
const { NoAuthAvailableError } = require("../../src/utils/Errors");

function createLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  };
}

function createAuthSource(storageByIndex) {
  const indices = Object.keys(storageByIndex)
    .map(Number)
    .sort((a, b) => a - b);
  return {
    reload: jest.fn(),
    getRotationIndices: jest.fn(() => [...indices]),
    getAuth: jest.fn((index) => storageByIndex[index] || null),
  };
}

function makeStorage(index, overrides = {}) {
  return {
    accountName: `user${index}@example.com`,
    expired: false,
    cookies: [
      {
        name: "SID",
        value: `secret-sid-${index}`,
        domain: ".google.com",
        path: "/",
      },
      {
        name: "__Secure-1PSID",
        value: `secret-psid-${index}`,
        domain: ".google.com",
        path: "/",
      },
      {
        name: "OTHER",
        value: `secret-other-${index}`,
        domain: ".example.com",
        path: "/",
      },
    ],
    origins: [
      { origin: "https://gemini.google.com", localStorage: [] },
      { origin: "https://accounts.google.com", localStorage: [] },
    ],
    ...overrides,
  };
}

function createBrowser() {
  return {
    newContext: jest.fn(async () => ({
      newPage: jest.fn(async () => ({})),
      close: jest.fn(async () => {}),
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
        0: makeStorage(0, { accountName: "user@example.com" }),
      }),
    });
    browserPool.browser = browser;

    await browserPool.getCurrentSession();

    const logOutput = logger.debug.mock.calls
      .map((call) => call.join(" "))
      .join("\n");
    expect(logOutput).toContain("[BrowserPool] Auth storageState summary");
    expect(logOutput).toContain("authIndex=0");
    expect(logOutput).toContain("accountName=user@example.com");
    expect(logOutput).toContain("cookieCount=3");
    expect(logOutput).toContain("googleCookieCount=2");
    expect(logOutput).toContain("importantCookies=SID,__Secure-1PSID");
    expect(logOutput).toContain(
      "origins=https://accounts.google.com,https://gemini.google.com",
    );
    expect(logOutput).not.toContain("secret-sid-0");
    expect(logOutput).not.toContain("secret-psid-0");
    expect(logOutput).not.toContain("secret-other-0");
  });

  test("records runtime auth failures and excludes them from rotation", async () => {
    const logger = createLogger();
    const browserPool = new BrowserPool({
      config: { browserHeadless: true },
      logger,
      authSource: createAuthSource({ 0: makeStorage(0), 3: makeStorage(3) }),
    });
    browserPool.browser = createBrowser();

    expect((await browserPool.getCurrentSession()).authIndex).toBe(0);
    expect(
      (
        await browserPool.markCurrentAccountFailed(
          "Gemini page requires login.",
        )
      ).authIndex,
    ).toBe(3);

    expect(browserPool.getRuntimeFailedAuthIndices()).toEqual([0]);
    expect(browserPool.getAccountRuntimeStatus(0)).toMatchObject({
      failed: true,
      reason: "Gemini page requires login.",
    });
    expect(browserPool.getAccountRuntimeStatus(3)).toMatchObject({
      failed: false,
    });

    expect((await browserPool.rotate("manual")).authIndex).toBe(3);
    await expect(
      browserPool.markCurrentAccountFailed("Gemini page requires login."),
    ).rejects.toBeInstanceOf(NoAuthAvailableError);
    expect(browserPool.getRuntimeFailedAuthIndices()).toEqual([0, 3]);
    expect(browserPool.currentAuthIndex).toBeNull();
  });

  test("warns with a safe auth summary when an account fails at runtime", async () => {
    const logger = createLogger();
    const browserPool = new BrowserPool({
      config: { browserHeadless: true },
      logger,
      authSource: createAuthSource({ 0: makeStorage(0) }),
    });
    browserPool.browser = createBrowser();

    await browserPool.getCurrentSession();
    await expect(
      browserPool.markCurrentAccountFailed("Gemini page requires login."),
    ).rejects.toBeInstanceOf(NoAuthAvailableError);

    const warnOutput = logger.warn.mock.calls
      .map((call) => call.join(" "))
      .join("\n");
    expect(warnOutput).toContain(
      "[BrowserPool] Failed auth storageState summary",
    );
    expect(warnOutput).toContain("authIndex=0");
    expect(warnOutput).toContain("importantCookies=SID,__Secure-1PSID");
    expect(warnOutput).not.toContain("secret-sid-0");
    expect(warnOutput).not.toContain("secret-psid-0");
  });

  test("refreshAuthSources clears runtime auth failures", async () => {
    const browserPool = new BrowserPool({
      config: { browserHeadless: true },
      logger: createLogger(),
      authSource: createAuthSource({ 0: makeStorage(0) }),
    });
    browserPool.browser = createBrowser();

    await browserPool.getCurrentSession();
    await expect(
      browserPool.markCurrentAccountFailed("Gemini page requires login."),
    ).rejects.toBeInstanceOf(NoAuthAvailableError);

    browserPool.refreshAuthSources();
    expect(browserPool.getRuntimeFailedAuthIndices()).toEqual([]);
  });
});
