/**
 * GeminiRoutes - Gemini API compatible routes.
 * Mounted at /v1beta, so routes here are relative to that prefix.
 */

const express = require("express");
const fs = require("fs");
const path = require("path");

function createGeminiRoutes({ requestHandler }) {
  const router = express.Router();

  // List models
  router.get("/models", (req, res) => {
    const modelsPath = path.join(__dirname, "../../configs/models.json");
    try {
      const data = JSON.parse(fs.readFileSync(modelsPath, "utf-8"));
      res.json(data);
    } catch (err) {
      res.json({
        models: [
          {
            name: "models/gemini-web",
            version: "web",
            displayName: "Gemini Web",
            description: "Gemini Web through browser automation",
            supportedGenerationMethods: ["generateContent"],
          },
        ],
      });
    }
  });

  // generateContent with slash-style: /models/:model/generateContent
  router.post("/models/:model/generateContent", (req, res) => {
    return requestHandler.handleGeminiGenerate(req, res);
  });

  // generateContent with colon-style: /models/gemini-web:generateContent
  // The :modelAction param captures "gemini-web:generateContent"
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
