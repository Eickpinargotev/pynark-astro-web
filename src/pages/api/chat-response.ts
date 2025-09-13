import type { APIRoute } from 'astro';

// Cola de respuestas por sesión para manejar el flujo correcto:
// Cliente envía múltiples mensajes -> n8n procesa -> envía una respuesta
type ResponseItem = { 
  message: string; 
  createdAt: number; 
  id: string;
  consumed: boolean;
  // tipo de mensaje para diferenciar sistema vs agente
  type?: 'agent' | 'system';
};

// Tracking de sesiones activas - detectar automáticamente cuando hay actividad
type SessionInfo = {
  lastPollTime: number; // Última vez que el cliente hizo polling
  lastResponseTime: number; // Última vez que llegó respuesta del agente
  isWaitingForResponse: boolean; // Si la sesión está esperando respuesta del agente
  firstPollTime: number; // Primera vez que empezó el polling en esta sesión
  // NUEVO: actividad del usuario y cierre de sesión
  lastUserActivity: number; // Última vez que el usuario envió un mensaje
  sessionClosed: boolean;   // Si la sesión está cerrada por inactividad
  closedAt: number;         // Cuándo se cerró
};

const responseQueues = new Map<string, ResponseItem[]>();
const sessionTracking = new Map<string, SessionInfo>();

// Config
const TTL_MS = 5 * 60 * 1000; // 5 minutes
const INACTIVITY_TTL_MS = TTL_MS; // 5 minutos sin actividad del usuario => /delete
const SESSION_GRACE_MS = 30 * 1000; // tiempo de gracia para limpiar una vez enviado /delete
const MAX_WAIT_TIME_MS = 60 * 1000; // 60 segundos máximo de espera para "pending"
const POLLING_FREQUENCY_MS = 2 * 1000; // Esperamos polling cada 2 segundos
const DELETE_TRIGGER = '/delete';
// NUEVO: long-poll por request para evitar que el usuario tenga que enviar otro mensaje
const LONG_POLL_MS = 25 * 1000; // hasta 25s por GET
const SLEEP_MS = 400; // intervalo de comprobación durante long-poll

// Helpers
const getOrInitSession = (session_id: string, now: number): SessionInfo => {
  const existing = sessionTracking.get(session_id);
  if (existing) return existing;
  const info: SessionInfo = {
    lastPollTime: now,
    lastResponseTime: 0,
    isWaitingForResponse: false,
    firstPollTime: now,
    lastUserActivity: 0, // el frontend debe marcar actividad vía PUT al mandar un mensaje
    sessionClosed: false,
    closedAt: 0
  };
  sessionTracking.set(session_id, info);
  return info;
};

// NUEVO: sleep para long-poll
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

const enqueueResponse = (session_id: string, message: string, type: 'agent' | 'system' = 'agent'): ResponseItem => {
  const item: ResponseItem = {
    message,
    type,
    createdAt: Date.now(),
    id: `${session_id}:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`,
    consumed: false
  };
  const q = responseQueues.get(session_id) || [];
  q.push(item);
  responseQueues.set(session_id, q);
  return item;
};

const closeSession = (session_id: string, now: number) => {
  const info = getOrInitSession(session_id, now);
  if (!info.sessionClosed) {
    enqueueResponse(session_id, DELETE_TRIGGER, 'system');
    info.sessionClosed = true;
    info.closedAt = now;
    sessionTracking.set(session_id, info);
    console.log(`🧹 Sesión ${session_id} cerrada por inactividad, encolado "${DELETE_TRIGGER}"`);
  }
};

const purgeOld = () => {
  const now = Date.now();
  
  // Purgar respuestas antiguas (seguridad/limpieza)
  for (const [sessionId, queue] of responseQueues.entries()) {
    const validResponses = queue.filter(item => now - item.createdAt <= TTL_MS);
    if (validResponses.length === 0) {
      responseQueues.delete(sessionId);
    } else {
      responseQueues.set(sessionId, validResponses);
    }
  }
  
  // Auto-cierre por inactividad y limpieza diferida
  for (const [sessionId, info] of sessionTracking.entries()) {
    // Cerrar si no hay actividad del usuario por INACTIVITY_TTL_MS
    if (!info.sessionClosed && info.lastUserActivity > 0 && (now - info.lastUserActivity) > INACTIVITY_TTL_MS) {
      closeSession(sessionId, now);
    }

    // Limpiar tracking si la sesión está cerrada y ya se entregó (o pasó gracia)
    if (info.sessionClosed) {
      const queue = responseQueues.get(sessionId) || [];
      // No bloquear la purga por mensajes de sistema (p.ej. '/delete') que nunca serán consumidos si el usuario cerró la pestaña
      const hasUnconsumed = queue.some(i => !i.consumed && (i.type !== 'system') && (i.message !== DELETE_TRIGGER));
      const graceExpired = (now - info.closedAt) > SESSION_GRACE_MS;
      if (!hasUnconsumed && graceExpired) {
        sessionTracking.delete(sessionId);
        responseQueues.delete(sessionId);
        console.log(`🧽 Sesión ${sessionId} purgada tras cierre`);
      }
      continue;
    }

    // Purgar tracking de sesiones sin polling prolongado (fallback)
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
      // NUEVO: evitar cache para que el cliente vea el mensaje en cuanto llegue
      'Cache-Control': 'no-store, no-cache, must-revalidate',
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
  const sessionInfo = getOrInitSession(session_id, now);
  
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
  console.log(`📊 Esperando respuesta: ${sessionInfo.isWaitingForResponse}, tiempo desde primer poll: ${timeSinceFirstPoll}ms, cerrada: ${sessionInfo.sessionClosed}`);
  
  const queue = responseQueues.get(session_id) || [];
  const makeDebug = () => {
    const q = responseQueues.get(session_id) || [];
    const summary = {
      total: q.length,
      unconsumed: q.filter(i => !i.consumed).length,
      unconsumedAgent: q.filter(i => !i.consumed && (i.type !== 'system') && (i.message !== DELETE_TRIGGER)).length,
      last5: q.slice(-5).map(i => ({ id: i.id, type: i.type ?? 'agent', consumed: i.consumed, msg: i.message }))
    };
    return {
      session: {
        lastPollTime: sessionInfo.lastPollTime,
        lastResponseTime: sessionInfo.lastResponseTime,
        isWaitingForResponse: sessionInfo.isWaitingForResponse,
        firstPollTime: sessionInfo.firstPollTime,
        lastUserActivity: sessionInfo.lastUserActivity,
        sessionClosed: sessionInfo.sessionClosed,
        closedAt: sessionInfo.closedAt
      },
      queue: summary,
      log: debugLog.slice(-5)
    };
  };
  
  // Entregar todas las respuestas no consumidas en orden (multi-mensaje)
  const pending = queue.filter(item => !item.consumed);
  if (pending.length > 0) {
    pending.forEach(item => (item.consumed = true));
    sessionInfo.lastResponseTime = now;
    sessionInfo.isWaitingForResponse = false;
    sessionInfo.firstPollTime = now; // Reset para siguiente conversación
    sessionTracking.set(session_id, sessionInfo);

    const payload = {
      // mantener compatibilidad: primer mensaje también en "message"
      message: pending[0]?.message,
      messages: pending.map(p => p.message),
      count: pending.length,
      ...(wantDebug ? { debug: makeDebug() } : {})
    };
    console.log(`✅ Enviando ${pending.length} mensaje(s)`);
    return json(payload);
  }

  // Si no hay mensajes listos, verificar autodelete por inactividad de usuario
  if (!sessionInfo.sessionClosed && sessionInfo.lastUserActivity > 0 && (now - sessionInfo.lastUserActivity) > INACTIVITY_TTL_MS) {
    closeSession(session_id, now);
  }

  // NUEVO: long-poll mientras esperamos respuesta del agente
  if (sessionInfo.isWaitingForResponse && timeSinceFirstPoll < MAX_WAIT_TIME_MS) {
    let waitTimeRemaining = Math.max(0, MAX_WAIT_TIME_MS - timeSinceFirstPoll);
    const budget = Math.min(LONG_POLL_MS, waitTimeRemaining);

    if (budget > 0) {
      const deadline = Date.now() + budget;
      while (Date.now() < deadline) {
        const q = responseQueues.get(session_id) || [];
        const hasNew = q.some(i => !i.consumed);
        if (hasNew) {
          // Reutilizamos la misma lógica de entrega múltiple
          const toDeliver = q.filter(i => !i.consumed);
          toDeliver.forEach(i => (i.consumed = true));
          const now2 = Date.now();
          sessionInfo.lastResponseTime = now2;
          sessionInfo.isWaitingForResponse = false;
          sessionInfo.firstPollTime = now2;
          sessionTracking.set(session_id, sessionInfo);
          const payload = {
            message: toDeliver[0]?.message,
            messages: toDeliver.map(p => p.message),
            count: toDeliver.length,
            ...(wantDebug ? { debug: makeDebug() } : {})
          };
          console.log(`✅ Enviando ${toDeliver.length} mensaje(s) (long-poll)`);
          return json(payload);
        }
        await sleep(SLEEP_MS);
      }
      // timeout del long-poll; actualizamos el tiempo restante y devolvemos pending
      waitTimeRemaining = Math.max(0, MAX_WAIT_TIME_MS - (Date.now() - sessionInfo.firstPollTime));
      if (wantDebug) {
        return json({ pending: true, waitTimeRemaining, timeSinceFirstPoll, debug: makeDebug() });
      }
      return json({ pending: true, waitTimeRemaining, timeSinceFirstPoll });
    }

    // Sin presupuesto de espera (queda poco en la ventana): devolvemos pending inmediatamente
    if (wantDebug) {
      return json({ pending: true, waitTimeRemaining, timeSinceFirstPoll, debug: makeDebug() });
    }
    return json({ pending: true, waitTimeRemaining, timeSinceFirstPoll });
  }
  
  // Tiempo de espera agotado
  if (sessionInfo.isWaitingForResponse && timeSinceFirstPoll >= MAX_WAIT_TIME_MS) {
    sessionInfo.isWaitingForResponse = false;
    sessionTracking.set(session_id, sessionInfo);
  }

  if (wantDebug) {
    return json({ pending: false, debug: makeDebug() });
  }
  return json({});
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

    const now = Date.now();
    const sessionInfo = getOrInitSession(session_id, now);

    // Si la sesión está cerrada por inactividad, no entregar mensajes del agente hasta que el usuario reinicie
    if (sessionInfo.sessionClosed) {
      console.log(`⚠️ Sesión ${session_id} cerrada. Descartando mensaje del agente.`);
      return json({ ok: true, dropped: true });
    }

    // Crear y encolar respuesta del agente
    const responseItem = enqueueResponse(session_id, message, 'agent');
    console.log(`💾 Respuesta del agente guardada: ${responseItem.id}`);
    const currentQueue = responseQueues.get(session_id) || [];
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
    const body = await request.json().catch(() => ({} as any));
    const { session_id } = body as { session_id?: string };
    
    if (!session_id) {
      return json({ error: 'Missing session_id' }, 400);
    }
    
    const now = Date.now();
    const sessionInfo = getOrInitSession(session_id, now);
    
    // Marcar actividad del usuario y estado de espera
    sessionInfo.isWaitingForResponse = true;
    sessionInfo.lastUserActivity = now;
    if (sessionInfo.firstPollTime === 0) {
      sessionInfo.firstPollTime = now;
    }

    // Si estaba cerrada, reabrir limpiamente para nueva conversación
    if (sessionInfo.sessionClosed) {
      responseQueues.delete(session_id); // limpiar mensajes antiguos (incluye /delete)
      sessionInfo.sessionClosed = false;
      sessionInfo.closedAt = 0;
      sessionInfo.lastResponseTime = 0;
      sessionInfo.firstPollTime = now;
      console.log(`🔓 Sesión ${session_id} reabierta por actividad del usuario`);
    }

    sessionTracking.set(session_id, sessionInfo);
    console.log(`📝 Sesión marcada como esperando respuesta: ${session_id}`);
    
    return json({ ok: true });
  } catch (err) {
    return json({ error: 'Invalid request' }, 400);
  }
};

// Ejecutar purgeOld periódicamente para detectar inactividad aunque no haya requests
// Evita fugas de memoria cuando el usuario cierra la pestaña y nunca consume '/delete'
declare const global: any;
const g: any = (globalThis as any);
if (!g.__pynarkCleanupInterval) {
  try {
    g.__pynarkCleanupInterval = setInterval(purgeOld, 30 * 1000); // cada 30s
  } catch {}
}
