/**
 * Custom error types for the Gemini-web2api system.
 */

class AuthRequiredError extends Error {
  constructor(message = "Authentication is required but the session is not logged in.") {
    super(message);
    this.name = "AuthRequiredError";
    this.httpStatus = 503;
    this.geminiStatus = "UNAVAILABLE";
    this.openaiType = "server_error";
  }
}

class QuotaExceededError extends Error {
  constructor(message = "Quota or rate limit exceeded.") {
    super(message);
    this.name = "QuotaExceededError";
    this.httpStatus = 429;
    this.geminiStatus = "RESOURCE_EXHAUSTED";
    this.openaiType = "rate_limit_error";
  }
}

class GeminiPageTimeoutError extends Error {
  constructor(message = "Gemini page response timed out.") {
    super(message);
    this.name = "GeminiPageTimeoutError";
    this.httpStatus = 504;
    this.geminiStatus = "DEADLINE_EXCEEDED";
    this.openaiType = "server_error";
  }
}

class EmptyResponseError extends Error {
  constructor(message = "Gemini returned an empty response.") {
    super(message);
    this.name = "EmptyResponseError";
    this.httpStatus = 502;
    this.geminiStatus = "BAD_GATEWAY";
    this.openaiType = "server_error";
  }
}

class PageCrashedError extends Error {
  constructor(message = "Browser page crashed or became unresponsive.") {
    super(message);
    this.name = "PageCrashedError";
    this.httpStatus = 502;
    this.geminiStatus = "BAD_GATEWAY";
    this.openaiType = "server_error";
  }
}

class NoAuthAvailableError extends Error {
  constructor(message = "No usable authenticated Gemini Web account is available.") {
    super(message);
    this.name = "NoAuthAvailableError";
    this.httpStatus = 503;
    this.geminiStatus = "UNAVAILABLE";
    this.openaiType = "server_error";
  }
}

class ValidationError extends Error {
  constructor(message = "Invalid request.") {
    super(message);
    this.name = "ValidationError";
    this.httpStatus = 400;
    this.geminiStatus = "INVALID_ARGUMENT";
    this.openaiType = "invalid_request_error";
  }
}

module.exports = {
  AuthRequiredError,
  QuotaExceededError,
  GeminiPageTimeoutError,
  EmptyResponseError,
  PageCrashedError,
  NoAuthAvailableError,
  ValidationError,
};
