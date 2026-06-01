/**
 * OpenAIResponseAdapter - converts an internal response
 * into the OpenAI chat completion response format.
 */

/**
 * Build an OpenAI chat completion response from the internal response.
 *
 * @param {object} result - Internal result { text, finishReason, model, requestId }.
 * @returns {object} OpenAI chat completion response structure.
 */
function adaptOpenAIResponse(result) {
  // Map finishReason
  let finishReason = "stop";
  if (result.finishReason && result.finishReason !== "STOP") {
    // Unknown finish reason, default to stop
    finishReason = "stop";
  }

  return {
    id: `chatcmpl-${result.requestId || "unknown"}`,
    object: "chat.completion",
    created: 0,
    model: result.model || "gemini-3.1-flash-lite",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: result.text,
        },
        finish_reason: finishReason,
      },
    ],
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    },
  };
}

module.exports = { adaptOpenAIResponse };
