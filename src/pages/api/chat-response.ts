import type { APIRoute } from 'astro';

// Cola de respuestas por sesión para manejar el flujo correcto:
// Cliente envía múltiples mensajes -> n8n procesa -> envía una respuesta
type ResponseItem = { 
  message: string; 
  createdAt: number; 
  id: string;
  consumed: boolean;
};

// Tracking de sesiones activas - detectar automáticamente cuando hay actividad
type SessionInfo = {
  lastPollTime: number; // Última vez que el cliente hizo polling
  lastResponseTime: number; // Última vez que llegó respuesta del agente
  isWaitingForResponse: boolean; // Si la sesión está esperando respuesta del agente
  firstPollTime: number; // Primera vez que empezó el polling en esta sesión
};

const responseQueues = new Map<string, ResponseItem[]>();
const sessionTracking = new Map<string, SessionInfo>();
const TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_WAIT_TIME_MS = 60 * 1000; // 60 segundos máximo de espera
const POLLING_FREQUENCY_MS = 2 * 1000; // Esperamos polling cada 2 segundos

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
  
  // Purgar tracking de sesiones antiguas
  for (const [sessionId, info] of sessionTracking.entries()) {
    if (now - info.lastPollTime > TTL_MS) {
      sessionTracking.delete(sessionId);
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

  const now = Date.now();
  
  // Actualizar o crear tracking de sesión
  const sessionInfo = sessionTracking.get(session_id) || {
    lastPollTime: now,
    lastResponseTime: 0,
    isWaitingForResponse: false,
    firstPollTime: now
  };
  
  const timeSinceLastPoll = now - sessionInfo.lastPollTime;
  const timeSinceFirstPoll = now - sessionInfo.firstPollTime;
  
  // Actualizar tiempos
  sessionInfo.lastPollTime = now;
  
  // Si es un polling regular (cada 2-6 segundos), marcar como esperando respuesta
  if (timeSinceLastPoll < (POLLING_FREQUENCY_MS * 3) && timeSinceLastPoll > 0) {
    sessionInfo.isWaitingForResponse = true;
  }
  
  // Si es la primera vez en mucho tiempo, reiniciar el tracking
  if (timeSinceLastPoll > 30000) { // 30 segundos sin polling
    sessionInfo.firstPollTime = now;
    sessionInfo.isWaitingForResponse = true; // Asumir que está esperando respuesta
  }

  sessionTracking.set(session_id, sessionInfo);

  console.log(`🔍 GET para sesión: ${session_id}`);
  console.log(`📊 Esperando respuesta: ${sessionInfo.isWaitingForResponse}, tiempo desde primer poll: ${timeSinceFirstPoll}ms`);
  
  const queue = responseQueues.get(session_id);
  
  if (!queue || queue.length === 0) {
    // Verificar si la sesión está esperando respuesta y dentro del tiempo límite
    if (sessionInfo.isWaitingForResponse && timeSinceFirstPoll < MAX_WAIT_TIME_MS) {
      const waitTimeRemaining = Math.max(0, MAX_WAIT_TIME_MS - timeSinceFirstPoll);
      console.log(`⏳ Sesión esperando respuesta, tiempo restante: ${waitTimeRemaining}ms`);
      
      if (wantDebug) {
        return json({ 
          pending: true, 
          waitTimeRemaining,
          timeSinceFirstPoll,
          debug: debugLog.slice(-5) 
        });
      }
      return json({ 
        pending: true, 
        waitTimeRemaining,
        timeSinceFirstPoll
      });
    }
    
    // Tiempo de espera agotado, limpiar sesión
    if (sessionInfo.isWaitingForResponse && timeSinceFirstPoll >= MAX_WAIT_TIME_MS) {
      console.log(`⌛ Tiempo de espera agotado para sesión ${session_id}`);
      sessionInfo.isWaitingForResponse = false;
      sessionTracking.set(session_id, sessionInfo);
    }
    
    if (wantDebug) {
      return json({ pending: false, debug: debugLog.slice(-5) });
    }
    return json({});
  }

  // Buscar la primera respuesta no consumida
  const pendingResponse = queue.find(item => !item.consumed);
  if (!pendingResponse) {
    if (wantDebug) {
      return json({ pending: true, debug: debugLog.slice(-5) });
    }
    return json({ pending: true });
  }

  // Marcar como consumida y resetear tracking de sesión
  pendingResponse.consumed = true;
  sessionInfo.lastResponseTime = now;
  sessionInfo.isWaitingForResponse = false; // Ya no espera respuesta
  sessionInfo.firstPollTime = now; // Reset para siguiente conversación
  sessionTracking.set(session_id, sessionInfo);
  
  console.log(`✅ Respuesta enviada: ${pendingResponse.message}`);
  console.log(`🔄 Sesión reseteada para nueva conversación`);

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

    // Verificar si hay una sesión esperando respuesta
    const sessionInfo = sessionTracking.get(session_id);
    if (sessionInfo) {
      console.log(`📊 Sesión esperando respuesta: ${sessionInfo.isWaitingForResponse}`);
      console.log(`📊 Tiempo desde primer poll: ${Date.now() - sessionInfo.firstPollTime}ms`);
    } else {
      console.log(`⚠️ No hay tracking de sesión para ${session_id}, creando respuesta de todas formas`);
    }

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

// Mantener el endpoint PUT por compatibilidad
export const PUT: APIRoute = async ({ request }) => {
  try {
    purgeOld();
    const { session_id } = await request.json();
    
    if (!session_id) {
      return json({ error: 'Missing session_id' }, 400);
    }
    
    const now = Date.now();
    const sessionInfo = sessionTracking.get(session_id) || {
      lastPollTime: now,
      lastResponseTime: 0,
      isWaitingForResponse: true,
      firstPollTime: now
    };
    
    // Forzar estado de espera cuando se llama PUT
    sessionInfo.isWaitingForResponse = true;
    if (sessionInfo.firstPollTime === 0) {
      sessionInfo.firstPollTime = now;
    }
    sessionTracking.set(session_id, sessionInfo);
    
    console.log(`📝 Sesión marcada como esperando respuesta: ${session_id}`);
    
    return json({ ok: true });
  } catch (err) {
    return json({ error: 'Invalid request' }, 400);
  }
};

// Optional cleanup (no scheduler here; kept minimal for dev)
// Consider purging old entries on each POST/GET if needed.
