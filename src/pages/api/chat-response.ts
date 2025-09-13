import type { APIRoute } from 'astro';

// Cola de respuestas por sesión para manejar el flujo correcto:
// Cliente envía múltiples mensajes -> n8n procesa -> envía una respuesta
type ResponseItem = { 
  message: string; 
  createdAt: number; 
  id: string;
  consumed: boolean;
};

// Tracking de última actividad del cliente para determinar ventana de espera
type ClientActivity = {
  lastMessageTime: number;
  messageCount: number;
};

const responseQueues = new Map<string, ResponseItem[]>();
const clientActivity = new Map<string, ClientActivity>();
const TTL_MS = 5 * 60 * 1000; // 5 minutes
const CLIENT_WAIT_WINDOW_MS = 30 * 1000; // 30 segundos después del último mensaje del cliente

const purgeOld = () => {
  const now = Date.now();
  
  // Purgar respuestas antiguas
  for (const [sessionId, queue] of responseQueues.entries()) {
    const validResponses = queue.filter(item => now - item.createdAt <= TTL_MS);
    if (validResponses.length === 0) {
      responseQueues.delete(sessionId);
    } else {
      responseQueues.set(sessionId, validResponses);
    }
  }
  
  // Purgar actividad de cliente antigua
  for (const [sessionId, activity] of clientActivity.entries()) {
    if (now - activity.lastMessageTime > TTL_MS) {
      clientActivity.delete(sessionId);
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
  
  const queue = responseQueues.get(session_id);
  const activity = clientActivity.get(session_id);
  const now = Date.now();
  
  // Debug info
  if (activity) {
    const timeSinceLastMessage = now - activity.lastMessageTime;
    console.log(`📊 Actividad cliente: ${activity.messageCount} mensajes, último hace ${timeSinceLastMessage}ms`);
  }
  
  if (!queue || queue.length === 0) {
    // Verificar si aún estamos en la ventana de espera
    if (activity && (now - activity.lastMessageTime < CLIENT_WAIT_WINDOW_MS)) {
      console.log(`⏳ Esperando respuesta del agente (${CLIENT_WAIT_WINDOW_MS - (now - activity.lastMessageTime)}ms restantes)`);
      if (wantDebug) {
        return json({ 
          pending: true, 
          waitTimeRemaining: CLIENT_WAIT_WINDOW_MS - (now - activity.lastMessageTime),
          debug: debugLog.slice(-5) 
        });
      }
      return json({
        pending: true, 
        waitTimeRemaining: CLIENT_WAIT_WINDOW_MS - (now - activity.lastMessageTime),
      });
    }
    
    // Fuera de la ventana de espera, limpiar actividad
    if (activity) {
      console.log(`⌛ Ventana de espera expirada para sesión ${session_id}`);
      clientActivity.delete(session_id);
    }
    
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

  // Marcar como consumida y limpiar actividad del cliente (conversación completada)
  pendingResponse.consumed = true;
  clientActivity.delete(session_id); // Reset para nueva conversación
  
  console.log(`✅ Respuesta enviada: ${pendingResponse.message}`);
  console.log(`🔄 Actividad de cliente limpiada para nueva conversación`);

  // Limpiar respuestas consumidas
  const cleanQueue = queue.filter(item => 
    !item.consumed || (now - item.createdAt < 30000)
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
      return json({ error: 'Invalid payload. Expected { session_id, message }.' }, 400);
    }

    console.log(`📨 Respuesta de n8n recibida - session_id: ${session_id}, message: ${message}`);

    // Crear nueva respuesta del agente
    const responseItem: ResponseItem = {
      message,
      createdAt: Date.now(),
      id: `${session_id}:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`,
      consumed: false
    };

    // Agregar respuesta a la cola
    const currentQueue = responseQueues.get(session_id) || [];
    currentQueue.push(responseItem);
    responseQueues.set(session_id, currentQueue);
    
    console.log(`💾 Respuesta del agente guardada: ${responseItem.id}`);
    console.log(`📊 Cola tiene ${currentQueue.length} respuesta(s) pendiente(s)`);

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

// Nuevo endpoint para que el cliente registre cuando envía mensajes
export const PUT: APIRoute = async ({ request }) => {
  try {
    purgeOld();
    const { session_id } = await request.json();
    
    if (!session_id) {
      return json({ error: 'Missing session_id' }, 400);
    }
    
    const now = Date.now();
    const activity = clientActivity.get(session_id) || { lastMessageTime: 0, messageCount: 0 };
    
    activity.lastMessageTime = now;
    activity.messageCount += 1;
    clientActivity.set(session_id, activity);
    
    console.log(`📝 Cliente envió mensaje ${activity.messageCount} en sesión ${session_id}`);
    
    return json({ ok: true, messageCount: activity.messageCount });
  } catch (err) {
    return json({ error: 'Invalid request' }, 400);
  }
};

// Optional cleanup (no scheduler here; kept minimal for dev)
// Consider purging old entries on each POST/GET if needed.
