/**
 * OpenAIRoutes - OpenAI-compatible API routes.
 */

const express = require("express");

function createOpenAIRoutes({ requestHandler, modelFetcher, browserPool }) {
  const router = express.Router();

  // List models (OpenAI format)
  router.get("/v1/models", async (req, res) => {
    try {
      let context = null;
      try {
        const session = await browserPool.getCurrentSession();
        context = session.context;
      } catch {}

      const models = await modelFetcher.getModels(context);

      res.json({
        object: "list",
        data: models.map((m) => ({
          id: (m.name || "").replace(/^models\//, ""),
          object: "model",
          created: 0,
          owned_by: "gemini-web2api",
        })),
      });
    } catch (err) {
      res.json({ object: "list", data: [] });
    }
  });

  // Chat completions
  router.post("/v1/chat/completions", (req, res) => {
    return requestHandler.handleOpenAIChatCompletion(req, res);
  });

  return router;
}

module.exports = { createOpenAIRoutes };
