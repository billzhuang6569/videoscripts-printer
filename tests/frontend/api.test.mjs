import assert from "node:assert/strict";
import test from "node:test";
import {
  listSessions,
  listTemplates,
  loadSession,
  loadSessionLayout,
  loadTemplate,
  saveSessionData,
  saveSessionLayout,
  saveTemplate
} from "../../public/js/api.js";

function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json" }
  });
}

test("api module calls browser-safe server endpoints", async (t) => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    return jsonResponse(url === "/api/sessions" || url === "/api/templates" ? [] : { ok: true });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  await listSessions();
  await loadSession("sample shoot");
  await loadSessionLayout("sample shoot");
  await listTemplates();
  await loadTemplate("balanced landscape.json");
  await saveSessionData("sample shoot", { fields: [], rows: [] });
  await saveTemplate({ name: "保存模板", paper: {}, table: {}, columns: [] });
  await saveSessionLayout("sample shoot", { name: "本次排版", paper: {}, table: {}, columns: [] });

  assert.deepEqual(
    calls.map((call) => call.url),
    [
      "/api/sessions",
      "/api/sessions/sample%20shoot",
      "/api/sessions/sample%20shoot/layout",
      "/api/templates",
      "/api/templates/balanced%20landscape.json",
      "/api/sessions/sample%20shoot",
      "/api/templates",
      "/api/sessions/sample%20shoot/layout"
    ]
  );
  assert.equal(calls[5].options.method, "PUT");
  assert.equal(calls[5].options.headers["content-type"], "application/json");
  assert.equal(calls[6].options.method, "POST");
  assert.equal(calls[6].options.headers["content-type"], "application/json");
  assert.equal(calls[7].options.method, "PUT");
  assert.equal(calls[7].options.headers["content-type"], "application/json");
});

test("api module surfaces JSON error messages", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonResponse({ errors: ["模板缺少 name"] }, { status: 422 });
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  await assert.rejects(() => saveTemplate({}), /模板缺少 name/);
});
