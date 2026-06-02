const {
  adaptOpenAIRequest,
} = require("../../src/conversion/OpenAIRequestAdapter");

describe("OpenAIRequestAdapter", () => {
  test("single user message", () => {
    const body = {
      model: "gemini-3.1-flash-lite",
      messages: [{ role: "user", content: "Hello" }],
    };
    const result = adaptOpenAIRequest(body, "req-1");
    expect(result.prompt).toContain("[User]");
    expect(result.prompt).toContain("Hello");
    expect(result.sourceApi).toBe("openai");
  });

  test("system + user messages", () => {
    const body = {
      model: "gemini-3.1-flash-lite",
      messages: [
        { role: "system", content: "Be concise." },
        { role: "user", content: "Hello" },
      ],
    };
    const result = adaptOpenAIRequest(body, "req-2");
    expect(result.systemInstruction).toBe("Be concise.");
    expect(result.prompt).toContain("[User]");
    expect(result.prompt).toContain("Hello");
  });

  test("assistant message included in prompt", () => {
    const body = {
      model: "gemini-3.1-flash-lite",
      messages: [
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Hello!" },
        { role: "user", content: "Continue" },
      ],
    };
    const result = adaptOpenAIRequest(body, "req-3");
    expect(result.prompt).toContain("[User]");
    expect(result.prompt).toContain("[Assistant]");
    expect(result.prompt).toContain("Hello!");
  });

  test("array content extracts text parts", () => {
    const body = {
      model: "gemini-3.1-flash-lite",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Part 1" },
            { type: "text", text: "Part 2" },
            {
              type: "image_url",
              image_url: { url: "http://example.com/img.png" },
            },
          ],
        },
      ],
    };
    const result = adaptOpenAIRequest(body, "req-4");
    expect(result.prompt).toContain("Part 1");
    expect(result.prompt).toContain("Part 2");
  });

  test("no text content: throws ValidationError", () => {
    const body = {
      model: "gemini-3.1-flash-lite",
      messages: [
        {
          role: "user",
          content: [{ type: "image_url", image_url: { url: "x" } }],
        },
      ],
    };
    expect(() => adaptOpenAIRequest(body, "req-5")).toThrow("No text content");
  });

  test("thinking_level forwarded", () => {
    const body = {
      model: "gemini-3.1-pro-preview",
      messages: [{ role: "user", content: "Test" }],
      thinking_level: "standard",
    };
    const result = adaptOpenAIRequest(body, "req-7");
    expect(result.generationConfig.thinkingLevel).toBe("standard");
  });

  test("defaults thinkingLevel to extended", () => {
    const body = {
      model: "gemini-3.1-pro-preview",
      messages: [{ role: "user", content: "Test" }],
    };
    const result = adaptOpenAIRequest(body, "req-default-thinking");
    expect(result.generationConfig.thinkingLevel).toBe("extended");
  });

  test("preserves explicit standard thinkingLevel", () => {
    const body = {
      model: "gemini-3.1-pro-preview",
      messages: [{ role: "user", content: "Test" }],
      thinking_level: "standard",
    };
    const result = adaptOpenAIRequest(body, "req-standard-thinking");
    expect(result.generationConfig.thinkingLevel).toBe("standard");
  });
});
