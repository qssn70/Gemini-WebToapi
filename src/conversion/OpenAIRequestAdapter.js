/**
 * OpenAIRequestAdapter - converts an OpenAI chat completion request
 * into the internal standard request format.
 */

const { ValidationError } = require("../utils/Errors");

/**
 * Convert an OpenAI chat completion request body into the internal format.
 *
 * @param {object} body - The raw request body from the OpenAI endpoint.
 * @param {string} requestId - A unique request identifier.
 * @returns {object} Internal standard request.
 */
function adaptOpenAIRequest(body, requestId) {
  const messages = body.messages || [];
  const model = body.model || null;

  const systemParts = [];
  const promptParts = [];

  for (const msg of messages) {
    const role = msg.role || "user";
    const text = extractContentText(msg.content);

    if (role === "system") {
      if (text) systemParts.push(text);
    } else if (role === "user") {
      if (text) promptParts.push(`[User]\n${text}`);
    } else if (role === "assistant") {
      if (text) promptParts.push(`[Assistant]\n${text}`);
    }
    // Other roles are ignored
  }

  if (promptParts.length === 0 && systemParts.length === 0) {
    throw new ValidationError("No text content found in request.");
  }

  // If only system instruction and no user message, use system as prompt
  const prompt =
    promptParts.length > 0 ? promptParts.join("\n\n") : systemParts.join("\n");
  const systemInstruction =
    promptParts.length > 0 ? systemParts.join("\n") : "";

  return {
    requestId,
    sourceApi: "openai",
    model,
    prompt,
    systemInstruction,
    generationConfig: {
      temperature: body.temperature ?? null,
      maxOutputTokens: body.max_tokens ?? null,
      thinkingLevel: normalizeThinkingLevel(
        body.thinking_level ?? body.thinkingLevel ?? body.reasoning_effort,
      ),
    },
    metadata: {
      originalModel: body.model || null,
    },
  };
}

/**
 * Extract text from message content.
 * content can be a string or an array of content parts.
 */
function extractContentText(content) {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    const texts = [];
    for (const part of content) {
      if (part.type === "text" && typeof part.text === "string") {
        texts.push(part.text);
      }
      // Other content types (image_url, etc.) are ignored
    }
    return texts.join("\n");
  }
  return "";
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

module.exports = { adaptOpenAIRequest };
