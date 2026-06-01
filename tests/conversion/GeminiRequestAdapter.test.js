const { adaptGeminiRequest } = require("../../src/conversion/GeminiRequestAdapter");

describe("GeminiRequestAdapter", () => {
  test("single user message", () => {
    const body = {
      contents: [{ role: "user", parts: [{ text: "Hello" }] }],
    };
    const result = adaptGeminiRequest(body, "req-1", "gemini-web");
    expect(result.prompt).toContain("[User]");
    expect(result.prompt).toContain("Hello");
    expect(result.sourceApi).toBe("gemini");
    expect(result.requestId).toBe("req-1");
  });

  test("multi-turn conversation", () => {
    const body = {
      contents: [
        { role: "user", parts: [{ text: "Hi" }] },
        { role: "model", parts: [{ text: "Hello!" }] },
        { role: "user", parts: [{ text: "Continue" }] },
      ],
    };
    const result = adaptGeminiRequest(body, "req-2", "gemini-web");
    expect(result.prompt).toContain("[User]");
    expect(result.prompt).toContain("[Assistant]");
    expect(result.prompt).toContain("Hi");
    expect(result.prompt).toContain("Hello!");
    expect(result.prompt).toContain("Continue");
  });

  test("system instruction extracted", () => {
    const body = {
      contents: [{ role: "user", parts: [{ text: "Test" }] }],
      systemInstruction: { parts: [{ text: "Be concise." }] },
    };
    const result = adaptGeminiRequest(body, "req-3", "gemini-web");
    expect(result.systemInstruction).toBe("Be concise.");
  });

  test("no text content: throws ValidationError", () => {
    const body = {
      contents: [{ role: "user", parts: [{ inlineData: { mimeType: "image/png" } }] }],
    };
    expect(() => adaptGeminiRequest(body, "req-4", "gemini-web")).toThrow("No text content");
  });

  test("empty contents: throws ValidationError", () => {
    const body = { contents: [] };
    expect(() => adaptGeminiRequest(body, "req-5", "gemini-web")).toThrow("No text content");
  });

  test("generationConfig forwarded", () => {
    const body = {
      contents: [{ role: "user", parts: [{ text: "Test" }] }],
      generationConfig: { temperature: 0.5, maxOutputTokens: 1024 },
    };
    const result = adaptGeminiRequest(body, "req-6", "gemini-web");
    expect(result.generationConfig.temperature).toBe(0.5);
    expect(result.generationConfig.maxOutputTokens).toBe(1024);
  });
});
