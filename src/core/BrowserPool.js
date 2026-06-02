/**
 * BrowserPool - manages browser lifecycle and account contexts.
 */

const {
  buildContextOptions,
  buildLaunchOptions,
  createBrowserType,
  formatAuthSummary,
} = require("../browser/BrowserRuntime");
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
    this.runtimeFailures = new Map();
  }

  /**
   * Start the browser.
   */
  async start() {
    this.logger.info(
      `[BrowserPool] Starting ${this.config.browserEngine || "chromium"} browser...`,
    );

    const browserType = createBrowserType(this.config);
    const launchOptions = buildLaunchOptions(this.config);

    this.browser = await browserType.launch(launchOptions);
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
    if (
      this.currentPage &&
      this.currentContext &&
      this.currentAuthIndex !== null
    ) {
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
    const indices = this._getUsableRotationIndices();
    if (indices.length === 0) {
      throw new NoAuthAvailableError(
        "No auth accounts available for rotation.",
      );
    }

    // Close current session
    await this._closeCurrentSession();

    // Move to next index
    this.rotationPosition = (this.rotationPosition + 1) % indices.length;
    this.logger.info(
      `[BrowserPool] Rotating to position ${this.rotationPosition}, reason: ${reason || "manual"}`,
    );

    return await this._createSession();
  }

  /**
   * Switch to a specific account by auth index.
   * The index must be in the current rotation list.
   *
   * @param {number} authIndex - The auth index to switch to.
   * @returns {Promise<{authIndex: number, context: import('playwright').BrowserContext, page: import('playwright').Page}>}
   */
  async switchToAccount(authIndex) {
    const indices = this._getUsableRotationIndices();
    const pos = indices.indexOf(authIndex);
    if (pos === -1) {
      throw new NoAuthAvailableError(
        `Auth index ${authIndex} is not in the rotation list (may be expired, duplicate, or missing).`,
      );
    }

    // Close current session
    await this._closeCurrentSession();

    // Set rotation position to the target account
    this.rotationPosition = pos;
    this.logger.info(
      `[BrowserPool] Switching to account ${authIndex} (position ${pos})`,
    );

    return await this._createSession();
  }

  /**
   * Mark the current account as failed and rotate.
   * @param {string} [reason]
   */
  async markCurrentAccountFailed(reason) {
    const failedAuthIndex = this.currentAuthIndex;
    this.logger.warn(
      `[BrowserPool] Account ${failedAuthIndex} failed: ${reason}`,
    );

    if (failedAuthIndex !== null) {
      this.runtimeFailures.set(failedAuthIndex, {
        reason: reason || "unknown",
        failedAt: new Date().toISOString(),
      });

      const storageState = this.authSource.getAuth(failedAuthIndex);
      if (storageState) {
        this.logger.warn(
          `[BrowserPool] Failed auth storageState summary: ${formatAuthSummary(failedAuthIndex, storageState)}`,
        );
      }

      if (this._getUsableRotationIndices().length === 0) {
        await this._closeCurrentSession();
        throw new NoAuthAvailableError(
          "No auth accounts available for rotation.",
        );
      }
    }

    return await this.rotate(reason);
  }

  /**
   * Refresh auth source and reset rotation.
   */
  refreshAuthSources() {
    this.authSource.reload();
    this.rotationPosition = 0;
    this.runtimeFailures.clear();
  }

  /**
   * Get auth indices that failed at runtime in this process.
   */
  getRuntimeFailedAuthIndices() {
    return [...this.runtimeFailures.keys()].sort((a, b) => a - b);
  }

  /**
   * Get runtime status for an auth index.
   */
  getAccountRuntimeStatus(authIndex) {
    const failure = this.runtimeFailures.get(authIndex);
    if (!failure) {
      return { failed: false, reason: null, failedAt: null };
    }
    return { failed: true, reason: failure.reason, failedAt: failure.failedAt };
  }

  /**
   * Create a new session using the current rotation position.
   */
  async _createSession() {
    const indices = this._getUsableRotationIndices();
    if (indices.length === 0) {
      throw new NoAuthAvailableError(
        "No usable authenticated Gemini Web account is available.",
      );
    }

    // Ensure rotation position is within bounds
    if (this.rotationPosition >= indices.length) {
      this.rotationPosition = 0;
    }

    const authIndex = indices[this.rotationPosition];
    const storageState = this.authSource.getAuth(authIndex);

    if (!storageState) {
      throw new NoAuthAvailableError(
        `Auth data not found for index ${authIndex}.`,
      );
    }

    this.logger.info(
      `[BrowserPool] Creating context for auth index ${authIndex}...`,
    );
    this.logger.debug(
      `[BrowserPool] Auth storageState summary: ${formatAuthSummary(authIndex, storageState)}`,
    );

    const contextOptions = buildContextOptions(this.config, storageState);
    const context = await this.browser.newContext(contextOptions);

    if (this.config.browserInitScript) {
      await context.addInitScript(this.config.browserInitScript);
    }

    const page = await context.newPage();

    this.currentAuthIndex = authIndex;
    this.currentContext = context;
    this.currentPage = page;

    this.logger.info(
      `[BrowserPool] Session created for auth index ${authIndex}.`,
    );

    return { authIndex, context, page };
  }

  /**
   * Get rotation indices excluding auth files that already failed at runtime.
   */
  _getUsableRotationIndices() {
    return this.authSource
      .getRotationIndices()
      .filter((index) => !this.runtimeFailures.has(index));
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
      this.logger.debug(
        `[BrowserPool] Wrote back auth file for index ${authIndex}.`,
      );
    } catch (err) {
      this.logger.warn(
        `[BrowserPool] Failed to write back auth file: ${err.message}`,
      );
    }
  }
}

module.exports = BrowserPool;
