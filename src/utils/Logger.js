/**
 * Simple logging service with configurable levels.
 */

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

class Logger {
  constructor({ level = "info" } = {}) {
    this.level = LEVELS[level] !== undefined ? LEVELS[level] : LEVELS.info;
  }

  _timestamp() {
    return new Date().toISOString();
  }

  _log(level, ...args) {
    if (LEVELS[level] <= this.level) {
      const prefix = `[${this._timestamp()}] [${level.toUpperCase()}]`;
      if (level === "error") {
        console.error(prefix, ...args);
      } else if (level === "warn") {
        console.warn(prefix, ...args);
      } else {
        console.log(prefix, ...args);
      }
    }
  }

  error(...args) { this._log("error", ...args); }
  warn(...args) { this._log("warn", ...args); }
  info(...args) { this._log("info", ...args); }
  debug(...args) { this._log("debug", ...args); }
}

module.exports = Logger;
