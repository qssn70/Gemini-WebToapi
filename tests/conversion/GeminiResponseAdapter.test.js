const { adaptGeminiResponse } = require("../../src/conversion/GeminiResponseAdapter");

describe("GeminiResponseAdapter", () => {
  test("basic response", () => {
    const result = adaptGeminiResponse({
      text: "Hello!",
      finishReason: "STOP",
      model: "gemini-3.1-flash-lite",
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].content.role).toBe("model");
    expect(result.candidates[0].content.parts[0].text).toBe("Hello!");
    expect(result.candidates[0].finishReason).toBe("STOP");
    expect(result.candidates[0].index).toBe(0);
    expect(result.modelVersion).toBe("gemini-3.1-flash-lite");
  });

  test("usage metadata is zeroed", () => {
    const result = adaptGeminiResponse({
      text: "Test",
      finishReason: "STOP",
      model: "gemini-3.1-flash-lite",
    });

    expect(result.usageMetadata.promptTokenCount).toBe(0);
    expect(result.usageMetadata.candidatesTokenCount).toBe(0);
    expect(result.usageMetadata.totalTokenCount).toBe(0);
  });

  test("missing finishReason defaults to STOP", () => {
    const result = adaptGeminiResponse({
      text: "Test",
      model: "gemini-3.1-flash-lite",
    });

    expect(result.candidates[0].finishReason).toBe("STOP");
  });
});
