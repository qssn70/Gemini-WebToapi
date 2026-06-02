/**
 * Logging service with configurable levels and in-memory log buffer for Web UI.
 */

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

class Logger {
  constructor({ level = "info", maxBuffer = 500 } = {}) {
    this.level = LEVELS[level] !== undefined ? LEVELS[level] : LEVELS.info;
    this.maxBuffer = maxBuffer;
    this._buffer = [];
  }

  _timestamp() {
    return new Date().toISOString();
  }

  _log(level, ...args) {
    // Always buffer regardless of level
    const ts = this._timestamp();
    const message = args
      .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
      .join(" ");
    this._buffer.push({ ts, level, message });
    if (this._buffer.length > this.maxBuffer) {
      this._buffer.shift();
    }

    if (LEVELS[level] <= this.level) {
      const prefix = `[${ts}] [${level.toUpperCase()}]`;
      if (level === "error") {
        console.error(prefix, ...args);
      } else if (level === "warn") {
        console.warn(prefix, ...args);
      } else {
        console.log(prefix, ...args);
      }
    }
  }

  error(...args) {
    this._log("error", ...args);
  }
  warn(...args) {
    this._log("warn", ...args);
  }
  info(...args) {
    this._log("info", ...args);
  }
  debug(...args) {
    this._log("debug", ...args);
  }

  /**
   * Get recent log entries.
   * @param {number} [limit=100]
   * @returns {Array<{ts: string, level: string, message: string}>}
   */
  getRecentLogs(limit = 100) {
    return this._buffer.slice(-limit);
  }

  /**
   * Get log buffer as formatted text.
   * @param {number} [limit=100]
   * @returns {string}
   */
  getRecentLogsText(limit = 100) {
    return this._buffer
      .slice(-limit)
      .map((e) => `[${e.ts}] [${e.level.toUpperCase()}] ${e.message}`)
      .join("\n");
  }
}

module.exports = Logger;
