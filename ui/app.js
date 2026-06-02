async function apiRequest(path, options = {}) {
  const response = await fetch(path, options);
  return response.json();
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
