/**
 * GeminiWeb2ApiSystem - composition root.
 * Wires all components together and manages lifecycle.
 */

const express = require("express");
const { loadConfig } = require("../utils/ConfigLoader");
const Logger = require("../utils/Logger");
const AuthSource = require("../auth/AuthSource");
const BrowserPool = require("./BrowserPool");
const GeminiPageController = require("../browser/GeminiPageController");
const GeminiWebClient = require("../browser/GeminiWebClient");
const RequestHandler = require("./RequestHandler");
const { createModelRegistry } = require("./ModelRegistry");
const { createApiKeyAuthMiddleware } = require("../middleware/ApiKeyAuth");
const { createHealthRoutes } = require("../routes/HealthRoutes");
const { createGeminiRoutes } = require("../routes/GeminiRoutes");
const { createOpenAIRoutes } = require("../routes/OpenAIRoutes");
const { createWebRoutes } = require("../routes/WebRoutes");

class GeminiWeb2ApiSystem {
  constructor() {
    this.config = null;
    this.logger = null;
    this.authSource = null;
    this.browserPool = null;
    this.pageController = null;
    this.geminiWebClient = null;
    this.modelRegistry = null;
    this.requestHandler = null;
    this.app = null;
    this.server = null;
  }

  /**
   * Start the system.
   */
  async start() {
    // Load config
    this.config = loadConfig();

    // Create logger
    this.logger = new Logger({ level: this.config.logLevel });
    this.logger.info("[System] Starting Gemini-web2api...");

    // Create AuthSource and load auth files
    this.authSource = new AuthSource({
      authDir: this.config.authDir,
      logger: this.logger,
    });
    this.authSource.reload();

    // Create BrowserPool
    this.browserPool = new BrowserPool({
      config: this.config,
      logger: this.logger,
      authSource: this.authSource,
    });

    // Create page controller
    this.pageController = new GeminiPageController({
      logger: this.logger,
      config: this.config,
    });

    // Create web client
    this.geminiWebClient = new GeminiWebClient({
      browserPool: this.browserPool,
      pageController: this.pageController,
      logger: this.logger,
    });

    // Create model registry
    this.modelRegistry = createModelRegistry({
      models: this.config.models,
      defaultModel: this.config.defaultModel,
    });

    // Create request handler
    this.requestHandler = new RequestHandler({
      config: this.config,
      logger: this.logger,
      authSource: this.authSource,
      browserPool: this.browserPool,
      geminiWebClient: this.geminiWebClient,
      modelRegistry: this.modelRegistry,
    });

    // Create Express app
    this.app = this._createApp();

    // Start browser
    await this.browserPool.start();

    // Start HTTP server
    await new Promise((resolve) => {
      this.server = this.app.listen(this.config.port, this.config.host, () => {
        this.logger.info(`[System] Server listening on ${this.config.host}:${this.config.port}`);
        resolve();
      });
    });

    this.logger.info("[System] Gemini-web2api started successfully.");
  }

  /**
   * Stop the system gracefully.
   */
  async stop() {
    this.logger.info("[System] Stopping Gemini-web2api...");

    // Close HTTP server
    if (this.server) {
      await new Promise((resolve) => {
        this.server.close(() => {
          this.logger.info("[System] HTTP server closed.");
          resolve();
        });
      });
    }

    // Stop browser
    if (this.browserPool) {
      await this.browserPool.stop();
    }

    this.logger.info("[System] Gemini-web2api stopped.");
  }

  /**
   * Create and configure the Express application.
   */
  _createApp() {
    const app = express();

    // Parse JSON bodies
    app.use(express.json({ limit: "20mb" }));

    // Public routes (no auth)
    const healthRoutes = createHealthRoutes({
      authSource: this.authSource,
      browserPool: this.browserPool,
      logger: this.logger,
    });
    app.use("/", healthRoutes);

    // Web UI and management API (no auth, must be before API key middleware)
    const webRoutes = createWebRoutes({
      authSource: this.authSource,
      browserPool: this.browserPool,
      requestHandler: this.requestHandler,
      modelRegistry: this.modelRegistry,
      config: this.config,
      logger: this.logger,
    });
    app.use("/", webRoutes);

    // API key middleware for protected routes
    const apiKeyAuth = createApiKeyAuthMiddleware(this.config.apiKeys);

    // Gemini API routes
    const geminiRoutes = createGeminiRoutes({
      requestHandler: this.requestHandler,
      modelRegistry: this.modelRegistry,
    });
    app.use("/v1beta", apiKeyAuth, geminiRoutes);

    // OpenAI-compatible routes
    const openaiRoutes = createOpenAIRoutes({
      requestHandler: this.requestHandler,
      modelRegistry: this.modelRegistry,
    });
    app.use("/", apiKeyAuth, openaiRoutes);

    // 404 handler
    app.use((req, res) => {
      res.status(404).json({
        error: {
          code: 404,
          message: `Route not found: ${req.method} ${req.path}`,
          status: "NOT_FOUND",
        },
      });
    });

    // Global error handler
    app.use((err, req, res, _next) => {
      this.logger.error(`[System] Unhandled Express error: ${err.message}`);
      res.status(500).json({
        error: {
          code: 500,
          message: "An internal server error occurred.",
          status: "INTERNAL",
        },
      });
    });

    return app;
  }
}

module.exports = GeminiWeb2ApiSystem;
