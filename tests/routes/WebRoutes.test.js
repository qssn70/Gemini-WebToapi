const fs = require("fs");
const path = require("path");
const express = require("express");
const request = require("supertest");
const { createWebRoutes } = require("../../src/routes/WebRoutes");

const debugDir = path.join(process.cwd(), "debug");

async function removeDebugArtifacts(paths = []) {
  await Promise.all(
    paths.filter(Boolean).map(async (filePath) => {
      await fs.promises.rm(filePath, { force: true });
    }),
  );

  try {
    const entries = await fs.promises.readdir(debugDir);
    await Promise.all(
      entries.map(async (entry) => {
        await fs.promises.rm(path.join(debugDir, entry), {
          force: true,
          recursive: true,
        });
      }),
    );
    await fs.promises.rmdir(debugDir);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

function createLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    getRecentLogs: jest.fn(() => []),
  };
}

function createApp({
  browserPool,
  authSourceOverride = {},
  requestHandlerOverride = {},
  configOverride = {},
}) {
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
    models: [
      {
        id: "gemini-test",
        displayName: "Gemini Test",
        webModelLabel: "Gemini Test",
      },
    ],
  };

  app.use(
    "/",
    createWebRoutes({
      authSource,
      browserPool,
      requestHandler: requestHandlerOverride,
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
        ...configOverride,
      },
      logger: createLogger(),
    }),
  );

  return app;
}

describe("WebRoutes", () => {
  afterEach(async () => {
    await removeDebugArtifacts();
  });

  test("GET /api/status exposes runtime failed account state", async () => {
    const app = createApp({
      browserPool: {
        browser: {},
        currentAuthIndex: 3,
        getRuntimeFailedAuthIndices: () => [0],
        getAccountRuntimeStatus: (index) =>
          index === 0
            ? {
                failed: true,
                reason: "Gemini page requires login.",
                failedAt: "2026-06-01T16:30:07.191Z",
              }
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
      getAccountRuntimeStatus: (index) =>
        index === 0
          ? {
              failed: true,
              reason: "Gemini page requires login.",
              failedAt: "2026-06-01T16:30:07.191Z",
            }
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
    expect(res.text).toMatch(/\.tabs\s*\{[\s\S]*display:\s*flex;/);
    expect(res.text).toMatch(/\.result-box\.show\s*\{[\s\S]*display:\s*block;/);
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
    expect(res.text).toContain('const API_BASE = "";');
    expect(res.text).toContain("function refreshStatus");
    expect(res.text).toContain("window.WebUi");
  });

  test("POST /api/account/switch rejects missing authIndex", async () => {
    const app = createApp({
      browserPool: {
        browser: {},
        currentAuthIndex: null,
        switchToAccount: jest.fn(),
      },
    });

    const res = await request(app).post("/api/account/switch").send({});

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain("authIndex");
  });

  test("POST /api/account/switch returns selected account", async () => {
    const browserPool = {
      browser: {},
      currentAuthIndex: null,
      switchToAccount: jest.fn(async (authIndex) => ({ authIndex })),
    };
    const app = createApp({ browserPool });

    const res = await request(app)
      .post("/api/account/switch")
      .send({ authIndex: 3 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, currentAuthIndex: 3 });
    expect(browserPool.switchToAccount).toHaveBeenCalledWith(3);
  });

  test("POST /api/test/generate passes WebUI body through Gemini handler", async () => {
    const requestHandler = {
      handleGeminiGenerate: jest.fn(async (req, res) =>
        res.json({ ok: true, model: req.params.model, body: req.body }),
      ),
    };
    const app = createApp({
      browserPool: { browser: {}, currentAuthIndex: null },
      requestHandlerOverride: requestHandler,
    });

    const body = {
      model: "gemini-test",
      contents: [{ role: "user", parts: [{ text: "hello" }] }],
      systemInstruction: { parts: [{ text: "be brief" }] },
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 100,
        thinkingLevel: "standard",
      },
    };

    const res = await request(app).post("/api/test/generate").send(body);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.model).toBe("gemini-test");
    expect(res.body.body).toEqual({
      contents: body.contents,
      systemInstruction: body.systemInstruction,
      generationConfig: body.generationConfig,
    });
    expect(requestHandler.handleGeminiGenerate).toHaveBeenCalledTimes(1);
  });

  test("POST /api/test/generate omits systemInstruction when absent", async () => {
    const requestHandler = {
      handleGeminiGenerate: jest.fn(async (req, res) => {
        expect(
          Object.prototype.hasOwnProperty.call(req.body, "systemInstruction"),
        ).toBe(false);
        return res.json({ ok: true, body: req.body });
      }),
    };
    const app = createApp({
      browserPool: { browser: {}, currentAuthIndex: null },
      requestHandlerOverride: requestHandler,
    });

    const res = await request(app)
      .post("/api/test/generate")
      .send({
        contents: [{ role: "user", parts: [{ text: "hello" }] }],
      });

    expect(res.status).toBe(200);
    expect(res.body.body).toEqual({
      contents: [{ role: "user", parts: [{ text: "hello" }] }],
      generationConfig: {},
    });
  });

  test("POST /api/test/generate uses registry default model when request omits model", async () => {
    const requestHandler = {
      handleGeminiGenerate: jest.fn(async (req, res) =>
        res.json({ ok: true, model: req.params.model }),
      ),
    };
    const app = createApp({
      browserPool: { browser: {}, currentAuthIndex: null },
      requestHandlerOverride: requestHandler,
      configOverride: { defaultModel: "gemini-config-default" },
    });

    const res = await request(app)
      .post("/api/test/generate")
      .send({
        contents: [{ role: "user", parts: [{ text: "hello" }] }],
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, model: "gemini-test" });
    expect(requestHandler.handleGeminiGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        params: { model: "gemini-test" },
      }),
      expect.any(Object),
    );
  });

  test("POST /api/debug/page captures artifacts when enabled", async () => {
    const page = {
      content: jest.fn(async () => "<html>debug</html>"),
      screenshot: jest.fn(async () => undefined),
      url: jest.fn(() => "https://gemini.google.com/app"),
    };
    const app = createApp({
      browserPool: {
        browser: {},
        currentAuthIndex: 0,
        getCurrentSession: jest.fn(async () => ({ page })),
      },
      configOverride: { enablePageDebug: true },
    });

    let htmlPath;
    let screenshotPath;

    try {
      const res = await request(app).post("/api/debug/page");

      htmlPath = res.body.htmlPath;
      screenshotPath = res.body.screenshotPath;

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(htmlPath).toContain("gemini-page-");
      expect(screenshotPath).toContain("gemini-page-");
      expect(res.body.url).toBe("https://gemini.google.com/app");
      expect(page.content).toHaveBeenCalledTimes(1);
      expect(page.screenshot).toHaveBeenCalledTimes(1);
    } finally {
      await removeDebugArtifacts([htmlPath]);
    }
  });

  test("POST /api/debug/page returns disabled error when page debug is off", async () => {
    const app = createApp({
      browserPool: { browser: {}, currentAuthIndex: null },
    });

    const res = await request(app).post("/api/debug/page");

    expect(res.status).toBe(404);
    expect(res.body.error.type).toBe("not_enabled");
  });
});
