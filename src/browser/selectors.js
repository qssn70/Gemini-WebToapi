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
  loginHints: ["text=Sign in", "text=登录", "text=Sign in to continue"],
  quotaHints: [
    "text=limit",
    "text=quota",
    "text=达到上限",
    "text=Too many requests",
  ],
  stopButton: ["button[aria-label*='Stop']", "button[aria-label*='停止']"],
  modelMenuButton: [
    "[data-test-id='bard-mode-menu-button']",
    "button[aria-label*='模式选择器']",
    "button[aria-label*='mode selector']",
    "button[aria-label*='model']",
    "button[aria-label*='Model']",
    "button[aria-label*='模型']",
    "button:has-text('Gemini')",
  ],
  thinkingMenuButton: [
    "button[aria-label*='thinking']",
    "button[aria-label*='Thinking']",
    "button[aria-label*='思考']",
    "button:has-text('Standard')",
    "button:has-text('Extended')",
    "button:has-text('标准')",
    "button:has-text('扩展')",
    "button:has-text('思考')",
  ],
};
