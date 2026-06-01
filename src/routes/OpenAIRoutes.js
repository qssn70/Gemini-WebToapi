/**
 * OpenAIRoutes - OpenAI-compatible API routes.
 */

const express = require("express");

function createOpenAIRoutes({ requestHandler, modelRegistry }) {
  const router = express.Router();

  // List models
  router.get("/v1/models", (req, res) => {
    res.json(modelRegistry.listOpenAIModels());
  });

  // Chat completions
  router.post("/v1/chat/completions", (req, res) => {
    return requestHandler.handleOpenAIChatCompletion(req, res);
  });

  return router;
}

module.exports = { createOpenAIRoutes };
