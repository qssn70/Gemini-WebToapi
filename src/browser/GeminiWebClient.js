/**
 * GeminiWebClient - high-level browser client.
 * Wraps BrowserPool and GeminiPageController.
 */

const { PageCrashedError } = require("../utils/Errors");

class GeminiWebClient {
  constructor({ browserPool, pageController, logger }) {
    this.browserPool = browserPool;
    this.pageController = pageController;
    this.logger = logger;
  }

  /**
   * Generate a response using the Gemini Web page.
   *
   * @param {object} request - Internal standard request.
   * @returns {Promise<object>} { text, finishReason, model, authIndex, raw }
   */
  async generate(request) {
    const { requestId, model, webModelLabel, prompt, systemInstruction, generationConfig } = request;

    let session;
    try {
      session = await this.browserPool.getCurrentSession();
    } catch (err) {
      this.logger.error(`[WebClient] Failed to get browser session: ${err.message}, requestId=${requestId}`);
      throw err;
    }

    const { authIndex, page } = session;

    try {
      const result = await this.pageController.generate(page, {
        prompt,
        systemInstruction,
        model,
        webModelLabel,
        generationConfig,
        requestId,
      });

      return {
        text: result.text,
        finishReason: result.finishReason,
        model,
        authIndex,
        raw: result.raw,
      };
    } catch (err) {
      this.logger.error(
        `[WebClient] Page generation failed: ${err.name}: ${err.message}, authIndex=${authIndex}, requestId=${requestId}`
      );

      // If the page crashed, mark for rebuild
      if (err.message && (err.message.includes("crashed") || err.message.includes("closed") || err.message.includes("detached"))) {
        throw new PageCrashedError(`Browser page crashed: ${err.message}`);
      }

      throw err;
    }
  }
}

module.exports = GeminiWebClient;
