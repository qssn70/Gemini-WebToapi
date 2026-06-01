/**
 * AuthSource - loads and manages auth files from the auth directory.
 * Compatible with AIStudioToAPI's auth-N.json format (Playwright storageState).
 */

const fs = require("fs");
const path = require("path");

const AUTH_FILE_REGEX = /^auth-(\d+)\.json$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class AuthSource {
  constructor({ authDir, logger }) {
    this.authDir = authDir;
    this.logger = logger;

    this.initialIndices = [];
    this.availableIndices = [];
    this.rotationIndices = [];
    this.expiredIndices = [];
    this.duplicateIndices = [];
    this.accountNameMap = new Map();
    this.canonicalIndexMap = new Map();
    this.authMap = new Map();
  }

  /**
   * Scan the auth directory and reload all auth files.
   */
  reload() {
    this.initialIndices = [];
    this.availableIndices = [];
    this.rotationIndices = [];
    this.expiredIndices = [];
    this.duplicateIndices = [];
    this.accountNameMap = new Map();
    this.canonicalIndexMap = new Map();
    this.authMap = new Map();

    // Check directory existence
    if (!fs.existsSync(this.authDir)) {
      this.logger.warn(`[AuthSource] Auth directory does not exist: ${this.authDir}`);
      return;
    }

    let files;
    try {
      files = fs.readdirSync(this.authDir);
    } catch (err) {
      this.logger.warn(`[AuthSource] Failed to read auth directory: ${err.message}`);
      return;
    }

    // Filter and parse auth-N.json files
    const entries = [];
    for (const file of files) {
      const match = file.match(AUTH_FILE_REGEX);
      if (!match) continue;

      const index = parseInt(match[1], 10);
      const filePath = path.join(this.authDir, file);

      let raw;
      try {
        raw = fs.readFileSync(filePath, "utf-8");
      } catch (err) {
        this.logger.warn(`[AuthSource] Failed to read ${file}: ${err.message}`);
        continue;
      }

      let data;
      try {
        data = JSON.parse(raw);
      } catch (err) {
        this.logger.warn(`[AuthSource] Invalid JSON in ${file}: ${err.message}`);
        continue;
      }

      if (!Array.isArray(data.cookies)) {
        this.logger.warn(`[AuthSource] ${file} missing cookies array, skipping.`);
        continue;
      }

      if (!Array.isArray(data.origins)) {
        this.logger.warn(`[AuthSource} ${file} missing origins array, skipping.`);
        continue;
      }

      entries.push({ index, data, file });
    }

    // Sort by index ascending
    entries.sort((a, b) => a.index - b.index);

    // Build available indices and maps
    for (const { index, data } of entries) {
      this.initialIndices.push(index);
      this.availableIndices.push(index);
      this.authMap.set(index, data);
      this.accountNameMap.set(index, data.accountName || null);

      if (data.expired === true) {
        this.expiredIndices.push(index);
      }
    }

    // Deduplication: only for email-like accountNames
    const emailToIndices = new Map();
    for (const index of this.availableIndices) {
      const name = this.accountNameMap.get(index);
      if (!name) continue;
      const normalized = normalizeEmail(name);
      if (!normalized) continue;

      if (!emailToIndices.has(normalized)) {
        emailToIndices.set(normalized, []);
      }
      emailToIndices.get(normalized).push(index);
    }

    // For each duplicate email group, keep the highest index
    for (const [email, indices] of emailToIndices) {
      if (indices.length <= 1) continue;

      const sorted = [...indices].sort((a, b) => b - a);
      const keepIndex = sorted[0];
      const dupes = sorted.slice(1);

      for (const dupe of dupes) {
        this.duplicateIndices.push(dupe);
        this.canonicalIndexMap.set(dupe, keepIndex);
      }
      this.canonicalIndexMap.set(keepIndex, keepIndex);
    }

    // Build rotation indices: available, not expired, not duplicate
    for (const index of this.availableIndices) {
      if (this.expiredIndices.includes(index)) continue;
      if (this.duplicateIndices.includes(index)) continue;
      this.rotationIndices.push(index);
    }

    // Set canonical for non-duplicate, non-expired entries
    for (const index of this.rotationIndices) {
      if (!this.canonicalIndexMap.has(index)) {
        this.canonicalIndexMap.set(index, index);
      }
    }

    this.logger.info(
      `[AuthSource] Loaded ${this.availableIndices.length} auth file(s), ` +
        `${this.rotationIndices.length} in rotation, ` +
        `${this.expiredIndices.length} expired, ` +
        `${this.duplicateIndices.length} duplicates.`
    );
  }

  /**
   * Get the full auth data object for a given index.
   * @param {number} index
   * @returns {object|null}
   */
  getAuth(index) {
    return this.authMap.get(index) || null;
  }

  /**
   * Get the file path for a given auth index.
   * @param {number} index
   * @returns {string}
   */
  getAuthPath(index) {
    return path.join(this.authDir, `auth-${index}.json`);
  }

  /**
   * Get all available indices (includes expired and duplicates).
   * @returns {number[]}
   */
  getAvailableIndices() {
    return [...this.availableIndices];
  }

  /**
   * Get rotation indices (not expired, not duplicate).
   * @returns {number[]}
   */
  getRotationIndices() {
    return [...this.rotationIndices];
  }

  /**
   * Get the canonical index for a given index.
   * @param {number} index
   * @returns {number|undefined}
   */
  getCanonicalIndex(index) {
    return this.canonicalIndexMap.get(index);
  }

  /**
   * Check if an index is marked expired.
   * @param {number} index
   * @returns {boolean}
   */
  isExpired(index) {
    return this.expiredIndices.includes(index);
  }
}

/**
 * Normalize an email: trim and lowercase. Returns null if not a valid email.
 * @param {string} name
 * @returns {string|null}
 */
function normalizeEmail(name) {
  if (typeof name !== "string") return null;
  const trimmed = name.trim().toLowerCase();
  return EMAIL_REGEX.test(trimmed) ? trimmed : null;
}

module.exports = AuthSource;
