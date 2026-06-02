async function apiRequest(path, options = {}) {
  const response = await fetch(path, options);
  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch (err) {
      throw new Error(`响应不是 JSON：HTTP ${response.status}`);
    }
  }

  if (!response.ok) {
    const message = data?.error?.message || `HTTP ${response.status}`;
    throw new Error(message);
  }

  return data;
}

function renderAccounts(statusData) {
  return statusData?.accounts?.details?.map((account) => account.runtimeFailureReason || "");
}

function showError(element, message) {
  if (element) {
    element.textContent = message;
  }
}

function setButtonLoading(button, isLoading) {
  if (button) {
    button.disabled = isLoading;
  }
}

window.WebUi = { apiRequest, renderAccounts, showError, setButtonLoading };
