import type { APIRoute } from 'astro';

// Cola de respuestas por sesión para manejar múltiples mensajes
// Key: session_id -> Array de respuestas ordenadas por timestamp
type ResponseItem = { 
  message: string; 
  createdAt: number; 
  id: string; // ID único para cada respuesta
  consumed: boolean; // Flag para marcar si ya fue enviada al cliente
};

const responseQueues = new Map<string, ResponseItem[]>();
const TTL_MS = 5 * 60 * 1000; // 5 minutes

const purgeOld = () => {
  const now = Date.now();
  for (const [sessionId, queue] of responseQueues.entries()) {
    // Filtrar respuestas expiradas
    const validResponses = queue.filter(item => now - item.createdAt <= TTL_MS);
    if (validResponses.length === 0) {
      responseQueues.delete(sessionId);
    } else {
      responseQueues.set(sessionId, validResponses);
    }
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

  console.log(`🔍 Buscando respuestas para sesión: ${session_id}`);
  console.log(`📦 Colas actuales:`, Array.from(responseQueues.keys()));

  const queue = responseQueues.get(session_id);
  if (!queue || queue.length === 0) {
    if (wantDebug) {
      return json({ pending: true, debug: debugLog.slice(-5) });
    }
    return json({});
  }

  // Buscar la primera respuesta no consumida
  const pendingResponse = queue.find(item => !item.consumed);
  if (!pendingResponse) {
    if (wantDebug) {
      return json({ pending: true, debug: debugLog.slice(-5) });
    }
    return json({});
  }

  // Marcar como consumida en lugar de eliminar
  pendingResponse.consumed = true;
  console.log(`✅ Respuesta marcada como consumida: ${pendingResponse.id} -> ${pendingResponse.message}`);

  // Limpiar respuestas consumidas antiguas (opcional, para mantener memoria baja)
  const now = Date.now();
  const cleanQueue = queue.filter(item => 
    !item.consumed || (now - item.createdAt < 30000) // Mantener consumidas por 30s
  );
  
  if (cleanQueue.length === 0) {
    responseQueues.delete(session_id);
  } else {
    responseQueues.set(session_id, cleanQueue);
  }

  if (wantDebug) {
    return json({ message: pendingResponse.message, debug: debugLog.slice(-5) });
  }
  return json({ message: pendingResponse.message });
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
      console.log(`❌ POST inválido - session_id: ${session_id}, message: ${message}`);
      return json({ error: 'Invalid payload. Expected { session_id, message }. msg_id is optional.' }, 400);
    }

    console.log(`📨 POST válido recibido - session_id: ${session_id}, message: ${message}`);

    // Crear nueva respuesta con ID único
    const responseItem: ResponseItem = {
      message,
      createdAt: Date.now(),
      id: `${session_id}:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`,
      consumed: false
    };

    // Agregar a la cola de la sesión
    const currentQueue = responseQueues.get(session_id) || [];
    currentQueue.push(responseItem);
    responseQueues.set(session_id, currentQueue);
    
    console.log(`💾 Respuesta agregada a cola: ${responseItem.id}`);
    console.log(`📊 Cola de sesión ${session_id} tiene ${currentQueue.length} respuesta(s)`);

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
