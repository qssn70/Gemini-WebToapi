/**
 * WebRoutes - Web UI and management API endpoints.
 */

const express = require("express");
const path = require("path");
const fs = require("fs");

function createWebRoutes({ authSource, browserPool, requestHandler, config, logger }) {
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

    const accountDetails = availableIndices.map((index) => {
      const auth = authSource.getAuth(index);
      return {
        index,
        name: (auth && auth.accountName) || null,
        isDuplicate: duplicateIndices.includes(index),
        isExpired: expiredIndices.includes(index),
        isRotation: rotationIndices.includes(index),
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
      },
      logs: logger.getRecentLogs(200),
    });
  });

  // Reload auth files
  router.post("/api/auth/reload", (req, res) => {
    authSource.reload();
    logger.info("[WebUI] Auth files reloaded via Web UI.");
    res.json({
      ok: true,
      rotationCount: authSource.getRotationIndices().length,
      totalCount: authSource.getAvailableIndices().length,
    });
  });

  // Test generateContent (proxies through requestHandler)
  router.post("/api/test/generate", async (req, res) => {
    try {
      // Build a fake Express-like req/res for the request handler
      const fakeReq = {
        params: { model: req.body.model || "gemini-web" },
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
