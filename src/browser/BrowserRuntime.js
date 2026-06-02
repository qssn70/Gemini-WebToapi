const { chromium, firefox } = require("playwright");

function createBrowserType(config) {
  return config.browserEngine === "firefox" ? firefox : chromium;
}

function buildLaunchOptions(config) {
  const options = {
    headless: config.browserHeadless,
  };

  if (config.browserExecutablePath) {
    options.executablePath = config.browserExecutablePath;
  }

  const proxy = parseProxy(config.browserProxy);
  if (proxy) {
    options.proxy = proxy;
  }

  return options;
}

function buildContextOptions(config, storageState) {
  const options = { storageState };

  const viewport = parseViewport(config.browserViewport);
  if (viewport) {
    options.viewport = viewport;
  }

  if (config.browserUserAgent) {
    options.userAgent = config.browserUserAgent;
  }

  const proxy = parseProxy(config.browserProxy);
  if (proxy) {
    options.proxy = proxy;
  }

  return options;
}

function parseProxy(raw) {
  if (!raw || typeof raw !== "string") return null;
  const server = raw.trim();
  if (!server) return null;
  return { server };
}

function parseViewport(raw) {
  if (!raw || typeof raw !== "string") return null;
  const match = raw.trim().match(/^(\d+)x(\d+)$/i);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }
  return { width, height };
}

function formatAuthSummary(authIndex, storageState) {
  const cookies = Array.isArray(storageState.cookies)
    ? storageState.cookies
    : [];
  const origins = Array.isArray(storageState.origins)
    ? storageState.origins
    : [];
  const googleCookies = cookies.filter((cookie) =>
    String(cookie.domain || "").includes("google"),
  );
  const cookieDomains = [
    ...new Set(cookies.map((cookie) => cookie.domain).filter(Boolean)),
  ].sort();
  const originList = [
    ...new Set(origins.map((origin) => origin.origin).filter(Boolean)),
  ].sort();
  const importantNames = [
    "SID",
    "HSID",
    "SSID",
    "APISID",
    "SAPISID",
    "__Secure-1PSID",
    "__Secure-3PSID",
    "__Secure-1PSIDTS",
    "__Secure-3PSIDTS",
    "__Secure-1PSIDCC",
    "__Secure-3PSIDCC",
    "OSID",
    "__Secure-OSID",
    "COMPASS",
    "NID",
  ];
  const presentImportantCookies = importantNames.filter((name) =>
    cookies.some((cookie) => cookie.name === name),
  );

  return [
    `authIndex=${authIndex}`,
    `accountName=${storageState.accountName || ""}`,
    `expired=${storageState.expired === true}`,
    `cookieCount=${cookies.length}`,
    `googleCookieCount=${googleCookies.length}`,
    `cookieDomains=${cookieDomains.join(",")}`,
    `importantCookies=${presentImportantCookies.join(",")}`,
    `originCount=${origins.length}`,
    `origins=${originList.join(",")}`,
  ].join(" ");
}

module.exports = {
  buildContextOptions,
  buildLaunchOptions,
  createBrowserType,
  formatAuthSummary,
  parseProxy,
  parseViewport,
};
