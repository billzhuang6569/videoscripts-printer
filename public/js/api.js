const JSON_HEADERS = Object.freeze({ "content-type": "application/json" });

async function readJsonResponse(response) {
  const body = await response.json().catch(() => ({}));
  if (response.ok) return body;

  const errors = Array.isArray(body.errors) ? body.errors : ["请求失败"];
  const error = new Error(errors.join("\n"));
  error.status = response.status;
  error.errors = errors;
  throw error;
}

export async function listSessions() {
  return readJsonResponse(await fetch("/api/sessions"));
}

export async function loadSession(sessionId) {
  return readJsonResponse(await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`));
}

export async function loadSessionLayout(sessionId) {
  return readJsonResponse(await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/layout`));
}

export async function saveSessionLayout(sessionId, layout) {
  return readJsonResponse(
    await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/layout`, {
      method: "PUT",
      headers: JSON_HEADERS,
      body: JSON.stringify(layout)
    })
  );
}

export async function listTemplates() {
  return readJsonResponse(await fetch("/api/templates"));
}

export async function loadTemplate(templateId) {
  return readJsonResponse(await fetch(`/api/templates/${encodeURIComponent(templateId)}`));
}

export async function saveTemplate(template) {
  return readJsonResponse(
    await fetch("/api/templates", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(template)
    })
  );
}
