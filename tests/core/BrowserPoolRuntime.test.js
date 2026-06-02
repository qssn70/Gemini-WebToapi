jest.mock("../../src/browser/BrowserRuntime", () => ({
  buildContextOptions: jest.fn((config, storageState) => ({
    storageState,
    viewport: { width: 1920, height: 1080 },
  })),
  buildLaunchOptions: jest.fn(() => ({ headless: true, executablePath: "/browser" })),
  createBrowserType: jest.fn(() => ({
    launch: jest.fn(async () => ({
      newContext: jest.fn(async () => ({
        addInitScript: jest.fn(async () => {}),
        newPage: jest.fn(async () => ({})),
        close: jest.fn(async () => {}),
      })),
      close: jest.fn(async () => {}),
    })),
  })),
  formatAuthSummary: jest.fn(() => "summary"),
}));

const BrowserPool = require("../../src/core/BrowserPool");
const BrowserRuntime = require("../../src/browser/BrowserRuntime");

function createLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  };
}

function createAuthSource(storageByIndex) {
  const indices = Object.keys(storageByIndex).map(Number).sort((a, b) => a - b);
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
      { name: "SID", value: `secret-sid-${index}`, domain: ".google.com", path: "/" },
    ],
    origins: [{ origin: "https://gemini.google.com", localStorage: [] }],
    ...overrides,
  };
}

test("starts configured browser type and creates context with runtime options", async () => {
  const logger = createLogger();
  const authSource = createAuthSource({ 0: makeStorage(0) });
  const config = {
    browserEngine: "firefox",
    browserHeadless: true,
    browserExecutablePath: "/browser",
    browserViewport: "1920x1080",
  };
  const browserPool = new BrowserPool({ config, logger, authSource });

  await browserPool.start();
  await browserPool.getCurrentSession();

  expect(BrowserRuntime.createBrowserType).toHaveBeenCalledWith(config);
  expect(BrowserRuntime.buildLaunchOptions).toHaveBeenCalledWith(config);
  expect(BrowserRuntime.buildContextOptions).toHaveBeenCalledWith(config, expect.objectContaining({ accountName: "user0@example.com" }));
  expect(browserPool.browser.newContext).toHaveBeenCalledWith(expect.objectContaining({ viewport: { width: 1920, height: 1080 } }));
});
