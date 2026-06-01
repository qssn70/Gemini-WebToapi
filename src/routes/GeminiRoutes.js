/**
 * GeminiRoutes - Gemini API compatible routes.
 * Mounted at /v1beta, so routes here are relative to that prefix.
 */

const express = require("express");

function createGeminiRoutes({ requestHandler, modelRegistry }) {
  const router = express.Router();

  // List models
  router.get("/models", (req, res) => {
    res.json(modelRegistry.listGeminiModels());
  });

  // generateContent with slash-style: /models/:model/generateContent
  router.post("/models/:model/generateContent", (req, res) => {
    return requestHandler.handleGeminiGenerate(req, res);
  });

  // generateContent with colon-style: /models/gemini-3.1-flash-lite:generateContent
  // The :modelAction param captures "gemini-3.1-flash-lite:generateContent"
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
