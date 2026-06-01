/**
 * GeminiResponseAdapter - converts an internal response
 * into the Gemini generateContent response format.
 */

/**
 * Build a Gemini generateContent response from the internal response.
 *
 * @param {object} result - Internal result { text, finishReason, model }.
 * @returns {object} Gemini API response structure.
 */
function adaptGeminiResponse(result) {
  return {
    candidates: [
      {
        content: {
          role: "model",
          parts: [{ text: result.text }],
        },
        finishReason: result.finishReason || "STOP",
        index: 0,
      },
    ],
    usageMetadata: {
      promptTokenCount: 0,
      candidatesTokenCount: 0,
      totalTokenCount: 0,
    },
    modelVersion: result.model || "gemini-3.1-flash-lite",
  };
}

module.exports = { adaptGeminiResponse };
