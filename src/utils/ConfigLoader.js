/**
 * Unified configuration loader.
 * Reads environment variables and normalizes them into a config object.
 * Avoids scattered process.env reads across business modules.
 */

const path = require("path");

const DEFAULTS = {
  host: "0.0.0.0",
  port: 7870,
  apiKeys: ["123456"],

  authMode: "file",
  authDir: "/app/configs/auth",
  enableAuthUpdate: false,
  authSyncIntervalMs: 300000,

  aistudioBaseUrl: "http://aistudio-to-api:7860",
  aistudioAuthExportToken: "",

  geminiWebUrl: "https://gemini.google.com/app",
  browserHeadless: true,
  browserExecutablePath: "",
  maxContexts: 1,
  tempConversationMode: true,

  maxRetries: 2,
  retryDelayMs: 1500,
  requestTimeoutMs: 120000,

  logLevel: "info",
};

function loadConfig() {
  const config = { ...DEFAULTS };

  // Server
  config.host = envStr("HOST", DEFAULTS.host);
  config.port = envInt("PORT", DEFAULTS.port, 1, 65535);
  config.apiKeys = envApiKeys("API_KEYS", DEFAULTS.apiKeys);

  // Auth
  config.authMode = envStr("AUTH_MODE", DEFAULTS.authMode);
  config.authDir = envStr("AUTH_DIR", DEFAULTS.authDir);
  config.enableAuthUpdate = envBool("ENABLE_AUTH_UPDATE", DEFAULTS.enableAuthUpdate);
  config.authSyncIntervalMs = envInt("AUTH_SYNC_INTERVAL_MS", DEFAULTS.authSyncIntervalMs, 1000);

  // AIStudioToAPI
  config.aistudioBaseUrl = envStr("AISTUDIO_BASE_URL", DEFAULTS.aistudioBaseUrl);
  config.aistudioAuthExportToken = envStr("AISTUDIO_AUTH_EXPORT_TOKEN", DEFAULTS.aistudioAuthExportToken);

  // Browser
  config.geminiWebUrl = envStr("GEMINI_WEB_URL", DEFAULTS.geminiWebUrl);
  config.browserHeadless = envBool("BROWSER_HEADLESS", DEFAULTS.browserHeadless);
  config.browserExecutablePath = envStr("BROWSER_EXECUTABLE_PATH", DEFAULTS.browserExecutablePath);
  config.maxContexts = envInt("MAX_CONTEXTS", DEFAULTS.maxContexts, 1);
  config.tempConversationMode = envBool("TEMP_CONVERSATION_MODE", DEFAULTS.tempConversationMode);

  // Request
  config.maxRetries = envInt("MAX_RETRIES", DEFAULTS.maxRetries, 0);
  config.retryDelayMs = envInt("RETRY_DELAY_MS", DEFAULTS.retryDelayMs, 0);
  config.requestTimeoutMs = envInt("REQUEST_TIMEOUT_MS", DEFAULTS.requestTimeoutMs, 1000);

  // Logging
  config.logLevel = envStr("LOG_LEVEL", DEFAULTS.logLevel);

  // Validate auth mode
  if (config.authMode !== "file") {
    throw new Error(
      `Invalid AUTH_MODE "${config.authMode}". Only "file" is supported in MVP.`
    );
  }

  return config;
}

/**
 * Read a string env var with default fallback.
 */
function envStr(key, defaultVal) {
  const val = process.env[key];
  if (val === undefined || val === null || val === "") {
    return defaultVal;
  }
  return val;
}

/**
 * Read an integer env var. Returns defaultVal on invalid/negative/empty.
 */
function envInt(key, defaultVal, min, max) {
  const raw = process.env[key];
  if (raw === undefined || raw === null || raw.trim() === "") {
    return defaultVal;
  }
  const num = Number(raw);
  if (!Number.isFinite(num) || num < 0 || (min !== undefined && num < min) || (max !== undefined && num > max)) {
    return defaultVal;
  }
  return Math.floor(num);
}

/**
 * Read a boolean env var. Only "true" (case-insensitive) is true.
 */
function envBool(key, defaultVal) {
  const raw = process.env[key];
  if (raw === undefined || raw === null || raw === "") {
    return defaultVal;
  }
  return raw.trim().toLowerCase() === "true";
}

/**
 * Read API_KEYS as comma-separated list, trim, filter empty.
 * Falls back to defaultVal if all empty.
 */
function envApiKeys(key, defaultVal) {
  const raw = process.env[key];
  if (raw === undefined || raw === null || raw.trim() === "") {
    return defaultVal;
  }
  const keys = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return keys.length > 0 ? keys : defaultVal;
}

module.exports = { loadConfig };
