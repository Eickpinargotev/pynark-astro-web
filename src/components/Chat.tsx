import React, { useState, useRef, useEffect } from 'react';
import { Send, Trash2, Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

interface ChatState {
  isTyping: boolean;
  error: string | null;
  isLoading: boolean;
  isTimedOut: boolean; // Nueva: si la sesión expiró por inactividad
}

interface AgentConfig {
  id: string;
  name: string;
  webhookUrl: string;
  responseUrl?: string | null;
  avatarPath: string;
  requestTimeoutMs: number;
  maxHistory: number;
  resetMessage: string;
}

interface ChatProps {
  agentConfig: AgentConfig;
}

const Chat: React.FC<ChatProps> = ({ agentConfig }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [sessionId] = useState(() => uuidv4());
  const [turn, setTurn] = useState(1);
  const [isWaitingResponse, setIsWaitingResponse] = useState(false);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [chatState, setChatState] = useState<ChatState>({
    isTyping: false,
    error: null,
    isLoading: false,
    isTimedOut: false
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  useEffect(() => {
    // Only scroll if there are messages or if typing
    if (messages.length > 0 || chatState.isTyping) {
      scrollToBottom();
    }
  }, [messages, chatState.isTyping]);

  // Handle tab visibility changes - check for missed messages when user returns
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && !pollingInterval && !chatState.isTimedOut) {
        console.log('👀 Usuario regresó a la pestaña, verificando mensajes perdidos...');
        // Check for missed messages when returning to the tab
        checkForMissedMessages();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [pollingInterval, chatState.isTimedOut, sessionId]);

  const checkForMissedMessages = async () => {
    try {
      const response = await fetch(`/api/chat-response?session_id=${sessionId}&debug=1`);
      if (response.ok) {
        const data = await response.json();
        const messagesFromServer: string[] = Array.isArray(data.messages)
          ? data.messages
          : (typeof data.message === 'string' ? [data.message] : []);

        if (messagesFromServer.some(m => m === '/delete') || data.timeout === true) {
          console.log('🧹 Encontrado /delete al regresar: mostrando mensaje de timeout en chat');
          // Limpiar chat automáticamente y mostrar mensaje de timeout
          setMessages([]);
          setTurn(1);
          const timeoutMessage: Message = {
            id: uuidv4(),
            content: 'tiempo limite de inactividad: iniciar nuevo chat',
            isUser: false,
            timestamp: new Date()
          };
          setMessages([timeoutMessage]);
          setChatState(prev => ({ ...prev, isTyping: false, isTimedOut: false }));
          return;
        }

        if (messagesFromServer.length > 0) {
          console.log('📬 Mensajes perdidos encontrados:', messagesFromServer);
          const newBotMessages: Message[] = messagesFromServer.map(msg => ({
            id: uuidv4(),
            content: msg,
            isUser: false,
            timestamp: new Date()
          }));
          setMessages(prev => [...prev, ...newBotMessages]);
          setTurn(prev => prev + 1);
        }
      }
    } catch (error) {
      console.error('Error verificando mensajes perdidos:', error);
    }
  };

  const sendMessage = async (content: string) => {
    if (!content.trim()) {
      return;
    }

    const messageId = uuidv4();
    const userMessage: Message = {
      id: messageId,
      content: content.trim(),
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setChatState(prev => ({ ...prev, error: null }));

    // Check if we've exceeded max history
    if (messages.length >= agentConfig.maxHistory) {
      setMessages([]);
      setTurn(1);
      const resetMessage: Message = {
        id: uuidv4(),
        content: agentConfig.resetMessage,
        isUser: false,
        timestamp: new Date()
      };
      setMessages([resetMessage]);
      return;
    }

    try {
      // Notificar actividad del usuario al backend (marca lastUserActivity y abre sesión si estaba cerrada)
      try {
        await fetch('/api/chat-response', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId }),
          // @ts-ignore - AbortSignal.timeout disponible en navegadores modernos
          signal: AbortSignal.timeout(5000)
        });
      } catch (e) {
        console.warn('No se pudo registrar actividad de usuario (PUT):', e);
      }

      // Función para obtener la IP local real
      const getLocalIP = async (): Promise<string> => {
        try {
          // Crear una conexión WebRTC para obtener la IP local
          const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
          });
          
          const dc = pc.createDataChannel('');
          
          return new Promise((resolve) => {
            pc.onicecandidate = (ice) => {
              if (ice && ice.candidate && ice.candidate.candidate) {
                const candidate = ice.candidate.candidate;
                const match = candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/);
                if (match && !match[0].startsWith('127.') && !match[0].startsWith('169.254.')) {
                  resolve(match[0]);
                  pc.close();
                }
              }
            };
            
            pc.createOffer().then(offer => pc.setLocalDescription(offer));
            
            // Fallback después de 2 segundos
            setTimeout(() => {
              resolve('127.0.0.1');
              pc.close();
            }, 2000);
          });
        } catch (error) {
          console.warn('No se pudo obtener IP local:', error);
          return '127.0.0.1';
        }
      };

      // Calcular URL de callback (si está configurada en el agente)
      // Ahora que tendremos backend en producción, hacemos fallback al origen actual.
      let callbackUrl: string | null = agentConfig.responseUrl ?? null;
      if (!callbackUrl) {
        callbackUrl = `${window.location.origin}/api/chat-response`;
      }

      const payload: Record<string, any> = {
        agent_id: agentConfig.id,
        session_id: sessionId,
        turn: turn,
        message: content.trim()
      };
      if (callbackUrl) {
        payload.response_url = callbackUrl;
      }

      console.log('🚀 Enviando mensaje a n8n:', {
        webhook: agentConfig.webhookUrl,
        method: 'POST',
        payload: payload
      });

      // NO mostramos "escribiendo..." hasta recibir el callback

      // Test webhook connectivity first
      console.log('🔍 Probando conectividad del webhook...');
      
      // Send message to n8n webhook (fire and forget)
      const response = await fetch(agentConfig.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Pynark-Chat/1.0'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000) // Aumentar timeout para debugging
      });

      console.log('📨 Respuesta del webhook:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error del webhook:', errorText);
        throw new Error(`Error del servidor: ${response.status} - ${errorText}`);
      }

      // Leer el cuerpo para logging, pero no lo mostramos en UI
      const responseText = await response.text();
      console.log('✅ Webhook enviado exitosamente (oculto en UI):', responseText);

      // Usar siempre el callback/polling para mostrar la respuesta del bot
      if (callbackUrl) {
        // Solo iniciar polling si no hay uno activo
        if (!pollingInterval && !isWaitingResponse) {
          setIsWaitingResponse(true);
          startPollingForResponse(callbackUrl);
        }
      } else {
        setChatState(prev => ({ 
          ...prev, 
          error: 'No hay endpoint de callback configurado.'
        }));
      }

    } catch (error) {
      console.error('💥 Error enviando mensaje:', error);
      
      let errorMessage = 'Error desconocido. Por favor, intenta de nuevo.';
      
      if (error instanceof Error) {
        if (error.name === 'TimeoutError') {
          errorMessage = 'Tiempo de espera agotado. El webhook de n8n no respondió.';
        } else if (error.message.includes('Failed to fetch')) {
          errorMessage = 'Error de conexión. Verifica que n8n esté funcionando.';
        } else if (error.message.includes('NetworkError')) {
          errorMessage = 'Error de red. Verifica tu conexión a internet.';
        } else if (error.message.includes('CORS')) {
          errorMessage = 'Error de CORS. Configura n8n para permitir requests desde este dominio.';
        } else {
          errorMessage = `Error: ${error.message}`;
        }
      }

      setChatState(prev => ({ ...prev, error: errorMessage }));
    }
  };

  // Polling para obtener respuestas pendientes (por sesión, no por mensaje)
  const startPollingForResponse = (baseUrl?: string) => {
    // Si ya hay polling activo, no iniciar uno nuevo
    if (pollingInterval) {
      console.log('⚠️ Polling ya activo, no iniciando nuevo');
      return;
    }

    let pollCount = 0;
    const maxPolls = 120; // Aumentar a 120 polls (4 minutos) para dar más tiempo
    let inactivityCount = 0; // Contador de polls sin respuesta
    const maxInactivity = 15; // Aumentar a 15 polls sin respuesta = 30 segundos de inactividad
    
    console.log('🔄 Iniciando polling para sesión:', sessionId);
    
    const interval = setInterval(async () => {
      pollCount++;
      console.log(`🔄 Polling ${pollCount}/${maxPolls} para sesión ${sessionId}`);
      
      try {
        // Polling general por sesión, sin msg_id específico
        const pollUrl = baseUrl 
          ? `${baseUrl}?session_id=${encodeURIComponent(sessionId)}&debug=1`
          : `/api/chat-response?session_id=${sessionId}&debug=1`;
        const response = await fetch(pollUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        });

        if (response.ok) {
          const data = await response.json();
          
          // Debug temporal - mostrar qué llega del polling
          console.log('🔍 Datos del polling:', data);
          
          const messagesFromServer: string[] = Array.isArray(data.messages)
            ? data.messages
            : (typeof data.message === 'string' ? [data.message] : []);

          // Procesar mensajes especiales del sistema (p.ej. '/delete')
          if (messagesFromServer.some(m => m === '/delete') || data.timeout === true) {
            console.log('🧹 Recibido /delete: mostrando mensaje de timeout en chat');
            // Limpiar chat automáticamente y mostrar mensaje de timeout
            setMessages([]);
            setTurn(1);
            const timeoutMessage: Message = {
              id: uuidv4(),
              content: 'tiempo limite de inactividad: iniciar nuevo chat',
              isUser: false,
              timestamp: new Date()
            };
            setMessages([timeoutMessage]);
            setChatState(prev => ({ ...prev, isTyping: false, isTimedOut: false }));
            // Detener polling
            clearInterval(interval);
            setPollingInterval(null);
            setIsWaitingResponse(false);
            return;
          }

          if (messagesFromServer.length > 0) {
            const firstMsg = messagesFromServer[0];
            console.log('✅ Respuesta recibida:', firstMsg);
            console.log('✅ Respuesta recibida:', data.message);
            
            // Mostrar "escribiendo..." por 1 segundo antes de mostrar el mensaje
            setChatState(prev => ({ ...prev, isTyping: true }));
            
            // Simular escritura por 1 segundo
            await new Promise(resolve => setTimeout(resolve, 1000));

            const newBotMessages: Message[] = messagesFromServer.map(msg => ({
              id: uuidv4(),
              content: msg,
              isUser: false,
              timestamp: new Date()
            }));

            setMessages(prev => [...prev, ...newBotMessages]);
            setTurn(prev => prev + 1);
            setChatState(prev => ({ ...prev, isTyping: false }));
            
            // NO detener el polling inmediatamente, continuar escuchando por más respuestas
            // Resetear el contador para dar más tiempo a respuestas adicionales
            pollCount = Math.max(0, pollCount - 20); // Dar más tiempo extra
            inactivityCount = 0; // Reset inactivity counter
            return;
          } else {
            // No hay respuesta, incrementar contador de inactividad
            inactivityCount++;
          }
        } else {
          console.warn(`⚠️ Poll ${pollCount} falló:`, response.status);
          inactivityCount++;
        }

        // Stop polling si ha habido mucha inactividad (la IA terminó de responder)
        if (inactivityCount >= maxInactivity) {
          console.log(`✅ Finalizando polling - ${maxInactivity} polls sin respuesta`);
          clearInterval(interval);
          setPollingInterval(null);
          setIsWaitingResponse(false);
          setChatState(prev => ({ ...prev, isTyping: false }));
          return;
        }

        // Stop polling if max attempts reached
        if (pollCount >= maxPolls) {
          console.error(`❌ Timeout para sesión ${sessionId}`);
          clearInterval(interval);
          setPollingInterval(null);
          setIsWaitingResponse(false);
          setChatState(prev => ({ 
            ...prev, 
            isTyping: false, 
            error: 'Tiempo de espera agotado. El agente no respondió.',
            isTimedOut: false
          }));
        }
      } catch (error) {
        console.error('💥 Error en polling:', error);
        // No detener polling por errores de red temporales
      }
    }, 2000); // Poll every 2 seconds

    setPollingInterval(interval);
  };

  const clearChat = async () => {
    // Clear chat immediately
    setMessages([]);
    setTurn(1);
    setIsWaitingResponse(false);
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
    setChatState({ isTyping: false, error: null, isLoading: false, isTimedOut: false });

    // Send delete command to server
    try {
      const payload = {
        agent_id: agentConfig.id,
        session_id: sessionId,
        msg_id: uuidv4(),
        turn: 1,
        message: "/delete"
      };

      await fetch(agentConfig.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000)
      });
    } catch (error) {
      console.error('Error clearing server history:', error);
    }
  };

  const startNewConversation = () => {
    console.log('🔄 Iniciando nueva conversación tras timeout');
    // Limpiar estado local (mensajes ya están limpios, solo resetear estado)
    setTurn(1);
    setIsWaitingResponse(false);
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
    setChatState({ isTyping: false, error: null, isLoading: false, isTimedOut: false });

    // Enfocar el input para nueva conversación
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue);
    // Mantener foco en el input después de enviar
    setTimeout(() => {
      inputRef.current?.focus();
    }, 10);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
      // Mantener foco en el input después de enviar
      setTimeout(() => {
        inputRef.current?.focus();
      }, 10);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white/70 dark:bg-slate-800/70 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 dark:border-slate-700/50 overflow-hidden relative">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-500 to-secondary-500 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <img 
            src={agentConfig.avatarPath} 
            alt={agentConfig.name}
            className="w-8 h-8 rounded-full bg-white/20 p-1"
          />
          <div>
            <h3 className="font-semibold text-white">{agentConfig.name}</h3>
            <p className="text-primary-100 text-sm">Agente de IA disponible 24/7</p>
          </div>
        </div>
        <button
          onClick={clearChat}
          className="p-2 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors"
          title="Limpiar chat"
          aria-label="Limpiar historial del chat"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="h-96 overflow-y-auto p-4 space-y-4 relative">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <img 
              src={agentConfig.avatarPath} 
              alt={agentConfig.name}
              className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary-100 to-secondary-100 p-2"
            />
            <p className="text-slate-600 dark:text-slate-400">
              ¡Hola! Soy tu asistente de {agentConfig.name.toLowerCase()}. ¿En qué puedo ayudarte?
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                message.isUser
                  ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-br-sm'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-bl-sm'
              }`}
            >
              <p className={`text-sm leading-relaxed ${
                message.isUser ? 'text-right' : 'text-left'
              }`}>{message.content}</p>
              <p className={`text-xs mt-1 text-right ${
                message.isUser ? 'text-primary-100' : 'text-slate-500 dark:text-slate-400'
              }`}>
                {message.timestamp.toLocaleTimeString('es-ES', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </p>
            </div>
          </div>
        ))}

        {chatState.isTyping && (
          <div className="flex justify-start">
            <div className="bg-slate-100 dark:bg-slate-700 rounded-2xl rounded-bl-sm px-4 py-2 flex items-center space-x-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">escribiendo...</span>
            </div>
          </div>
        )}

        {chatState.error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <p className="text-red-700 dark:text-red-400 text-sm">{chatState.error}</p>
            <button
              onClick={() => setChatState(prev => ({ ...prev, error: null }))}
              className="text-red-600 dark:text-red-400 text-xs underline mt-1"
            >
              Cerrar
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>


      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-slate-200 dark:border-slate-700">
        <div className="flex space-x-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Escribe tu mensaje..."
            disabled={chatState.isLoading}
            className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Mensaje del chat"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || chatState.isLoading}
            className="px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 disabled:from-slate-300 disabled:to-slate-400 text-white rounded-xl transition-all duration-200 disabled:cursor-not-allowed min-h-12 min-w-12 flex items-center justify-center"
            aria-label="Enviar mensaje"
          >
            {chatState.isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </form>

      {/* Start New Chat Button - shown when timeout message is present */}
      {messages.length > 0 && messages[messages.length - 1].content === 'tiempo limite de inactividad: iniciar nuevo chat' && (
        <div className="p-4 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={startNewConversation}
            className="w-full px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-lg font-medium transition-all duration-200"
          >
            Iniciar nuevo chat
          </button>
        </div>
      )}
    </div>
  );
};

export default Chat;
