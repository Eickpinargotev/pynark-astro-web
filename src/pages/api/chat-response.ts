import type { APIRoute } from 'astro';

// In-memory store for async chat responses (dev-only; not persistent)
// Key format: `${session_id}:${timestamp}` -> { message, createdAt }
// Cambio: usar timestamp en lugar de msg_id para permitir múltiples respuestas por sesión
const responseStore = new Map<string, { message: string; createdAt: number }>();
const TTL_MS = 5 * 60 * 1000; // 5 minutes
const purgeOld = () => {
  const now = Date.now();
  for (const [k, v] of responseStore.entries()) {
    if (now - v.createdAt > TTL_MS) responseStore.delete(k);
  }
};

// In-memory debug logs to inspect what n8n actually posts
// We'll keep the last 50 entries
type DebugEntry = {
  ts: number;
  headers: Record<string, string>;
  contentType: string;
  rawBody?: string;
  parsedBody?: any;
  extracted?: { session_id?: string; msg_id?: string; message?: string };
};
const debugLog: DebugEntry[] = [];
const pushDebug = (entry: DebugEntry) => {
  debugLog.push(entry);
  while (debugLog.length > 50) debugLog.shift();
};

const json = (data: unknown, init?: number | ResponseInit) =>
  new Response(JSON.stringify(data), {
    status: typeof init === 'number' ? init : init?.status ?? 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...(typeof init === 'object' ? init.headers : {})
    }
  });

export const GET: APIRoute = async ({ url }) => {
  purgeOld();
  const session_id = url.searchParams.get('session_id') ?? '';
  const wantDebug = url.searchParams.get('debug') === '1';

  if (!session_id) {
    if (wantDebug) {
      return json({ error: 'Missing session_id', debug: debugLog.slice(-5) }, 400);
    }
    return json({ error: 'Missing session_id' }, 400);
  }

  // Buscar cualquier respuesta para esta sesión (ya no usamos msg_id)
  let found;
  for (const [key, value] of responseStore.entries()) {
    if (key.startsWith(`${session_id}:`)) {
      found = value;
      responseStore.delete(key);
      break;
    }
  }
  if (!found) {
    // Not ready yet; return an empty JSON so client continues polling safely
    if (wantDebug) {
      return json({ pending: true, debug: debugLog.slice(-5) });
    }
    return json({});
  }

  if (wantDebug) {
    return json({ message: found.message, debug: debugLog.slice(-5) });
  }
  return json({ message: found.message });
};

export const POST: APIRoute = async ({ request }) => {
  try {
  purgeOld();
    const contentType = request.headers.get('content-type') || '';
    const headers: Record<string, string> = {};
    request.headers.forEach((v, k) => (headers[k] = v));

    let session_id: string | undefined;
    let message: string | undefined;
    let parsedBody: any = undefined;
    let rawBody: string | undefined = undefined;

    if (contentType.includes('application/json')) {
      parsedBody = await request.json();
      ({ session_id, message } = parsedBody ?? {});
    } else if (
      contentType.includes('application/x-www-form-urlencoded') ||
      contentType.includes('multipart/form-data')
    ) {
      const form = await request.formData();
      parsedBody = Object.fromEntries(form.entries());
      session_id = String(form.get('session_id') ?? '');
      message = String(form.get('message') ?? '');
    } else {
      rawBody = await request.text();
      try {
        parsedBody = JSON.parse(rawBody);
        ({ session_id, message } = parsedBody ?? {});
      } catch {
        // leave parsedBody as text for debug
      }
    }

    pushDebug({
      ts: Date.now(),
      headers,
      contentType,
      rawBody,
      parsedBody,
      extracted: { session_id, message }
    });

    if (!session_id || typeof message !== 'string') {
      return json({ error: 'Invalid payload. Expected { session_id, message }. msg_id is optional.' }, 400);
    }

    // Usar timestamp para permitir múltiples respuestas por sesión
    const key = `${session_id}:${Date.now()}`;
    responseStore.set(key, { message, createdAt: Date.now() });

    return json({ ok: true });
  } catch (err) {
    pushDebug({
      ts: Date.now(),
      headers: {},
      contentType: 'unknown',
      rawBody: undefined,
      parsedBody: { error: String(err) },
      extracted: {}
    });
    return json({ error: 'Invalid request' }, 400);
  }
};

// Optional cleanup (no scheduler here; kept minimal for dev)
// Consider purging old entries on each POST/GET if needed.
