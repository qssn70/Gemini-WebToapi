/**
 * GeminiPageController - handles all Gemini Web page interactions.
 * All selector-based operations are isolated here.
 */

const selectors = require("./selectors");
const {
  AuthRequiredError,
  QuotaExceededError,
  GeminiPageTimeoutError,
  EmptyResponseError,
} = require("../utils/Errors");
const sleep = require("../utils/sleep");

class GeminiPageController {
  constructor({ logger, config }) {
    this.logger = logger;
    this.config = config;
  }

  /**
   * Ensure the page is ready for interaction.
   * In temp conversation mode, always navigates to a fresh URL to avoid history carry-over.
   * Otherwise navigates only if not already on Gemini.
   * Checks for login/quotas state.
   *
   * @param {import('playwright').Page} page
   */
  async ensureReady(page) {
    const currentUrl = page.url();
    const needsNavigation =
      this.config.tempConversationMode || !currentUrl.includes("gemini.google.com");

    if (needsNavigation) {
      this.logger.debug(
        `[PageController] Navigating to Gemini Web (tempMode=${this.config.tempConversationMode})...`
      );
      await page.goto(this.config.geminiWebUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await sleep(2000);
    }

    // Check for login state
    await this._checkLoginState(page);
  }

  /**
   * Generate a response from Gemini Web.
   *
   * @param {import('playwright').Page} page
   * @param {object} params
   * @param {string} params.prompt
   * @param {string} [params.systemInstruction]
   * @param {string} [params.model]
   * @param {string} [params.webModelLabel]
   * @param {object} [params.generationConfig]
   * @param {string} [params.requestId]
   * @returns {Promise<{text: string, finishReason: string, raw: object}>}
   */
  async generate(page, { prompt, systemInstruction, model, webModelLabel, generationConfig, requestId }) {
    await this.ensureReady(page);
    await this._selectModel(page, webModelLabel, requestId);
    await this._selectThinkingLevel(page, generationConfig && generationConfig.thinkingLevel, requestId);

    // Build final prompt with system instruction
    let finalPrompt = prompt;
    if (systemInstruction) {
      finalPrompt = `[System instruction]\n${systemInstruction}\n\n[User]\n${prompt}`;
    }

    this.logger.debug(`[PageController] Sending prompt (${finalPrompt.length} chars), requestId=${requestId}`);

    // Find and clear input
    const inputEl = await this._findElement(page, selectors.input, 5000);
    if (!inputEl) {
      throw new GeminiPageTimeoutError("Could not find input element on Gemini page.");
    }

    await inputEl.click();
    await sleep(300);

    // Clear existing content
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Backspace");
    await sleep(200);

    // Type the prompt
    await inputEl.fill(finalPrompt);
    await sleep(500);

    // Send: click button or press Enter
    const sendBtn = await this._findElement(page, selectors.sendButton, 3000);
    if (sendBtn) {
      await sendBtn.click();
    } else {
      await page.keyboard.press("Enter");
    }

    this.logger.debug("[PageController] Prompt sent, waiting for response...");

    // Wait for response
    const responseText = await this._waitForResponse(page, requestId);

    if (!responseText || responseText.trim().length === 0) {
      throw new EmptyResponseError("Gemini returned an empty response.");
    }

    return {
      text: responseText.trim(),
      finishReason: "STOP",
      raw: {},
    };
  }

  /**
   * Select a Gemini Web model when a web model label is configured.
   */
  async _selectModel(page, webModelLabel, requestId) {
    if (!webModelLabel) return;

    const label = String(webModelLabel).trim();
    if (!label) return;

    try {
      const menuButton = await this._findElement(page, selectors.modelMenuButton, 3000);
      if (!menuButton) {
        this.logger.warn(`[PageController] Model menu not found; continuing with current Gemini Web model, requested=${label}, requestId=${requestId}`);
        return;
      }

      await menuButton.click();
      await sleep(300);

      const option = page.getByText(label, { exact: false }).first();
      await option.click({ timeout: 5000 });
      await sleep(500);

      this.logger.debug(`[PageController] Selected Gemini Web model ${label}, requestId=${requestId}`);
    } catch (err) {
      this.logger.warn(`[PageController] Failed to select Gemini Web model ${label}: ${err.message}, requestId=${requestId}`);
    }
  }

  /**
   * Select a Gemini Web thinking level when requested.
   */
  async _selectThinkingLevel(page, thinkingLevel, requestId) {
    if (!thinkingLevel) return;

    const label = thinkingLevel === "extended" ? "扩展" : "标准";
    const fallbackLabel = thinkingLevel === "extended" ? "Extended" : "Standard";

    try {
      const menuButton = await this._findElement(page, selectors.thinkingMenuButton, 3000);
      if (!menuButton) {
        this.logger.warn(`[PageController] Thinking menu not found; continuing with current thinking level, requested=${thinkingLevel}, requestId=${requestId}`);
        return;
      }

      await menuButton.click();
      await sleep(300);

      const option = page.getByText(label, { exact: false }).or(page.getByText(fallbackLabel, { exact: false })).first();
      await option.click({ timeout: 5000 });
      await sleep(500);

      this.logger.debug(`[PageController] Selected thinking level ${thinkingLevel}, requestId=${requestId}`);
    } catch (err) {
      this.logger.warn(`[PageController] Failed to select thinking level ${thinkingLevel}: ${err.message}, requestId=${requestId}`);
    }
  }

  /**
   * Detect the current page state.
   *
   * @param {import('playwright').Page} page
   * @returns {Promise<string>} "ready" | "login_required" | "quota_exceeded" | "unknown"
   */
  async detectState(page) {
    // Check login hints
    for (const selector of selectors.loginHints) {
      try {
        const el = await page.$(selector);
        if (el) return "login_required";
      } catch {}
    }

    // Check quota hints
    for (const selector of selectors.quotaHints) {
      try {
        const el = await page.$(selector);
        if (el) return "quota_exceeded";
      } catch {}
    }

    return "ready";
  }

  /**
   * Check login state and throw appropriate error.
   */
  async _checkLoginState(page) {
    const state = await this.detectState(page);
    if (state === "login_required") {
      throw new AuthRequiredError("Gemini page requires login.");
    }
    if (state === "quota_exceeded") {
      throw new QuotaExceededError("Gemini page shows quota exceeded.");
    }
  }

  /**
   * Find the first matching element from a list of selectors.
   */
  async _findElement(page, selectorList, timeout) {
    for (const selector of selectorList) {
      try {
        const el = await page.waitForSelector(selector, { timeout: timeout / selectorList.length });
        if (el) return el;
      } catch {
        // Try next selector
      }
    }
    return null;
  }

  /**
   * Wait for Gemini to complete its response.
   * Uses a polling approach: check if response text stabilizes.
   */
  async _waitForResponse(page, requestId) {
    const maxWaitMs = this.config.requestTimeoutMs || 120000;
    const pollIntervalMs = 1000;
    const stableThreshold = 3; // N consecutive identical readings
    let lastText = "";
    let stableCount = 0;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      await sleep(pollIntervalMs);

      // Check if stop button is still visible (means still generating)
      const stopBtn = await this._findElementQuiet(page, selectors.stopButton);
      if (stopBtn) {
        stableCount = 0;
        continue;
      }

      // Extract current response text
      const currentText = await this._extractLatestResponse(page);

      if (currentText && currentText === lastText) {
        stableCount++;
        if (stableCount >= stableThreshold) {
          this.logger.debug(`[PageController] Response stabilized after ${Date.now() - startTime}ms, requestId=${requestId}`);
          return currentText;
        }
      } else {
        stableCount = 0;
        lastText = currentText || "";
      }
    }

    throw new GeminiPageTimeoutError(`Response timed out after ${maxWaitMs}ms, requestId=${requestId}`);
  }

  /**
   * Extract the latest response text from the page.
   */
  async _extractLatestResponse(page) {
    for (const selector of selectors.responseCandidates) {
      try {
        const elements = await page.$$(selector);
        if (elements.length > 0) {
          const lastEl = elements[elements.length - 1];
          const text = await lastEl.innerText();
          if (text && text.trim().length > 0) {
            return text.trim();
          }
        }
      } catch {
        // Try next selector
      }
    }
    return null;
  }

  /**
   * Quietly try to find an element without throwing.
   */
  async _findElementQuiet(page, selectorList) {
    for (const selector of selectorList) {
      try {
        const el = await page.$(selector);
        if (el) return el;
      } catch {}
    }
    return null;
  }
}

module.exports = GeminiPageController;
