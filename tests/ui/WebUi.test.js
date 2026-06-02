const fs = require("fs");
const path = require("path");

describe("Web UI account status", () => {
  test("renders runtime failed accounts as login failed instead of normal", () => {
    const html = fs.readFileSync(path.join(__dirname, "../../ui/index.html"), "utf-8");

    expect(html).toContain("a.runtimeFailed");
    expect(html).toContain("登录失败");
    expect(html).toContain("runtimeFailureReason");
    expect(html).toContain("a.isHealthy");
    expect(html).toContain('id="sExpired"');
    expect(html).toContain('id="sRuntimeFailed"');
  });
});
