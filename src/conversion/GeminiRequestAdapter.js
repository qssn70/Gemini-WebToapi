/**
 * GeminiRequestAdapter - converts a Gemini generateContent request
 * into the internal standard request format.
 */

const { ValidationError } = require("../utils/Errors");

/**
 * Convert a Gemini API generateContent request body into the internal format.
 *
 * @param {object} body - The raw request body from the Gemini API endpoint.
 * @param {string} requestId - A unique request identifier.
 * @param {string} model - The resolved model name.
 * @returns {object} Internal standard request.
 */
function adaptGeminiRequest(body, requestId, model) {
  const contents = body.contents || [];
  const systemInstruction = body.systemInstruction || null;
  const generationConfig = body.generationConfig || {};

  // Build prompt from contents
  const promptParts = [];
  for (const content of contents) {
    const role = content.role || "user";
    const prefix = role === "model" ? "[Assistant]" : "[User]";
    const textParts = extractTextParts(content.parts || []);
    if (textParts.length > 0) {
      promptParts.push(`${prefix}\n${textParts.join("\n")}`);
    }
  }

  if (promptParts.length === 0) {
    throw new ValidationError("No text content found in request.");
  }

  const prompt = promptParts.join("\n\n");

  // Build system instruction
  let systemText = "";
  if (systemInstruction && Array.isArray(systemInstruction.parts)) {
    const siParts = extractTextParts(systemInstruction.parts);
    if (siParts.length > 0) {
      systemText = siParts.join("\n");
    }
  }

  // Log ignored fields at debug level
  const ignoredFields = [
    "tools",
    "toolConfig",
    "safetySettings",
    "cachedContent",
    "generationConfig.responseMimeType",
    "generationConfig.responseSchema",
  ];
  for (const field of ignoredFields) {
    const parts = field.split(".");
    let val = body;
    for (const p of parts) {
      val = val ? val[p] : undefined;
    }
    if (val !== undefined) {
      // This is a debug-level log; the caller (logger) can handle it
    }
  }

  return {
    requestId,
    sourceApi: "gemini",
    model,
    prompt,
    systemInstruction: systemText,
    generationConfig: {
      temperature: generationConfig.temperature ?? null,
      maxOutputTokens: generationConfig.maxOutputTokens ?? null,
      thinkingLevel: normalizeThinkingLevel(
        generationConfig.thinkingLevel ??
          generationConfig.thinking_level ??
          body.thinkingLevel ??
          body.thinking_level,
      ),
    },
    metadata: {
      originalModel: model,
    },
  };
}

/**
 * Extract text from an array of parts.
 * Ignores non-text parts silently.
 */
function extractTextParts(parts) {
  const texts = [];
  for (const part of parts) {
    if (typeof part.text === "string" && part.text.length > 0) {
      texts.push(part.text);
    }
  }
  return texts;
}

/**
 * Normalize Gemini Web thinking level names.
 */
function normalizeThinkingLevel(value) {
  if (value === undefined || value === null || value === "") return "extended";
  const normalized = String(value).trim().toLowerCase();
  if (["standard", "标准", "normal", "medium"].includes(normalized))
    return "standard";
  if (["extended", "扩展", "advanced", "deep", "high"].includes(normalized))
    return "extended";
  return null;
}

module.exports = { adaptGeminiRequest };
