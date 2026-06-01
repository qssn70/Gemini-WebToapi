/**
 * Centralized Gemini Web page selectors.
 * All DOM selectors must be defined here and nowhere else.
 */

module.exports = {
  input: [
    "div[contenteditable='true']",
    "rich-textarea div[contenteditable='true']",
    "textarea",
  ],
  sendButton: [
    "button[aria-label*='Send']",
    "button[aria-label*='发送']",
    "button[aria-label*='send']",
  ],
  responseCandidates: [
    "message-content",
    "div.markdown",
    "[data-response-index]",
    ".response-container",
  ],
  loginHints: [
    "text=Sign in",
    "text=登录",
    "text=Sign in to continue",
  ],
  quotaHints: [
    "text=limit",
    "text=quota",
    "text=达到上限",
    "text=Too many requests",
  ],
  stopButton: [
    "button[aria-label*='Stop']",
    "button[aria-label*='停止']",
  ],
};
