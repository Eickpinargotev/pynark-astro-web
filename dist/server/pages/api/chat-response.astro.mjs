export { renderers } from '../../renderers.mjs';

const responseStore = /* @__PURE__ */ new Map();
const TTL_MS = 5 * 60 * 1e3;
const purgeOld = () => {
  const now = Date.now();
  for (const [k, v] of responseStore.entries()) {
    if (now - v.createdAt > TTL_MS) responseStore.delete(k);
  }
};
const debugLog = [];
const pushDebug = (entry) => {
  debugLog.push(entry);
  while (debugLog.length > 50) debugLog.shift();
};
const json = (data, init) => new Response(JSON.stringify(data), {
  status: typeof init === "number" ? init : init?.status ?? 200,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    ...typeof init === "object" ? init.headers : {}
  }
});
const GET = async ({ url }) => {
  purgeOld();
  const session_id = url.searchParams.get("session_id") ?? "";
  const msg_id = url.searchParams.get("msg_id") ?? "";
  const wantDebug = url.searchParams.get("debug") === "1";
  if (!session_id || !msg_id) {
    if (wantDebug) {
      return json({ error: "Missing session_id or msg_id", debug: debugLog.slice(-5) }, 400);
    }
    return json({ error: "Missing session_id or msg_id" }, 400);
  }
  const key = `${session_id}:${msg_id}`;
  const found = responseStore.get(key);
  if (!found) {
    if (wantDebug) {
      return json({ pending: true, debug: debugLog.slice(-5) });
    }
    return json({});
  }
  responseStore.delete(key);
  if (wantDebug) {
    return json({ message: found.message, debug: debugLog.slice(-5) });
  }
  return json({ message: found.message });
};
const POST = async ({ request }) => {
  try {
    purgeOld();
    const contentType = request.headers.get("content-type") || "";
    const headers = {};
    request.headers.forEach((v, k) => headers[k] = v);
    let session_id;
    let msg_id;
    let message;
    let parsedBody = void 0;
    let rawBody = void 0;
    if (contentType.includes("application/json")) {
      parsedBody = await request.json();
      ({ session_id, msg_id, message } = parsedBody ?? {});
    } else if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      parsedBody = Object.fromEntries(form.entries());
      session_id = String(form.get("session_id") ?? "");
      msg_id = String(form.get("msg_id") ?? "");
      message = String(form.get("message") ?? "");
    } else {
      rawBody = await request.text();
      try {
        parsedBody = JSON.parse(rawBody);
        ({ session_id, msg_id, message } = parsedBody ?? {});
      } catch {
      }
    }
    pushDebug({
      ts: Date.now(),
      headers,
      contentType,
      rawBody,
      parsedBody,
      extracted: { session_id, msg_id, message }
    });
    if (!session_id || !msg_id || typeof message !== "string") {
      return json({ error: "Invalid payload. Expected { session_id, msg_id, message }" }, 400);
    }
    const key = `${session_id}:${msg_id}`;
    responseStore.set(key, { message, createdAt: Date.now() });
    return json({ ok: true });
  } catch (err) {
    pushDebug({
      ts: Date.now(),
      headers: {},
      contentType: "unknown",
      rawBody: void 0,
      parsedBody: { error: String(err) },
      extracted: {}
    });
    return json({ error: "Invalid request" }, 400);
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET,
  POST
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
