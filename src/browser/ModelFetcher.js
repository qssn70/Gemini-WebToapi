/**
 * ModelFetcher - dynamically fetch available models from Gemini API
 * using the browser context's Google auth cookies.
 */

const fs = require("fs");
const path = require("path");

const DEFAULT_TTL_MS = 3600000; // 1 hour
const MODELS_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";

class ModelFetcher {
  constructor({ logger, config }) {
    this.logger = logger;
    this.config = config;
    this._cache = null;
    this._cacheTime = 0;
    this._ttl = DEFAULT_TTL_MS;
    this._fetching = null; // dedup concurrent fetches
  }

  /**
   * Get models list. Returns cached data if fresh, otherwise fetches.
   * @param {import('playwright').BrowserContext} [context] - browser context for auth cookies
   * @returns {Promise<Array>} models array in Gemini API format
   */
  async getModels(context) {
    const now = Date.now();
    if (this._cache && now - this._cacheTime < this._ttl) {
      return this._cache;
    }

    // Dedup concurrent fetches
    if (this._fetching) return this._fetching;

    this._fetching = this._fetch(context).finally(() => {
      this._fetching = null;
    });

    return this._fetching;
  }

  /**
   * Force a refresh of the models cache.
   */
  invalidateCache() {
    this._cache = null;
    this._cacheTime = 0;
  }

  /**
   * Fetch models from Gemini API via browser context.
   * Uses context.request which carries the context's cookies
   * and is not subject to page CORS restrictions.
   */
  async _fetch(context) {
    if (context) {
      try {
        const resp = await context.request.get(MODELS_API_URL);
        if (resp.ok()) {
          const result = await resp.json();
          if (result.models && Array.isArray(result.models) && result.models.length > 0) {
            this._cache = result.models;
            this._cacheTime = Date.now();
            this.logger.info(`[ModelFetcher] Fetched ${result.models.length} models from Gemini API.`);
            return this._cache;
          }
        } else {
          this.logger.warn(`[ModelFetcher] Gemini API returned ${resp.status()}`);
        }
      } catch (err) {
        this.logger.warn(`[ModelFetcher] Failed to fetch models from API: ${err.message}`);
      }
    }

    // Fallback: read from configs/models.json
    return this._loadFromFile();
  }

  /**
   * Load models from the static config file.
   */
  _loadFromFile() {
    const modelsPath = path.join(__dirname, "../../configs/models.json");
    try {
      const data = JSON.parse(fs.readFileSync(modelsPath, "utf-8"));
      if (data.models && Array.isArray(data.models)) {
        this._cache = data.models;
        this._cacheTime = Date.now();
        this.logger.info(`[ModelFetcher] Loaded ${data.models.length} models from config file.`);
        return this._cache;
      }
    } catch (err) {
      this.logger.warn(`[ModelFetcher] Failed to load models config: ${err.message}`);
    }

    // Ultimate fallback
    this._cache = [
      {
        name: "models/gemini-web",
        displayName: "Gemini Web",
        description: "Gemini Web through browser automation",
        supportedGenerationMethods: ["generateContent"],
      },
    ];
    this._cacheTime = Date.now();
    return this._cache;
  }
}

module.exports = ModelFetcher;
