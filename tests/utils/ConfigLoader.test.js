const { loadConfig } = require("../../src/utils/ConfigLoader");

describe("ConfigLoader", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.AUTH_DIR;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("uses Docker auth mount path as default AUTH_DIR", () => {
    const config = loadConfig();

    expect(config.authDir).toBe("/app/configs/auth");
  });

  test("allows local AUTH_DIR override", () => {
    process.env.AUTH_DIR = "./auth";

    const config = loadConfig();

    expect(config.authDir).toBe("./auth");
  });

  test("uses browser parity defaults", () => {
    const config = loadConfig();

    expect(config.browserEngine).toBe("chromium");
    expect(config.browserUserAgent).toBe("");
    expect(config.browserViewport).toBeNull();
    expect(config.browserProxy).toBe("");
    expect(config.browserInitScript).toBe("");
    expect(config.authStateWaitMs).toBe(10000);
    expect(config.authStatePollMs).toBe(500);
  });

  test("reads browser parity env overrides", () => {
    process.env.BROWSER_ENGINE = "firefox";
    process.env.BROWSER_USER_AGENT = "TestAgent/1.0";
    process.env.BROWSER_VIEWPORT = "1920x1080";
    process.env.BROWSER_PROXY = "http://127.0.0.1:8080";
    process.env.BROWSER_INIT_SCRIPT =
      "Object.defineProperty(navigator, 'webdriver', { get: () => undefined });";
    process.env.AUTH_STATE_WAIT_MS = "15000";
    process.env.AUTH_STATE_POLL_MS = "250";

    const config = loadConfig();

    expect(config.browserEngine).toBe("firefox");
    expect(config.browserUserAgent).toBe("TestAgent/1.0");
    expect(config.browserViewport).toBe("1920x1080");
    expect(config.browserProxy).toBe("http://127.0.0.1:8080");
    expect(config.browserInitScript).toContain("navigator");
    expect(config.authStateWaitMs).toBe(15000);
    expect(config.authStatePollMs).toBe(250);
  });

  test("rejects invalid BROWSER_ENGINE", () => {
    process.env.BROWSER_ENGINE = "safari";

    expect(() => loadConfig()).toThrow(
      'Invalid BROWSER_ENGINE "safari". Use "chromium" or "firefox".',
    );
  });
});
