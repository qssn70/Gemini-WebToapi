/**
 * API key authentication middleware.
 * Supports:
 *   Authorization: Bearer <key>
 *   ?key=<key>
 */

function createApiKeyAuthMiddleware(validKeys) {
  const keySet = new Set(validKeys);

  return function apiKeyAuth(req, res, next) {
    let apiKey = null;

    // Check Authorization header: Bearer <key>
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      apiKey = authHeader.slice(7).trim();
    }

    // Fallback: query parameter ?key=<key>
    if (!apiKey && req.query && req.query.key) {
      apiKey = req.query.key.trim();
    }

    if (!apiKey) {
      return res.status(401).json({
        error: {
          code: 401,
          message: "Invalid or missing API key.",
          status: "UNAUTHENTICATED",
        },
      });
    }

    if (!keySet.has(apiKey)) {
      return res.status(401).json({
        error: {
          code: 401,
          message: "Invalid or missing API key.",
          status: "UNAUTHENTICATED",
        },
      });
    }

    next();
  };
}

module.exports = { createApiKeyAuthMiddleware };
