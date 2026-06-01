/**
 * AuthSyncClient - optional HTTP client for syncing auth from AIStudioToAPI.
 * MVP stub: not implemented. Reserved for future use.
 */

class AuthSyncClient {
  constructor({ baseUrl, token, logger }) {
    this.baseUrl = baseUrl;
    this.token = token;
    this.logger = logger;
  }

  /**
   * Fetch auth files from AIStudioToAPI.
   * Not implemented in MVP.
   */
  async fetchAuthFiles() {
    this.logger.warn("[AuthSyncClient] HTTP auth sync is not implemented in MVP.");
    return [];
  }
}

module.exports = AuthSyncClient;
