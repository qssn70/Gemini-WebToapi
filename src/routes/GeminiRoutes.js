/**
 * GeminiRoutes - Gemini API compatible routes.
 * Mounted at /v1beta, so routes here are relative to that prefix.
 */

const express = require("express");

function createGeminiRoutes({ requestHandler, modelFetcher, browserPool }) {
  const router = express.Router();

  // List models
  router.get("/models", async (req, res) => {
    try {
      // Try to get browser context for dynamic fetch
      let context = null;
      try {
        const session = await browserPool.getCurrentSession();
        context = session.context;
      } catch {}

      const models = await modelFetcher.getModels(context);
      res.json({ models });
    } catch (err) {
      res.json({ models: [] });
    }
  });

  // generateContent with slash-style: /models/:model/generateContent
  router.post("/models/:model/generateContent", (req, res) => {
    return requestHandler.handleGeminiGenerate(req, res);
  });

  // generateContent with colon-style: /models/gemini-web:generateContent
  router.post("/models/:modelAction", (req, res) => {
    const modelAction = req.params.modelAction;
    if (modelAction && modelAction.endsWith(":generateContent")) {
      const model = modelAction.replace(":generateContent", "");
      req.params.model = model;
      return requestHandler.handleGeminiGenerate(req, res);
    }
    res.status(404).json({
      error: {
        code: 404,
        message: `Unknown action: ${modelAction}`,
        status: "NOT_FOUND",
      },
    });
  });

  return router;
}

module.exports = { createGeminiRoutes };
