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
  const [pendingMessageId, setPendingMessageId] = useState<string | null>(null);
  const [chatState, setChatState] = useState<ChatState>({
    isTyping: false,
    error: null,
    isLoading: false
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

  const sendMessage = async (content: string) => {
    if (!content.trim() || chatState.isLoading || pendingMessageId) {
      console.log('⚠️ Mensaje bloqueado:', { 
        loading: chatState.isLoading, 
        pending: pendingMessageId,
        content: content.trim() 
      });
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
    setPendingMessageId(messageId);
    setChatState(prev => ({ ...prev, isLoading: true, error: null }));

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
      setChatState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    try {
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
        msg_id: messageId,
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

      setChatState(prev => ({ ...prev, isTyping: true }));

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

      const responseText = await response.text();
      console.log('✅ Webhook enviado exitosamente:', responseText);
      // Always surface the raw webhook response for debugging
      setMessages(prev => [
        ...prev,
        {
          id: uuidv4(),
          content: `WEBHOOK RAW (${response.status} ${response.statusText}):\n${responseText.substring(0, 2000)}`,
          isUser: false,
          timestamp: new Date()
        }
      ]);

      // Intentar respuesta síncrona
      let immediateMessage: string | null = null;
      try {
        const parsed = JSON.parse(responseText);
        if (parsed && typeof parsed === 'object') {
          if (typeof parsed.message === 'string') {
            immediateMessage = parsed.message as string;
          } else if (parsed.data && typeof parsed.data.message === 'string') {
            immediateMessage = parsed.data.message as string;
          }
        }
      } catch {
        // Ignorar si no es JSON
      }

      if (immediateMessage) {
        // Mostrar respuesta directa del webhook
        await new Promise(resolve => setTimeout(resolve, 800));
        const botMessage: Message = {
          id: uuidv4(),
          content: immediateMessage,
          isUser: false,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, botMessage]);
        setTurn(prev => prev + 1);
        setPendingMessageId(null);
        setChatState(prev => ({ ...prev, isTyping: false, isLoading: false }));
      } else if (callbackUrl) {
        // Fallback a polling si existe endpoint de callback
        startPollingForResponse(messageId, callbackUrl);
        setChatState(prev => ({ ...prev, isLoading: false }));
      } else {
        // No hay respuesta síncrona ni endpoint de callback
        setPendingMessageId(null);
        setChatState(prev => ({ 
          ...prev, 
          isTyping: false,
          isLoading: false,
          error: 'El webhook no devolvió respuesta inmediata y no hay endpoint de callback configurado.'
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

      setPendingMessageId(null);
      setChatState(prev => ({ ...prev, error: errorMessage, isLoading: false, isTyping: false }));
    }
  };

  // Polling para obtener respuestas pendientes
  const startPollingForResponse = (messageId: string, baseUrl?: string) => {
    let pollCount = 0;
    const maxPolls = 60; // Máximo 60 polls (2 minutos)
    
    const pollInterval = setInterval(async () => {
      pollCount++;
      console.log(`🔄 Polling ${pollCount}/${maxPolls} para mensaje ${messageId}`);
      
      try {
        const pollUrl = baseUrl 
          ? `${baseUrl}?session_id=${encodeURIComponent(sessionId)}&msg_id=${encodeURIComponent(messageId)}`
          : `/api/chat-response?session_id=${sessionId}&msg_id=${messageId}`;
        const response = await fetch(pollUrl + '&debug=1', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        });

        if (response.ok) {
          const data = await response.json();
          
          if (data.message) {
            console.log('✅ Respuesta recibida:', data.message);
            
            // Simulate typing delay for realism
            await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

            const botMessage: Message = {
              id: uuidv4(),
              content: data.message,
              isUser: false,
              timestamp: new Date()
            };

            setMessages(prev => [...prev, botMessage]);
            setTurn(prev => prev + 1);
            setPendingMessageId(null);
            setChatState(prev => ({ ...prev, isTyping: false }));
            
            clearInterval(pollInterval);
            return;
          }
          // Si no hay message pero hay debug, muéstralo una sola vez al inicio
          if (pollCount === 1 && data.debug) {
            const debugPreview = JSON.stringify(data.debug, null, 2).slice(0, 800);
            const dbg: Message = {
              id: uuidv4(),
              content: `DEBUG (callback pending):\n${debugPreview}`,
              isUser: false,
              timestamp: new Date()
            };
            setMessages(prev => [...prev, dbg]);
          }
        } else {
          console.warn(`⚠️ Poll ${pollCount} falló:`, response.status);
          try {
            const text = await response.text();
            setMessages(prev => [
              ...prev,
              {
                id: uuidv4(),
                content: `POLL ERROR (${response.status} ${response.statusText}):\n${text.substring(0, 1000)}`,
                isUser: false,
                timestamp: new Date()
              }
            ]);
          } catch {}
        }

        // Stop polling if max attempts reached
        if (pollCount >= maxPolls) {
          console.error('❌ Máximo de intentos de polling alcanzado');
          clearInterval(pollInterval);
          setPendingMessageId(null);
          setChatState(prev => ({ 
            ...prev, 
            isTyping: false, 
            error: 'Tiempo de espera agotado. El agente no respondió.' 
          }));
        }
      } catch (error) {
        console.error('💥 Error en polling:', error);
      }
    }, 2000); // Poll every 2 seconds
  };

  const clearChat = async () => {
    // Clear chat immediately
    setMessages([]);
    setTurn(1);
    setPendingMessageId(null);
    setChatState({ isTyping: false, error: null, isLoading: false });

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white/70 dark:bg-slate-800/70 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 dark:border-slate-700/50 overflow-hidden">
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
      <div className="h-96 overflow-y-auto p-4 space-y-4">
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
              <p className="text-sm leading-relaxed">{message.content}</p>
              <p className={`text-xs mt-1 ${
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
    </div>
  );
};

export default Chat;
