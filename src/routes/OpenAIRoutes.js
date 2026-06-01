/**
 * OpenAIRoutes - OpenAI-compatible API routes.
 */

const express = require("express");

function createOpenAIRoutes({ requestHandler }) {
  const router = express.Router();

  // Chat completions
  router.post("/v1/chat/completions", (req, res) => {
    return requestHandler.handleOpenAIChatCompletion(req, res);
  });

  return router;
}

module.exports = { createOpenAIRoutes };
