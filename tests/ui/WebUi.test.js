const fs = require("fs");
const path = require("path");
const vm = require("vm");

function createMockResponse({ ok = true, status = 200, body = "", statusText = "OK" } = {}) {
  return {
    ok,
    status,
    statusText,
    text: jest.fn().mockResolvedValue(body),
  };
}

function createDomEnvironment() {
  const elementsById = new Map();
  const tabButtons = [];
  const tabPanels = [];
  const accountSwitchButtons = [];

  function createClassList(initial = []) {
    const classes = new Set(initial);
    return {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      toggle: (name, force) => {
        if (force === undefined) {
          if (classes.has(name)) {
            classes.delete(name);
            return false;
          }
          classes.add(name);
          return true;
        }
        if (force) {
          classes.add(name);
          return true;
        }
        classes.delete(name);
        return false;
      },
      contains: (name) => classes.has(name),
    };
  }

  function createElement(id, options = {}) {
    const element = {
      id,
      hidden: false,
      disabled: false,
      value: options.value || "",
      checked: options.checked || false,
      textContent: options.textContent || "",
      innerHTML: options.innerHTML || "",
      dataset: { ...(options.dataset || {}) },
      attributes: new Map(),
      classList: createClassList(options.classes || []),
      listeners: {},
      style: {},
      scrollTop: 0,
      scrollHeight: options.scrollHeight || 0,
      clientHeight: options.clientHeight || 0,
      addEventListener(type, handler) {
        this.listeners[type] = this.listeners[type] || [];
        this.listeners[type].push(handler);
      },
      dispatchEvent(event) {
        const handlers = this.listeners[event.type] || [];
        handlers.forEach((handler) => handler(event));
      },
      setAttribute(name, value) {
        this.attributes.set(name, String(value));
      },
      getAttribute(name) {
        return this.attributes.has(name) ? this.attributes.get(name) : null;
      },
      closest(selector) {
        if (selector === "[data-auth-index]" && this.dataset.authIndex !== undefined) {
          return this;
        }
        return null;
      },
      focus: jest.fn(),
    };

    if (id) {
      elementsById.set(id, element);
    }
    return element;
  }

  [
    ["statusBadge", { classes: ["badge", "offline"], textContent: "OFFLINE" }],
    ["uptimeText"],
    ["globalError", { hidden: true }],
    ["sUptime"],
    ["sBrowser"],
    ["sCurrentAuth"],
    ["sRotation"],
    ["sTotal"],
    ["sExpired"],
    ["sDuplicate"],
    ["sRuntimeFailed"],
    ["reloadAuthBtn"],
    ["refreshStatusBtn"],
    ["reloadResult"],
    ["accountTable"],
    ["noAccounts", { hidden: true }],
    ["testModel"],
    ["testPrompt", { value: "Default prompt" }],
    ["testSystem"],
    ["testThinkingLevel", { value: "standard" }],
    ["testTemp", { value: "0.7" }],
    ["testMaxTokens", { value: "2048" }],
    ["testBtn"],
    ["testResult"],
    ["refreshLogsBtn"],
    ["clearLogsBtn"],
    ["pauseRefresh", { checked: false }],
    ["autoScroll", { checked: true }],
    ["logBox", { textContent: "等待加载...", scrollHeight: 300, clientHeight: 120 }],
    ["configTable"],
    ["debugStatus", { textContent: "等待状态加载..." }],
    ["debugPageBtn"],
    ["debugResult"],
  ].forEach(([id, options]) => createElement(id, options));

  ["dashboard", "accounts", "test", "logs", "config"].forEach((name, index) => {
    const button = createElement(`tab-button-${name}`, {
      classes: index === 0 ? ["tab", "active"] : ["tab"],
      dataset: { tab: name },
    });
    button.setAttribute("aria-selected", index === 0 ? "true" : "false");
    tabButtons.push(button);

    const panel = createElement(`tab-${name}`, {
      classes: index === 0 ? ["tab-content", "active"] : ["tab-content"],
    });
    tabPanels.push(panel);
  });

  const document = {
    body: createElement(null),
    getElementById(id) {
      return elementsById.get(id) || null;
    },
    querySelectorAll(selector) {
      if (selector === ".tab") {
        return tabButtons;
      }
      if (selector === ".tab-content") {
        return tabPanels;
      }
      if (selector === "[data-auth-index]") {
        return accountSwitchButtons;
      }
      return [];
    },
    addEventListener: jest.fn(),
  };

  document.body.addEventListener = function addEventListener(type, handler) {
    this.listeners = this.listeners || {};
    this.listeners[type] = this.listeners[type] || [];
    this.listeners[type].push(handler);
  };

  return {
    document,
    elementsById,
    accountSwitchButtons,
    createAccountSwitchButton(index) {
      const button = createElement(`account-switch-${index}`, { dataset: { authIndex: String(index) } });
      accountSwitchButtons.push(button);
      return button;
    },
  };
}

function loadWebUi({ fetchImpl, intervalImpl } = {}) {
  const source = fs.readFileSync(path.join(__dirname, "../../ui/app.js"), "utf-8");
  const dom = createDomEnvironment();
  const context = {
    console,
    document: dom.document,
    fetch: fetchImpl || jest.fn(),
    setInterval: intervalImpl || jest.fn(() => 1),
    clearInterval: jest.fn(),
    window: {},
    navigator: { platform: "MacIntel" },
  };
  context.window = context;
  context.globalThis = context;

  vm.runInNewContext(source, context, { filename: "ui/app.js" });

  return { WebUi: context.WebUi, context, ...dom };
}

describe("Web UI client", () => {
  test("apiRequest returns plain text when response is not JSON", async () => {
    const fetch = jest.fn().mockResolvedValue(
      createMockResponse({ status: 200, body: "plain text body" })
    );
    const { WebUi } = loadWebUi({ fetchImpl: fetch });

    await expect(WebUi.apiRequest("/api/logs")).resolves.toBe("plain text body");
  });

  test("apiRequest uses nested API error message for failed responses", async () => {
    const fetch = jest.fn().mockResolvedValue(
      createMockResponse({
        ok: false,
        status: 400,
        body: JSON.stringify({ error: { message: "Cannot switch account" } }),
        statusText: "Bad Request",
      })
    );
    const { WebUi } = loadWebUi({ fetchImpl: fetch });

    await expect(WebUi.apiRequest("/api/account/switch", { method: "POST" })).rejects.toThrow(
      "Cannot switch account"
    );
  });

  test("refreshStatus renders dashboard, accounts, logs, config, and model select", async () => {
    const statusPayload = {
      uptime: 3665,
      browser: { started: true, currentAuthIndex: 3 },
      accounts: {
        total: 3,
        rotation: 2,
        expired: 1,
        duplicate: 1,
        runtimeFailed: 1,
        details: [
          {
            index: 0,
            name: "alpha@example.com",
            isDuplicate: true,
            isExpired: false,
            isRotation: true,
            runtimeFailed: true,
            runtimeFailureReason: "Needs login",
            runtimeFailedAt: "2026-06-01T16:30:07.191Z",
            isHealthy: false,
            canonicalIndex: 0,
          },
          {
            index: 3,
            name: "beta@example.com",
            isDuplicate: false,
            isExpired: false,
            isRotation: true,
            runtimeFailed: false,
            runtimeFailureReason: null,
            runtimeFailedAt: null,
            isHealthy: true,
            canonicalIndex: 3,
          },
        ],
      },
      config: {
        maxRetries: 2,
        retryDelayMs: 1500,
        requestTimeoutMs: 120000,
        browserHeadless: true,
        maxContexts: 1,
        enableAuthUpdate: false,
        geminiWebUrl: "https://gemini.google.com/app",
        tempConversationMode: true,
        enablePageDebug: true,
        defaultModel: "gemini-2.5-pro",
        models: [
          { id: "gemini-2.5-pro", displayName: "Gemini 2.5 Pro", webModelLabel: "2.5 Pro" },
          { id: "gemini-2.5-flash", displayName: "Gemini 2.5 Flash", webModelLabel: "2.5 Flash" },
        ],
      },
      logs: [
        { timestamp: "2026-06-02T10:00:00.000Z", level: "INFO", message: "Started" },
        { timestamp: "2026-06-02T10:01:00.000Z", level: "WARN", message: "Slow request" },
      ],
    };
    const fetch = jest.fn().mockResolvedValue(
      createMockResponse({ body: JSON.stringify(statusPayload) })
    );
    const { WebUi, elementsById } = loadWebUi({ fetchImpl: fetch });

    await WebUi.refreshStatus(true);

    expect(elementsById.get("sUptime").textContent).toBe("1h 1m 5s");
    expect(elementsById.get("sBrowser").textContent).toBe("在线");
    expect(elementsById.get("sCurrentAuth").textContent).toContain("#3");
    expect(elementsById.get("sRotation").textContent).toBe("2");
    expect(elementsById.get("sDuplicate").textContent).toBe("1");
    expect(elementsById.get("sRuntimeFailed").textContent).toBe("1");
    expect(elementsById.get("accountTable").innerHTML).toContain("Needs login");
    expect(elementsById.get("accountTable").innerHTML).toContain('data-auth-index="3"');
    expect(elementsById.get("testModel").innerHTML).toContain("gemini-2.5-pro");
    expect(elementsById.get("configTable").innerHTML).toContain("enablePageDebug");
    expect(elementsById.get("debugStatus").textContent).toContain("已启用");
    expect(elementsById.get("debugPageBtn").disabled).toBe(false);
    expect(elementsById.get("logBox").textContent).toContain("Started");
    expect(elementsById.get("statusBadge").textContent).toBe("ONLINE");
  });

  test("refreshStatus honors pauseRefresh unless forced", async () => {
    const fetch = jest.fn();
    const { WebUi, elementsById } = loadWebUi({ fetchImpl: fetch });
    elementsById.get("pauseRefresh").checked = true;

    await WebUi.refreshStatus();

    expect(fetch).not.toHaveBeenCalled();
  });

  test("renderAccounts shows empty state and runtime failure tags", () => {
    const { WebUi, elementsById } = loadWebUi();

    WebUi.renderAccounts({ total: 0, details: [] });
    expect(elementsById.get("noAccounts").hidden).toBe(false);

    WebUi.renderAccounts({
      total: 2,
      details: [
        {
          index: 7,
          name: "gamma@example.com",
          isHealthy: false,
          isRotation: false,
          isExpired: true,
          isDuplicate: true,
          runtimeFailed: true,
          runtimeFailureReason: "Page redirected to login",
          canonicalIndex: 2,
        },
      ],
    });

    expect(elementsById.get("noAccounts").hidden).toBe(true);
    expect(elementsById.get("accountTable").innerHTML).toContain("运行失败");
    expect(elementsById.get("accountTable").innerHTML).toContain("Page redirected to login");
    expect(elementsById.get("accountTable").innerHTML).toContain('data-auth-index="7"');
  });

  test("runTest builds request body and renders result", async () => {
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(
        createMockResponse({
          body: JSON.stringify({
            candidates: [
              { content: { parts: [{ text: "Hello from Gemini" }] } },
            ],
          }),
        })
      );
    const { WebUi, elementsById } = loadWebUi({ fetchImpl: fetch });
    elementsById.get("testModel").value = "gemini-2.5-flash";
    elementsById.get("testPrompt").value = "Say hello";
    elementsById.get("testSystem").value = "Be polite";
    elementsById.get("testThinkingLevel").value = "extended";
    elementsById.get("testTemp").value = "0.2";
    elementsById.get("testMaxTokens").value = "512";

    await WebUi.runTest();

    expect(fetch).toHaveBeenCalledWith(
      "/api/test/generate",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );
    const requestBody = JSON.parse(fetch.mock.calls[0][1].body);
    expect(requestBody).toEqual({
      model: "gemini-2.5-flash",
      prompt: "Say hello",
      systemInstruction: "Be polite",
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 512,
        thinkingLevel: "extended",
      },
    });
    expect(elementsById.get("testResult").textContent).toContain("Hello from Gemini");
    expect(elementsById.get("testBtn").disabled).toBe(false);
  });

  test("captureDebugPage shows returned artifact paths", async () => {
    const fetch = jest.fn().mockResolvedValue(
      createMockResponse({
        body: JSON.stringify({
          ok: true,
          htmlPath: "/tmp/debug/page.html",
          screenshotPath: "/tmp/debug/page.png",
          url: "https://gemini.google.com/app",
        }),
      })
    );
    const { WebUi, elementsById } = loadWebUi({ fetchImpl: fetch });

    await WebUi.captureDebugPage();

    expect(fetch).toHaveBeenCalledWith("/api/debug/page", expect.objectContaining({ method: "POST" }));
    expect(elementsById.get("debugResult").textContent).toContain("page.html");
    expect(elementsById.get("debugResult").textContent).toContain("page.png");
  });

  test("switchTab updates active classes and aria-selected states", () => {
    const { WebUi, elementsById } = loadWebUi();

    WebUi.switchTab("logs");

    expect(elementsById.get("tab-button-logs").classList.contains("active")).toBe(true);
    expect(elementsById.get("tab-button-logs").getAttribute("aria-selected")).toBe("true");
    expect(elementsById.get("tab-button-dashboard").classList.contains("active")).toBe(false);
    expect(elementsById.get("tab-dashboard").classList.contains("active")).toBe(false);
    expect(elementsById.get("tab-logs").classList.contains("active")).toBe(true);
  });

  test("bindEvents wires keyboard shortcut and account switch delegation", async () => {
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(
        createMockResponse({
          body: JSON.stringify({ candidates: [{ content: { parts: [{ text: "Shortcut" }] } }] }),
        })
      )
      .mockResolvedValueOnce(
        createMockResponse({ body: JSON.stringify({ ok: true, currentAuthIndex: 9 }) })
      );
    const { WebUi, elementsById, document, createAccountSwitchButton } = loadWebUi({ fetchImpl: fetch });
    const accountButton = createAccountSwitchButton(9);

    WebUi.bindEvents();

    const keydownHandler = elementsById.get("testPrompt").listeners.keydown[0];
    await keydownHandler({ type: "keydown", key: "Enter", metaKey: true, ctrlKey: false, preventDefault: jest.fn() });

    expect(fetch.mock.calls[0][0]).toBe("/api/test/generate");

    const clickHandler = document.body.listeners.click[0];
    await clickHandler({ type: "click", target: accountButton });

    expect(fetch.mock.calls[1][0]).toBe("/api/account/switch");
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ authIndex: 9 });
  });

  test("init registers DOMContentLoaded handler and refresh interval", async () => {
    const fetch = jest.fn().mockResolvedValue(
      createMockResponse({
        body: JSON.stringify({
          uptime: 1,
          accounts: { total: 0, details: [] },
          browser: { started: false, currentAuthIndex: null },
          config: { models: [], enablePageDebug: false },
          logs: [],
        }),
      })
    );
    const setInterval = jest.fn(() => 123);
    const { WebUi, context } = loadWebUi({ fetchImpl: fetch, intervalImpl: setInterval });

    expect(context.document.addEventListener).toHaveBeenCalledWith("DOMContentLoaded", expect.any(Function));

    const domReadyHandler = context.document.addEventListener.mock.calls[0][1];
    await domReadyHandler();

    expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 5000);
    expect(fetch).toHaveBeenCalled();
    expect(WebUi.state.activeTab).toBe("dashboard");
  });
});
