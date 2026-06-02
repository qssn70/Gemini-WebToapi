const fs = require("fs");
const path = require("path");

describe("Web UI static assets", () => {
  test("index.html references split stylesheet and script", () => {
    const html = fs.readFileSync(path.join(__dirname, "../../ui/index.html"), "utf-8");

    expect(html).toContain('href="/ui/styles.css"');
    expect(html).toContain('src="/ui/app.js"');
    expect(html).toContain('id="tab-dashboard"');
    expect(html).toContain('id="tab-accounts"');
    expect(html).toContain('id="tab-test"');
    expect(html).toContain('id="tab-logs"');
    expect(html).toContain('id="tab-config"');
  });

  test("app.js includes account status rendering and error handling hooks", () => {
    const js = fs.readFileSync(path.join(__dirname, "../../ui/app.js"), "utf-8");

    expect(js).toContain("function renderAccounts");
    expect(js).toContain("runtimeFailureReason");
    expect(js).toContain("function showError");
    expect(js).toContain("function setButtonLoading");
  });
});
