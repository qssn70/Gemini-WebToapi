/**
 * RequestHandler - orchestrates requests: adapter -> browser -> response.
 * Handles retries, account rotation, and error mapping.
 */

const crypto = require("crypto");
const { adaptGeminiRequest } = require("../conversion/GeminiRequestAdapter");
const { adaptGeminiResponse } = require("../conversion/GeminiResponseAdapter");
const { adaptOpenAIRequest } = require("../conversion/OpenAIRequestAdapter");
const { adaptOpenAIResponse } = require("../conversion/OpenAIResponseAdapter");
const {
  AuthRequiredError,
  QuotaExceededError,
  GeminiPageTimeoutError,
  EmptyResponseError,
  PageCrashedError,
  NoAuthAvailableError,
  ValidationError,
} = require("../utils/Errors");
const sleep = require("../utils/sleep");

class RequestHandler {
  constructor({ config, logger, authSource, browserPool, geminiWebClient }) {
    this.config = config;
    this.logger = logger;
    this.authSource = authSource;
    this.browserPool = browserPool;
    this.geminiWebClient = geminiWebClient;
  }

  /**
   * Handle a Gemini generateContent request.
   */
  async handleGeminiGenerate(req, res) {
    const requestId = crypto.randomUUID();
    const model = this._extractModel(req.params.model);

    this.logger.info(`[RequestHandler] Gemini generateContent, model=${model}, requestId=${requestId}`);

    try {
      const internalRequest = adaptGeminiRequest(req.body, requestId, model);
      this.logger.debug(`[RequestHandler] Internal request: prompt=${internalRequest.prompt.length} chars, systemInstruction=${internalRequest.systemInstruction.length} chars`);

      const result = await this._executeWithRetry(internalRequest, requestId);
      const response = adaptGeminiResponse(result);

      this.logger.info(`[RequestHandler] Gemini request completed, requestId=${requestId}`);
      return res.json(response);
    } catch (err) {
      return this._handleError(err, res, requestId, "gemini");
    }
  }

  /**
   * Handle an OpenAI chat completion request.
   */
  async handleOpenAIChatCompletion(req, res) {
    const requestId = crypto.randomUUID();

    this.logger.info(`[RequestHandler] OpenAI chat completion, requestId=${requestId}`);

    // Check for streaming (not supported in MVP)
    if (req.body.stream === true) {
      return res.status(400).json({
        error: {
          message: "Streaming is not supported by Gemini-web2api MVP.",
          type: "invalid_request_error",
          param: "stream",
          code: "unsupported_feature",
        },
      });
    }

    try {
      const internalRequest = adaptOpenAIRequest(req.body, requestId);
      this.logger.debug(`[RequestHandler] Internal request: prompt=${internalRequest.prompt.length} chars`);

      const result = await this._executeWithRetry(internalRequest, requestId);
      const response = adaptOpenAIResponse({ ...result, requestId });

      this.logger.info(`[RequestHandler] OpenAI request completed, requestId=${requestId}`);
      return res.json(response);
    } catch (err) {
      return this._handleError(err, res, requestId, "openai");
    }
  }

  /**
   * Execute a request with retry logic.
   */
  async _executeWithRetry(internalRequest, requestId) {
    const maxAttempts = 1 + this.config.maxRetries;
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.logger.debug(`[RequestHandler] Attempt ${attempt}/${maxAttempts}, requestId=${requestId}`);
        return await this.geminiWebClient.generate(internalRequest);
      } catch (err) {
        lastError = err;
        this.logger.warn(`[RequestHandler] Attempt ${attempt} failed: ${err.name}: ${err.message}, requestId=${requestId}`);

        // Determine if we should retry
        const shouldRetry = this._shouldRetry(err, attempt, maxAttempts);
        if (!shouldRetry) {
          throw err;
        }

        // Handle rotation/recovery before retry
        await this._handleRetryAction(err, requestId);

        if (attempt < maxAttempts) {
          this.logger.info(`[RequestHandler] Retrying in ${this.config.retryDelayMs}ms...`);
          await sleep(this.config.retryDelayMs);
        }
      }
    }

    throw lastError;
  }

  /**
   * Determine if a request should be retried.
   */
  _shouldRetry(err, attempt, maxAttempts) {
    if (attempt >= maxAttempts) return false;

    // Always retry auth/quota errors (rotate account)
    if (err instanceof AuthRequiredError) return true;
    if (err instanceof QuotaExceededError) return true;

    // Retry page timeout (rebuild page)
    if (err instanceof GeminiPageTimeoutError) return true;

    // Retry page crash
    if (err instanceof PageCrashedError) return true;

    // Don't retry validation errors
    if (err instanceof ValidationError) return false;

    // Don't retry no auth available
    if (err instanceof NoAuthAvailableError) return false;

    return true;
  }

  /**
   * Handle the action needed before a retry.
   */
  async _handleRetryAction(err, requestId) {
    if (err instanceof AuthRequiredError || err instanceof QuotaExceededError) {
      try {
        await this.browserPool.markCurrentAccountFailed(err.message);
      } catch (rotateErr) {
        this.logger.error(`[RequestHandler] Failed to rotate account: ${rotateErr.message}, requestId=${requestId}`);
      }
    } else if (err instanceof GeminiPageTimeoutError || err instanceof PageCrashedError) {
      try {
        // Close and recreate the session
        await this.browserPool.rotate("page_error");
      } catch (rotateErr) {
        this.logger.error(`[RequestHandler] Failed to rotate after page error: ${rotateErr.message}, requestId=${requestId}`);
      }
    }
  }

  /**
   * Map internal errors to HTTP responses.
   */
  _handleError(err, res, requestId, sourceApi) {
    // Known error types with defined HTTP status
    if (err.httpStatus) {
      if (sourceApi === "openai") {
        return res.status(err.httpStatus).json({
          error: {
            message: err.message,
            type: err.openaiType || "server_error",
            param: null,
            code: null,
          },
        });
      }
      // Gemini format
      return res.status(err.httpStatus).json({
        error: {
          code: err.httpStatus,
          message: err.message,
          status: err.geminiStatus || "INTERNAL",
        },
      });
    }

    // ValidationError
    if (err instanceof ValidationError) {
      if (sourceApi === "openai") {
        return res.status(400).json({
          error: {
            message: err.message,
            type: "invalid_request_error",
            param: null,
            code: null,
          },
        });
      }
      return res.status(400).json({
        error: {
          code: 400,
          message: err.message,
          status: "INVALID_ARGUMENT",
        },
      });
    }

    // Unknown error
    this.logger.error(`[RequestHandler] Unhandled error: ${err.stack || err.message}, requestId=${requestId}`);

    if (sourceApi === "openai") {
      return res.status(500).json({
        error: {
          message: "An internal server error occurred.",
          type: "server_error",
          param: null,
          code: null,
        },
      });
    }
    return res.status(500).json({
      error: {
        code: 500,
        message: "An internal server error occurred.",
        status: "INTERNAL",
      },
    });
  }

  /**
   * Extract the model name from the route param.
   * e.g. "gemini-web" or "models/gemini-web"
   */
  _extractModel(modelParam) {
    if (!modelParam) return "gemini-web";
    // Strip "models/" prefix if present
    return modelParam.replace(/^models\//, "");
  }
}

module.exports = RequestHandler;
