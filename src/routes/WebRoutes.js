/**
 * WebRoutes - Web UI and management API endpoints.
 */

const express = require("express");
const path = require("path");
const fs = require("fs");

const DEBUG_DIR = path.join(process.cwd(), "debug");

function createWebRoutes({ authSource, browserPool, requestHandler, modelRegistry, config, logger }) {
  const router = express.Router();

  // Serve the Web UI
  router.get("/ui", (req, res) => {
    const htmlPath = path.join(__dirname, "../../ui/index.html");
    if (fs.existsSync(htmlPath)) {
      res.sendFile(htmlPath);
    } else {
      res.status(404).send("Web UI not found.");
    }
  });

  // System status API
  router.get("/api/status", (req, res) => {
    const rotationIndices = authSource.getRotationIndices();
    const availableIndices = authSource.getAvailableIndices();
    const expiredIndices = authSource.expiredIndices || [];
    const duplicateIndices = authSource.duplicateIndices || [];

    const runtimeFailedIndices = typeof browserPool.getRuntimeFailedAuthIndices === "function"
      ? browserPool.getRuntimeFailedAuthIndices()
      : [];

    const accountDetails = availableIndices.map((index) => {
      const auth = authSource.getAuth(index);
      const runtimeStatus = typeof browserPool.getAccountRuntimeStatus === "function"
        ? browserPool.getAccountRuntimeStatus(index)
        : { failed: false, reason: null, failedAt: null };
      const isExpired = expiredIndices.includes(index);
      const isDuplicate = duplicateIndices.includes(index);
      const isRotation = rotationIndices.includes(index);
      return {
        index,
        name: (auth && auth.accountName) || null,
        isDuplicate,
        isExpired,
        isRotation,
        runtimeFailed: runtimeStatus.failed,
        runtimeFailureReason: runtimeStatus.reason,
        runtimeFailedAt: runtimeStatus.failedAt,
        isHealthy: isRotation && !isExpired && !isDuplicate && !runtimeStatus.failed,
        canonicalIndex: authSource.getCanonicalIndex(index) ?? null,
      };
    });

    res.json({
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      browser: {
        started: browserPool.browser !== null,
        currentAuthIndex: browserPool.currentAuthIndex,
      },
      accounts: {
        total: availableIndices.length,
        rotation: rotationIndices.length,
        expired: expiredIndices.length,
        duplicate: duplicateIndices.length,
        runtimeFailed: runtimeFailedIndices.length,
        details: accountDetails,
      },
      config: {
        maxRetries: config.maxRetries,
        retryDelayMs: config.retryDelayMs,
        requestTimeoutMs: config.requestTimeoutMs,
        browserHeadless: config.browserHeadless,
        maxContexts: config.maxContexts,
        enableAuthUpdate: config.enableAuthUpdate,
        geminiWebUrl: config.geminiWebUrl,
        tempConversationMode: config.tempConversationMode,
        enablePageDebug: config.enablePageDebug,
        defaultModel: modelRegistry.defaultModel,
        models: modelRegistry.models.map((model) => ({
          id: model.id,
          displayName: model.displayName,
          webModelLabel: model.webModelLabel,
        })),
      },
      logs: logger.getRecentLogs(200),
    });
  });

  // Switch to a specific account
  router.post("/api/account/switch", async (req, res) => {
    const authIndex = req.body.authIndex;
    if (authIndex === undefined || authIndex === null || typeof authIndex !== "number") {
      return res.status(400).json({
        error: {
          message: "Missing or invalid 'authIndex' (must be a number).",
          type: "invalid_request",
        },
      });
    }

    try {
      const session = await browserPool.switchToAccount(authIndex);
      logger.info(`[WebUI] Switched to account ${authIndex} via Web UI.`);
      res.json({
        ok: true,
        currentAuthIndex: session.authIndex,
      });
    } catch (err) {
      logger.warn(`[WebUI] Failed to switch to account ${authIndex}: ${err.message}`);
      res.status(400).json({
        error: {
          message: err.message,
          type: err.name || "Error",
        },
      });
    }
  });

  // Reload auth files
  router.post("/api/auth/reload", (req, res) => {
    if (typeof browserPool.refreshAuthSources === "function") {
      browserPool.refreshAuthSources();
    } else {
      authSource.reload();
    }
    logger.info("[WebUI] Auth files reloaded via Web UI.");
    res.json({
      ok: true,
      rotationCount: authSource.getRotationIndices().length,
      totalCount: authSource.getAvailableIndices().length,
    });
  });

  // Capture current Gemini Web page debug artifacts for selector updates
  router.post("/api/debug/page", async (req, res) => {
    if (!config.enablePageDebug) {
      return res.status(404).json({
        error: {
          message: "Page debug capture is disabled. Set ENABLE_PAGE_DEBUG=true to enable it.",
          type: "not_enabled",
        },
      });
    }

    try {
      const session = await browserPool.getCurrentSession();
      await fs.promises.mkdir(DEBUG_DIR, { recursive: true });

      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const htmlPath = path.join(DEBUG_DIR, `gemini-page-${ts}.html`);
      const screenshotPath = path.join(DEBUG_DIR, `gemini-page-${ts}.png`);

      const html = await session.page.content();
      await fs.promises.writeFile(htmlPath, html, "utf-8");
      await session.page.screenshot({ path: screenshotPath, fullPage: true });

      logger.info(`[WebUI] Captured Gemini page debug artifacts: ${htmlPath}, ${screenshotPath}`);
      res.json({
        ok: true,
        htmlPath,
        screenshotPath,
        url: session.page.url(),
      });
    } catch (err) {
      logger.warn(`[WebUI] Failed to capture Gemini page debug artifacts: ${err.message}`);
      res.status(500).json({
        error: {
          message: err.message,
          type: err.name || "Error",
        },
      });
    }
  });

  // Test generateContent (proxies through requestHandler)
  router.post("/api/test/generate", async (req, res) => {
    try {
      // Build a fake Express-like req/res for the request handler
      const fakeReq = {
        params: { model: req.body.model || config.defaultModel },
        body: {
          contents: req.body.contents || [
            { role: "user", parts: [{ text: req.body.prompt || "Hello" }] },
          ],
          systemInstruction: req.body.systemInstruction || undefined,
          generationConfig: req.body.generationConfig || {},
        },
      };

      let responseData = null;
      let statusCode = 200;

      const fakeRes = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(data) {
          responseData = data;
          return this;
        },
      };

      await requestHandler.handleGeminiGenerate(fakeReq, fakeRes);

      res.status(statusCode).json(responseData);
    } catch (err) {
      logger.error(`[WebUI] Test generate failed: ${err.message}`);
      res.status(500).json({
        error: {
          message: err.message,
          type: err.name || "Error",
        },
      });
    }
  });

  return router;
}

module.exports = { createWebRoutes };
