async function apiRequest(path, options = {}) {
  const response = await fetch(path, options);
  return response.json();
}

window.WebUi = { apiRequest };
