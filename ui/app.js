const API_BASE = "";
const REFRESH_INTERVAL_MS = 5000;

const state = {
  status: null,
  activeTab: "dashboard",
  userTouchedTestResult: false,
};

function byId(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatUptime(totalSeconds) {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  const parts = [];
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0 || hours > 0) {
    parts.push(`${minutes}m`);
  }
  parts.push(`${remainingSeconds}s`);
  return parts.join(" ");
}

function errorMessage(error, fallback = "请求失败") {
  if (!error) {
    return fallback;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error.message) {
    return error.message;
  }
  return fallback;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch (err) {
      data = text;
    }
  }

  if (!response.ok) {
    const message =
      (data && typeof data === "object" && data.error && data.error.message) ||
      `HTTP ${response.status}`;
    throw new Error(message);
  }

  return data;
}

function showError(message) {
  const box = byId("globalError");
  if (!box) {
    return;
  }
  box.textContent = errorMessage(message);
  box.hidden = false;
}

function hideError() {
  const box = byId("globalError");
  if (!box) {
    return;
  }
  box.textContent = "";
  box.hidden = true;
}

function showResult(element, message, isError = false) {
  if (!element) {
    return;
  }
  element.textContent = message;
  element.classList.add("show");
  element.classList.toggle("error", Boolean(isError));
}

function setButtonLoading(button, isLoading, loadingText) {
  if (!button) {
    return;
  }
  if (!button.dataset.originalText) {
    button.dataset.originalText = button.textContent || "";
  }
  button.disabled = Boolean(isLoading);
  button.textContent = isLoading ? loadingText || "处理中..." : button.dataset.originalText;
}

function setOnline(isOnline) {
  const badge = byId("statusBadge");
  if (!badge) {
    return;
  }
  badge.textContent = isOnline ? "ONLINE" : "OFFLINE";
  badge.classList.toggle("online", isOnline);
  badge.classList.toggle("offline", !isOnline);
}

function renderDashboard(status) {
  const accounts = status.accounts || {};
  const browser = status.browser || {};
  const currentAuthText = browser.currentAuthIndex === null || browser.currentAuthIndex === undefined
    ? "未选中"
    : `#${browser.currentAuthIndex}`;

  byId("uptimeText").textContent = formatUptime(status.uptime);
  byId("sUptime").textContent = formatUptime(status.uptime);
  byId("sBrowser").textContent = browser.started ? "在线" : "离线";
  byId("sCurrentAuth").textContent = currentAuthText;
  byId("sRotation").textContent = String(accounts.rotation ?? 0);
  byId("sTotal").textContent = String(accounts.total ?? 0);
  byId("sExpired").textContent = String(accounts.expired ?? 0);
  byId("sDuplicate").textContent = String(accounts.duplicate ?? 0);
  byId("sRuntimeFailed").textContent = String(accounts.runtimeFailed ?? 0);
}

function renderAccounts(accounts) {
  const table = byId("accountTable");
  const empty = byId("noAccounts");
  const details = Array.isArray(accounts?.details) ? accounts.details : [];

  if (details.length === 0) {
    table.innerHTML = "";
    empty.hidden = false;
    return;
  }

  empty.hidden = true;
  table.innerHTML = details
    .map((account) => {
      const tags = [];
      if (account.isHealthy) {
        tags.push('<span class="tag success">健康</span>');
      }
      if (account.isRotation) {
        tags.push('<span class="tag">轮换</span>');
      }
      if (account.isExpired) {
        tags.push('<span class="tag warn">过期</span>');
      }
      if (account.isDuplicate) {
        tags.push('<span class="tag warn">重复</span>');
      }
      if (account.runtimeFailed) {
        tags.push('<span class="tag danger">运行失败</span>');
      }

      return `<tr>
        <td>${account.index}</td>
        <td>${escapeHtml(account.name || "未命名账号")}</td>
        <td>${tags.join(" ") || '<span class="tag">未知</span>'}</td>
        <td>${account.isRotation ? "是" : "否"}</td>
        <td>${account.canonicalIndex ?? "-"}</td>
        <td>${escapeHtml(account.runtimeFailureReason || "-")}</td>
        <td><button type="button" data-auth-index="${account.index}">切换</button></td>
      </tr>`;
    })
    .join("");
}

function renderModelSelect(config) {
  const select = byId("testModel");
  const models = Array.isArray(config?.models) ? config.models : [];
  const defaultModel = config?.defaultModel || "";
  const selectedValue = select.value || defaultModel;

  select.innerHTML = models
    .map((model) => {
      const label = model.displayName || model.webModelLabel || model.id;
      const selected = model.id === selectedValue ? ' selected' : '';
      return `<option value="${escapeHtml(model.id)}"${selected}>${escapeHtml(label)}</option>`;
    })
    .join("");

  if (!select.value && defaultModel) {
    select.value = defaultModel;
  }
}

function renderConfig(config) {
  const table = byId("configTable");
  const entries = [
    ["maxRetries", config?.maxRetries],
    ["retryDelayMs", config?.retryDelayMs],
    ["requestTimeoutMs", config?.requestTimeoutMs],
    ["browserHeadless", config?.browserHeadless],
    ["maxContexts", config?.maxContexts],
    ["enableAuthUpdate", config?.enableAuthUpdate],
    ["geminiWebUrl", config?.geminiWebUrl],
    ["tempConversationMode", config?.tempConversationMode],
    ["enablePageDebug", config?.enablePageDebug],
    ["defaultModel", config?.defaultModel],
  ];

  table.innerHTML = entries
    .map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(value)}</td></tr>`)
    .join("");

  byId("debugStatus").textContent = config?.enablePageDebug
    ? "页面调试已启用，可捕获当前 Gemini 页面文件。"
    : "页面调试未启用，请设置 ENABLE_PAGE_DEBUG=true。";
  byId("debugPageBtn").disabled = !config?.enablePageDebug;
}

function refreshLogs(logs) {
  const logBox = byId("logBox");
  const items = Array.isArray(logs) ? logs : [];

  if (items.length === 0) {
    logBox.textContent = "暂无日志。";
    return;
  }

  logBox.textContent = items
    .map((entry) => `[${entry.timestamp || "-"}] ${entry.level || "INFO"} ${entry.message || ""}`)
    .join("\n");

  if (byId("autoScroll")?.checked) {
    logBox.scrollTop = logBox.scrollHeight;
  }
}

function clearLogDisplay() {
  byId("logBox").textContent = "日志显示已清空。";
}

async function refreshStatus(force = false) {
  if (!force && byId("pauseRefresh")?.checked) {
    return state.status;
  }

  try {
    const status = await apiRequest("/api/status");
    state.status = status;
    hideError();
    renderDashboard(status);
    renderAccounts(status.accounts);
    renderModelSelect(status.config);
    renderConfig(status.config);
    refreshLogs(status.logs);
    setOnline(Boolean(status.browser?.started));
    return status;
  } catch (err) {
    setOnline(false);
    showError(errorMessage(err));
    throw err;
  }
}

async function reloadAuth() {
  const button = byId("reloadAuthBtn");
  try {
    setButtonLoading(button, true, "加载中...");
    const result = await apiRequest("/api/auth/reload", { method: "POST" });
    showResult(
      byId("reloadResult"),
      `已重新加载 Auth。轮换 ${result?.rotationCount ?? 0}，总数 ${result?.totalCount ?? 0}`
    );
    await refreshStatus(true);
  } catch (err) {
    showResult(byId("reloadResult"), errorMessage(err), true);
    showError(err);
  } finally {
    setButtonLoading(button, false);
  }
}

async function switchAccount(authIndex) {
  try {
    const result = await apiRequest("/api/account/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authIndex: Number(authIndex) }),
    });
    showResult(byId("reloadResult"), `已切换到账号 #${result.currentAuthIndex}`);
    await refreshStatus(true);
    return result;
  } catch (err) {
    showError(err);
    throw err;
  }
}

function buildTestBody() {
  const body = {
    model: byId("testModel")?.value || state.status?.config?.defaultModel || "",
    prompt: byId("testPrompt")?.value || "",
    generationConfig: {
      temperature: Number(byId("testTemp")?.value || 0),
      maxOutputTokens: Number(byId("testMaxTokens")?.value || 0),
      thinkingLevel: byId("testThinkingLevel")?.value || "standard",
    },
  };

  const systemInstruction = byId("testSystem")?.value || "";
  if (systemInstruction) {
    body.systemInstruction = systemInstruction;
  }

  return body;
}

async function runTest() {
  const button = byId("testBtn");
  try {
    state.userTouchedTestResult = true;
    setButtonLoading(button, true, "发送中...");
    const result = await apiRequest("/api/test/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildTestBody()),
    });

    const text = result?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n")
      || JSON.stringify(result, null, 2);
    showResult(byId("testResult"), text);
    hideError();
    return result;
  } catch (err) {
    showResult(byId("testResult"), errorMessage(err), true);
    showError(err);
    throw err;
  } finally {
    setButtonLoading(button, false);
  }
}

async function captureDebugPage() {
  const button = byId("debugPageBtn");
  try {
    setButtonLoading(button, true, "捕获中...");
    const result = await apiRequest("/api/debug/page", { method: "POST" });
    showResult(
      byId("debugResult"),
      `HTML: ${result.htmlPath}\n截图: ${result.screenshotPath}\nURL: ${result.url}`
    );
    return result;
  } catch (err) {
    showResult(byId("debugResult"), errorMessage(err), true);
    showError(err);
    throw err;
  } finally {
    setButtonLoading(button, false);
  }
}

function switchTab(tabName) {
  state.activeTab = tabName;
  document.querySelectorAll(".tab").forEach((button) => {
    const isActive = button.dataset.tab === tabName;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  document.querySelectorAll(".tab-content").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `tab-${tabName}`);
  });
}

function bindEvents() {
  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.tab));
  });

  byId("reloadAuthBtn")?.addEventListener("click", () => {
    reloadAuth().catch(() => {});
  });
  byId("refreshStatusBtn")?.addEventListener("click", () => {
    refreshStatus(true).catch(() => {});
  });
  byId("testBtn")?.addEventListener("click", () => {
    runTest().catch(() => {});
  });
  byId("refreshLogsBtn")?.addEventListener("click", () => {
    refreshStatus(true).catch(() => {});
  });
  byId("clearLogsBtn")?.addEventListener("click", clearLogDisplay);
  byId("debugPageBtn")?.addEventListener("click", () => {
    captureDebugPage().catch(() => {});
  });

  document.body.addEventListener("click", (event) => {
    const button = event.target?.closest?.("[data-auth-index]");
    if (!button) {
      return;
    }
    switchAccount(button.dataset.authIndex).catch(() => {});
  });

  byId("testPrompt")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      runTest().catch(() => {});
    }
  });
}

function init() {
  bindEvents();
  switchTab(state.activeTab);
  refreshStatus(true).catch(() => {});
  setInterval(() => {
    refreshStatus().catch(() => {});
  }, REFRESH_INTERVAL_MS);
}

document.addEventListener("DOMContentLoaded", () => {
  init();
});

window.WebUi = {
  API_BASE,
  state,
  apiRequest,
  refreshStatus,
  renderAccounts,
  showError,
  hideError,
  setButtonLoading,
  renderDashboard,
  renderModelSelect,
  renderConfig,
  reloadAuth,
  switchAccount,
  buildTestBody,
  runTest,
  refreshLogs,
  clearLogDisplay,
  captureDebugPage,
  switchTab,
  bindEvents,
  init,
};
