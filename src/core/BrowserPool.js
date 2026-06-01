/**
 * BrowserPool - manages browser lifecycle and account contexts.
 */

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { NoAuthAvailableError } = require("../utils/Errors");

class BrowserPool {
  constructor({ config, logger, authSource }) {
    this.config = config;
    this.logger = logger;
    this.authSource = authSource;

    this.browser = null;
    this.currentAuthIndex = null;
    this.currentContext = null;
    this.currentPage = null;
    this.rotationPosition = 0;
  }

  /**
   * Start the browser.
   */
  async start() {
    this.logger.info("[BrowserPool] Starting browser...");

    const launchOptions = {
      headless: this.config.browserHeadless,
    };

    if (this.config.browserExecutablePath) {
      launchOptions.executablePath = this.config.browserExecutablePath;
    }

    this.browser = await chromium.launch(launchOptions);
    this.logger.info("[BrowserPool] Browser started.");
  }

  /**
   * Stop the browser and close all contexts.
   */
  async stop() {
    this.logger.info("[BrowserPool] Stopping browser...");
    try {
      if (this.currentPage) {
        await this.currentPage.close().catch(() => {});
        this.currentPage = null;
      }
      if (this.currentContext) {
        await this.currentContext.close().catch(() => {});
        this.currentContext = null;
      }
      if (this.browser) {
        await this.browser.close().catch(() => {});
        this.browser = null;
      }
    } catch (err) {
      this.logger.warn(`[BrowserPool] Error during stop: ${err.message}`);
    }
    this.logger.info("[BrowserPool] Browser stopped.");
  }

  /**
   * Get the current browser session (authIndex, context, page).
   * Creates a new context/page if none exists.
   *
   * @returns {Promise<{authIndex: number, context: import('playwright').BrowserContext, page: import('playwright').Page}>}
   */
  async getCurrentSession() {
    if (this.currentPage && this.currentContext && this.currentAuthIndex !== null) {
      return {
        authIndex: this.currentAuthIndex,
        context: this.currentContext,
        page: this.currentPage,
      };
    }

    // Need to create a new session
    return await this._createSession();
  }

  /**
   * Rotate to the next available account.
   * @param {string} [reason] - Reason for rotation.
   */
  async rotate(reason) {
    const indices = this.authSource.getRotationIndices();
    if (indices.length === 0) {
      throw new NoAuthAvailableError("No auth accounts available for rotation.");
    }

    // Close current session
    await this._closeCurrentSession();

    // Move to next index
    this.rotationPosition = (this.rotationPosition + 1) % indices.length;
    this.logger.info(`[BrowserPool] Rotating to position ${this.rotationPosition}, reason: ${reason || "manual"}`);

    return await this._createSession();
  }

  /**
   * Mark the current account as failed and rotate.
   * @param {string} [reason]
   */
  async markCurrentAccountFailed(reason) {
    this.logger.warn(`[BrowserPool] Account ${this.currentAuthIndex} failed: ${reason}`);
    return await this.rotate(reason);
  }

  /**
   * Refresh auth source and reset rotation.
   */
  refreshAuthSources() {
    this.authSource.reload();
    this.rotationPosition = 0;
  }

  /**
   * Create a new session using the current rotation position.
   */
  async _createSession() {
    const indices = this.authSource.getRotationIndices();
    if (indices.length === 0) {
      throw new NoAuthAvailableError("No usable authenticated Gemini Web account is available.");
    }

    // Ensure rotation position is within bounds
    if (this.rotationPosition >= indices.length) {
      this.rotationPosition = 0;
    }

    const authIndex = indices[this.rotationPosition];
    const storageState = this.authSource.getAuth(authIndex);

    if (!storageState) {
      throw new NoAuthAvailableError(`Auth data not found for index ${authIndex}.`);
    }

    this.logger.info(`[BrowserPool] Creating context for auth index ${authIndex}...`);

    const context = await this.browser.newContext({ storageState });
    const page = await context.newPage();

    this.currentAuthIndex = authIndex;
    this.currentContext = context;
    this.currentPage = page;

    this.logger.info(`[BrowserPool] Session created for auth index ${authIndex}.`);

    return { authIndex, context, page };
  }

  /**
   * Close the current session (context and page).
   */
  async _closeCurrentSession() {
    try {
      if (this.currentPage) {
        await this.currentPage.close().catch(() => {});
      }
      if (this.currentContext) {
        await this.currentContext.close().catch(() => {});
      }
    } catch (err) {
      this.logger.warn(`[BrowserPool] Error closing session: ${err.message}`);
    }
    this.currentPage = null;
    this.currentContext = null;
    this.currentAuthIndex = null;
  }

  /**
   * Write back the current auth file (optional, only when ENABLE_AUTH_UPDATE=true).
   */
  async writeBackAuth() {
    if (!this.config.enableAuthUpdate) return;
    if (!this.currentContext || this.currentAuthIndex === null) return;

    const authIndex = this.currentAuthIndex;
    const authPath = this.authSource.getAuthPath(authIndex);
    const original = this.authSource.getAuth(authIndex);
    if (!original) return;

    try {
      const storageState = await this.currentContext.storageState();
      original.cookies = storageState.cookies;
      original.origins = storageState.origins;
      fs.writeFileSync(authPath, JSON.stringify(original, null, 2), "utf-8");
      this.logger.debug(`[BrowserPool] Wrote back auth file for index ${authIndex}.`);
    } catch (err) {
      this.logger.warn(`[BrowserPool] Failed to write back auth file: ${err.message}`);
    }
  }
}

module.exports = BrowserPool;
