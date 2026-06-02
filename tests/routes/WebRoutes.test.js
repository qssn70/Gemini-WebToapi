const express = require("express");
const request = require("supertest");
const { createWebRoutes } = require("../../src/routes/WebRoutes");

function createLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    getRecentLogs: jest.fn(() => []),
  };
}

function createApp({ browserPool, authSourceOverride = {} }) {
  const app = express();
  app.use(express.json());

  const authSource = {
    expiredIndices: [],
    duplicateIndices: [],
    reload: jest.fn(),
    getRotationIndices: () => [0, 3],
    getAvailableIndices: () => [0, 3],
    getAuth: (index) => ({ accountName: `user${index}@example.com` }),
    getCanonicalIndex: (index) => index,
    ...authSourceOverride,
  };

  const modelRegistry = {
    defaultModel: "gemini-test",
    models: [],
  };

  app.use("/", createWebRoutes({
    authSource,
    browserPool,
    requestHandler: {},
    modelRegistry,
    config: {
      maxRetries: 2,
      retryDelayMs: 1500,
      requestTimeoutMs: 120000,
      browserHeadless: true,
      maxContexts: 1,
      enableAuthUpdate: false,
      geminiWebUrl: "https://gemini.google.com/app",
      tempConversationMode: true,
      enablePageDebug: false,
    },
    logger: createLogger(),
  }));

  return app;
}

describe("WebRoutes", () => {
  test("GET /api/status exposes runtime failed account state", async () => {
    const app = createApp({
      browserPool: {
        browser: {},
        currentAuthIndex: 3,
        getRuntimeFailedAuthIndices: () => [0],
        getAccountRuntimeStatus: (index) => index === 0
          ? { failed: true, reason: "Gemini page requires login.", failedAt: "2026-06-01T16:30:07.191Z" }
          : { failed: false, reason: null, failedAt: null },
      },
    });

    const res = await request(app).get("/api/status");

    expect(res.status).toBe(200);
    expect(res.body.accounts.runtimeFailed).toBe(1);
    expect(res.body.accounts.details).toEqual([
      expect.objectContaining({
        index: 0,
        runtimeFailed: true,
        runtimeFailureReason: "Gemini page requires login.",
        runtimeFailedAt: "2026-06-01T16:30:07.191Z",
        isHealthy: false,
      }),
      expect.objectContaining({
        index: 3,
        runtimeFailed: false,
        runtimeFailureReason: null,
        runtimeFailedAt: null,
        isHealthy: true,
      }),
    ]);
  });

  test("POST /api/auth/reload clears runtime failed account state", async () => {
    const browserPool = {
      browser: {},
      currentAuthIndex: null,
      getRuntimeFailedAuthIndices: () => [0],
      getAccountRuntimeStatus: (index) => index === 0
        ? { failed: true, reason: "Gemini page requires login.", failedAt: "2026-06-01T16:30:07.191Z" }
        : { failed: false, reason: null, failedAt: null },
      refreshAuthSources: jest.fn(),
    };
    const authSource = {
      reload: jest.fn(),
      getRotationIndices: () => [0, 3],
      getAvailableIndices: () => [0, 3],
    };
    const app = createApp({ browserPool, authSourceOverride: authSource });

    const res = await request(app).post("/api/auth/reload");

    expect(res.status).toBe(200);
    expect(browserPool.refreshAuthSources).toHaveBeenCalledTimes(1);
    expect(authSource.reload).not.toHaveBeenCalled();
  });

  test("GET /ui serves the Web UI HTML", async () => {
    const app = createApp({
      browserPool: {
        browser: {},
        currentAuthIndex: null,
      },
    });

    const res = await request(app).get("/ui");

    expect(res.status).toBe(200);
    expect(res.text).toContain("Gemini-web2api 管理面板");
    expect(res.text).toContain('href="/ui/styles.css"');
    expect(res.text).toContain('src="/ui/app.js"');
  });

  test("GET /ui/styles.css serves stylesheet", async () => {
    const app = createApp({
      browserPool: {
        browser: {},
        currentAuthIndex: null,
      },
    });

    const res = await request(app).get("/ui/styles.css");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/css");
    expect(res.text).toContain(":root");
  });

  test("GET /ui/app.js serves client script", async () => {
    const app = createApp({
      browserPool: {
        browser: {},
        currentAuthIndex: null,
      },
    });

    const res = await request(app).get("/ui/app.js");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("javascript");
    expect(res.text).toContain("function apiRequest");
  });
});
