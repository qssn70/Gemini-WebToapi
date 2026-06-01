/**
 * HealthRoutes - public health check endpoint.
 */

const express = require("express");

function createHealthRoutes({ authSource, browserPool, logger }) {
  const router = express.Router();

  router.get("/health", (req, res) => {
    const rotationIndices = authSource.getRotationIndices();
    const availableIndices = authSource.getAvailableIndices();

    res.json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      authCount: availableIndices.length,
      rotationCount: rotationIndices.length,
      browserStarted: browserPool.browser !== null,
    });
  });

  return router;
}

module.exports = { createHealthRoutes };
