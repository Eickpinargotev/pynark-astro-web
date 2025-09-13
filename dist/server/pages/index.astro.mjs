/* empty css                               */
import { e as createComponent, k as renderComponent, r as renderTemplate, m as maybeRenderHead, l as renderScript } from '../chunks/astro/server_CX0crnCc.mjs';
import 'kleur/colors';
import { $ as $$Layout } from '../chunks/Layout_B0B0UClq.mjs';
import { jsxs, jsx } from 'react/jsx-runtime';
import { useState, useRef, useEffect } from 'react';
import { Trash2, Loader2, Send, ChevronLeft } from 'lucide-react';
import { v4 } from 'uuid';
/* empty css                                 */
export { renderers } from '../renderers.mjs';

const Chat = ({ agentConfig }) => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [sessionId] = useState(() => v4());
  const [turn, setTurn] = useState(1);
  const [pendingMessageId, setPendingMessageId] = useState(null);
  const [chatState, setChatState] = useState({
    isTyping: false,
    error: null,
    isLoading: false
  });
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };
  useEffect(() => {
    if (messages.length > 0 || chatState.isTyping) {
      scrollToBottom();
    }
  }, [messages, chatState.isTyping]);
  const sendMessage = async (content) => {
    if (!content.trim() || chatState.isLoading || pendingMessageId) {
      console.log("⚠️ Mensaje bloqueado:", {
        loading: chatState.isLoading,
        pending: pendingMessageId,
        content: content.trim()
      });
      return;
    }
    const messageId = v4();
    const userMessage = {
      id: messageId,
      content: content.trim(),
      isUser: true,
      timestamp: /* @__PURE__ */ new Date()
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setPendingMessageId(messageId);
    setChatState((prev) => ({ ...prev, isLoading: true, error: null }));
    if (messages.length >= agentConfig.maxHistory) {
      setMessages([]);
      setTurn(1);
      const resetMessage = {
        id: v4(),
        content: agentConfig.resetMessage,
        isUser: false,
        timestamp: /* @__PURE__ */ new Date()
      };
      setMessages([resetMessage]);
      setChatState((prev) => ({ ...prev, isLoading: false }));
      return;
    }
    try {
      const getLocalIP = async () => {
        try {
          const pc = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
          });
          const dc = pc.createDataChannel("");
          return new Promise((resolve) => {
            pc.onicecandidate = (ice) => {
              if (ice && ice.candidate && ice.candidate.candidate) {
                const candidate = ice.candidate.candidate;
                const match = candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/);
                if (match && !match[0].startsWith("127.") && !match[0].startsWith("169.254.")) {
                  resolve(match[0]);
                  pc.close();
                }
              }
            };
            pc.createOffer().then((offer) => pc.setLocalDescription(offer));
            setTimeout(() => {
              resolve("127.0.0.1");
              pc.close();
            }, 2e3);
          });
        } catch (error) {
          console.warn("No se pudo obtener IP local:", error);
          return "127.0.0.1";
        }
      };
      let callbackUrl = agentConfig.responseUrl ?? null;
      if (!callbackUrl) {
        callbackUrl = `${window.location.origin}/api/chat-response`;
      }
      const payload = {
        agent_id: agentConfig.id,
        session_id: sessionId,
        msg_id: messageId,
        turn,
        message: content.trim()
      };
      if (callbackUrl) {
        payload.response_url = callbackUrl;
      }
      console.log("🚀 Enviando mensaje a n8n:", {
        webhook: agentConfig.webhookUrl,
        method: "POST",
        payload
      });
      setChatState((prev) => ({ ...prev, isTyping: true }));
      console.log("🔍 Probando conectividad del webhook...");
      const response = await fetch(agentConfig.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "User-Agent": "Pynark-Chat/1.0"
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(1e4)
        // Aumentar timeout para debugging
      });
      console.log("📨 Respuesta del webhook:", {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Error del webhook:", errorText);
        throw new Error(`Error del servidor: ${response.status} - ${errorText}`);
      }
      const responseText = await response.text();
      console.log("✅ Webhook enviado exitosamente:", responseText);
      setMessages((prev) => [
        ...prev,
        {
          id: v4(),
          content: `WEBHOOK RAW (${response.status} ${response.statusText}):
${responseText.substring(0, 2e3)}`,
          isUser: false,
          timestamp: /* @__PURE__ */ new Date()
        }
      ]);
      let immediateMessage = null;
      try {
        const parsed = JSON.parse(responseText);
        if (parsed && typeof parsed === "object") {
          if (typeof parsed.message === "string") {
            immediateMessage = parsed.message;
          } else if (parsed.data && typeof parsed.data.message === "string") {
            immediateMessage = parsed.data.message;
          }
        }
      } catch {
      }
      if (immediateMessage) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        const botMessage = {
          id: v4(),
          content: immediateMessage,
          isUser: false,
          timestamp: /* @__PURE__ */ new Date()
        };
        setMessages((prev) => [...prev, botMessage]);
        setTurn((prev) => prev + 1);
        setPendingMessageId(null);
        setChatState((prev) => ({ ...prev, isTyping: false, isLoading: false }));
      } else if (callbackUrl) {
        startPollingForResponse(messageId, callbackUrl);
        setChatState((prev) => ({ ...prev, isLoading: false }));
      } else {
        setPendingMessageId(null);
        setChatState((prev) => ({
          ...prev,
          isTyping: false,
          isLoading: false,
          error: "El webhook no devolvió respuesta inmediata y no hay endpoint de callback configurado."
        }));
      }
    } catch (error) {
      console.error("💥 Error enviando mensaje:", error);
      let errorMessage = "Error desconocido. Por favor, intenta de nuevo.";
      if (error instanceof Error) {
        if (error.name === "TimeoutError") {
          errorMessage = "Tiempo de espera agotado. El webhook de n8n no respondió.";
        } else if (error.message.includes("Failed to fetch")) {
          errorMessage = "Error de conexión. Verifica que n8n esté funcionando.";
        } else if (error.message.includes("NetworkError")) {
          errorMessage = "Error de red. Verifica tu conexión a internet.";
        } else if (error.message.includes("CORS")) {
          errorMessage = "Error de CORS. Configura n8n para permitir requests desde este dominio.";
        } else {
          errorMessage = `Error: ${error.message}`;
        }
      }
      setPendingMessageId(null);
      setChatState((prev) => ({ ...prev, error: errorMessage, isLoading: false, isTyping: false }));
    }
  };
  const startPollingForResponse = (messageId, baseUrl) => {
    let pollCount = 0;
    const maxPolls = 60;
    const pollInterval = setInterval(async () => {
      pollCount++;
      console.log(`🔄 Polling ${pollCount}/${maxPolls} para mensaje ${messageId}`);
      try {
        const pollUrl = baseUrl ? `${baseUrl}?session_id=${encodeURIComponent(sessionId)}&msg_id=${encodeURIComponent(messageId)}` : `/api/chat-response?session_id=${sessionId}&msg_id=${messageId}`;
        const response = await fetch(pollUrl + "&debug=1", {
          method: "GET",
          headers: {
            "Content-Type": "application/json"
          }
        });
        if (response.ok) {
          const data = await response.json();
          if (data.message) {
            console.log("✅ Respuesta recibida:", data.message);
            await new Promise((resolve) => setTimeout(resolve, 1e3 + Math.random() * 1e3));
            const botMessage = {
              id: v4(),
              content: data.message,
              isUser: false,
              timestamp: /* @__PURE__ */ new Date()
            };
            setMessages((prev) => [...prev, botMessage]);
            setTurn((prev) => prev + 1);
            setPendingMessageId(null);
            setChatState((prev) => ({ ...prev, isTyping: false }));
            clearInterval(pollInterval);
            return;
          }
          if (pollCount === 1 && data.debug) {
            const debugPreview = JSON.stringify(data.debug, null, 2).slice(0, 800);
            const dbg = {
              id: v4(),
              content: `DEBUG (callback pending):
${debugPreview}`,
              isUser: false,
              timestamp: /* @__PURE__ */ new Date()
            };
            setMessages((prev) => [...prev, dbg]);
          }
        } else {
          console.warn(`⚠️ Poll ${pollCount} falló:`, response.status);
          try {
            const text = await response.text();
            setMessages((prev) => [
              ...prev,
              {
                id: v4(),
                content: `POLL ERROR (${response.status} ${response.statusText}):
${text.substring(0, 1e3)}`,
                isUser: false,
                timestamp: /* @__PURE__ */ new Date()
              }
            ]);
          } catch {
          }
        }
        if (pollCount >= maxPolls) {
          console.error("❌ Máximo de intentos de polling alcanzado");
          clearInterval(pollInterval);
          setPendingMessageId(null);
          setChatState((prev) => ({
            ...prev,
            isTyping: false,
            error: "Tiempo de espera agotado. El agente no respondió."
          }));
        }
      } catch (error) {
        console.error("💥 Error en polling:", error);
      }
    }, 2e3);
  };
  const clearChat = async () => {
    setMessages([]);
    setTurn(1);
    setPendingMessageId(null);
    setChatState({ isTyping: false, error: null, isLoading: false });
    try {
      const payload = {
        agent_id: agentConfig.id,
        session_id: sessionId,
        msg_id: v4(),
        turn: 1,
        message: "/delete"
      };
      await fetch(agentConfig.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5e3)
      });
    } catch (error) {
      console.error("Error clearing server history:", error);
    }
  };
  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(inputValue);
  };
  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  };
  return /* @__PURE__ */ jsxs("div", { className: "max-w-2xl mx-auto bg-white/70 dark:bg-slate-800/70 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 dark:border-slate-700/50 overflow-hidden", children: [
    /* @__PURE__ */ jsxs("div", { className: "bg-gradient-to-r from-primary-500 to-secondary-500 px-6 py-4 flex items-center justify-between", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center space-x-3", children: [
        /* @__PURE__ */ jsx(
          "img",
          {
            src: agentConfig.avatarPath,
            alt: agentConfig.name,
            className: "w-8 h-8 rounded-full bg-white/20 p-1"
          }
        ),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("h3", { className: "font-semibold text-white", children: agentConfig.name }),
          /* @__PURE__ */ jsx("p", { className: "text-primary-100 text-sm", children: "Agente de IA disponible 24/7" })
        ] })
      ] }),
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: clearChat,
          className: "p-2 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors",
          title: "Limpiar chat",
          "aria-label": "Limpiar historial del chat",
          children: /* @__PURE__ */ jsx(Trash2, { className: "w-4 h-4" })
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "h-96 overflow-y-auto p-4 space-y-4", children: [
      messages.length === 0 && /* @__PURE__ */ jsxs("div", { className: "text-center py-8", children: [
        /* @__PURE__ */ jsx(
          "img",
          {
            src: agentConfig.avatarPath,
            alt: agentConfig.name,
            className: "w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary-100 to-secondary-100 p-2"
          }
        ),
        /* @__PURE__ */ jsxs("p", { className: "text-slate-600 dark:text-slate-400", children: [
          "¡Hola! Soy tu asistente de ",
          agentConfig.name.toLowerCase(),
          ". ¿En qué puedo ayudarte?"
        ] })
      ] }),
      messages.map((message) => /* @__PURE__ */ jsx(
        "div",
        {
          className: `flex ${message.isUser ? "justify-end" : "justify-start"}`,
          children: /* @__PURE__ */ jsxs(
            "div",
            {
              className: `max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${message.isUser ? "bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-br-sm" : "bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-bl-sm"}`,
              children: [
                /* @__PURE__ */ jsx("p", { className: "text-sm leading-relaxed", children: message.content }),
                /* @__PURE__ */ jsx("p", { className: `text-xs mt-1 ${message.isUser ? "text-primary-100" : "text-slate-500 dark:text-slate-400"}`, children: message.timestamp.toLocaleTimeString("es-ES", {
                  hour: "2-digit",
                  minute: "2-digit"
                }) })
              ]
            }
          )
        },
        message.id
      )),
      chatState.isTyping && /* @__PURE__ */ jsx("div", { className: "flex justify-start", children: /* @__PURE__ */ jsxs("div", { className: "bg-slate-100 dark:bg-slate-700 rounded-2xl rounded-bl-sm px-4 py-2 flex items-center space-x-2", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex space-x-1", children: [
          /* @__PURE__ */ jsx("div", { className: "w-2 h-2 bg-slate-400 rounded-full animate-bounce" }),
          /* @__PURE__ */ jsx("div", { className: "w-2 h-2 bg-slate-400 rounded-full animate-bounce", style: { animationDelay: "0.1s" } }),
          /* @__PURE__ */ jsx("div", { className: "w-2 h-2 bg-slate-400 rounded-full animate-bounce", style: { animationDelay: "0.2s" } })
        ] }),
        /* @__PURE__ */ jsx("span", { className: "text-xs text-slate-500 dark:text-slate-400", children: "escribiendo..." })
      ] }) }),
      chatState.error && /* @__PURE__ */ jsxs("div", { className: "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3", children: [
        /* @__PURE__ */ jsx("p", { className: "text-red-700 dark:text-red-400 text-sm", children: chatState.error }),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => setChatState((prev) => ({ ...prev, error: null })),
            className: "text-red-600 dark:text-red-400 text-xs underline mt-1",
            children: "Cerrar"
          }
        )
      ] }),
      /* @__PURE__ */ jsx("div", { ref: messagesEndRef })
    ] }),
    /* @__PURE__ */ jsx("form", { onSubmit: handleSubmit, className: "p-4 border-t border-slate-200 dark:border-slate-700", children: /* @__PURE__ */ jsxs("div", { className: "flex space-x-2", children: [
      /* @__PURE__ */ jsx(
        "input",
        {
          ref: inputRef,
          type: "text",
          value: inputValue,
          onChange: (e) => setInputValue(e.target.value),
          onKeyDown: handleKeyPress,
          placeholder: "Escribe tu mensaje...",
          disabled: chatState.isLoading,
          className: "flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed",
          "aria-label": "Mensaje del chat"
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "submit",
          disabled: !inputValue.trim() || chatState.isLoading,
          className: "px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 disabled:from-slate-300 disabled:to-slate-400 text-white rounded-xl transition-all duration-200 disabled:cursor-not-allowed min-h-12 min-w-12 flex items-center justify-center",
          "aria-label": "Enviar mensaje",
          children: chatState.isLoading ? /* @__PURE__ */ jsx(Loader2, { className: "w-4 h-4 animate-spin" }) : /* @__PURE__ */ jsx(Send, { className: "w-4 h-4" })
        }
      )
    ] }) })
  ] });
};

const chatDemos = [
  {
    id: "inventario-pagos",
    title: "Inventario y pagos",
    messages: [
      { content: "¿Tienen disponible la cafetera modelo X?", isUser: true },
      { content: "Sí, contamos con 5 en inventario. Puedes pagar en efectivo, tarjeta o transferencia.", isUser: false },
      { content: "Perfecto, la quiero con pago por tarjeta.", isUser: true },
      { content: "Listo, he reservado tu cafetera y actualizado el inventario.", isUser: false }
    ]
  },
  {
    id: "precios-dinamicos",
    title: "Precios dinámicos",
    messages: [
      { content: "¿Cuánto cuesta la pizza familiar si pago con tarjeta?", isUser: true },
      { content: "Con tarjeta el precio es $180, en efectivo serían $170.", isUser: false },
      { content: "Entonces la pido con efectivo.", isUser: true },
      { content: "Perfecto, registré tu pedido con el precio de $170.", isUser: false }
    ]
  },
  {
    id: "quejas-reportes",
    title: "Quejas y reportes",
    messages: [
      { content: "La entrega llegó fría y tarde.", isUser: true },
      { content: "Lamento mucho la experiencia. He generado un reporte automático para administración.", isUser: false },
      { content: "Gracias, espero mejor atención la próxima.", isUser: true },
      { content: "Claro que sí, tu comentario ayudará a mejorar nuestro servicio.", isUser: false }
    ]
  },
  {
    id: "alertas-atencion",
    title: "Alertas de atención",
    messages: [
      { content: "Quiero cancelar mi pedido y pedir reembolso.", isUser: true },
      { content: "Entiendo, este caso requiere atención especial. He enviado una alerta a tu administrador en Telegram.", isUser: false },
      { content: "Ah perfecto, esperaré la respuesta.", isUser: true },
      { content: "Gracias por tu paciencia, pronto te contactarán.", isUser: false }
    ]
  },
  {
    id: "faq-negocio",
    title: "FAQ del negocio",
    messages: [
      { content: "¿Dónde están ubicados y cuál es su horario?", isUser: true },
      { content: "Estamos en Av. Central 123 y abrimos de 9 am a 9 pm, todos los días.", isUser: false },
      { content: "¿Y qué garantía tienen los productos?", isUser: true },
      { content: "Todos cuentan con garantía de 30 días por defectos de fábrica.", isUser: false }
    ]
  }
];
const ChatSimulation = ({ className = "" }) => {
  const [selectedDemo, setSelectedDemo] = useState(0);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const [showButtons, setShowButtons] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isUserTyping, setIsUserTyping] = useState(false);
  const [currentInputText, setCurrentInputText] = useState("");
  const activeTimersRef = useRef([]);
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) {
        setShowButtons(false);
      } else {
        setShowButtons(true);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const sectionRef = useRef(null);
  const messagesEndRef = useRef(null);
  const clearAllTimers = () => {
    activeTimersRef.current.forEach((timer) => clearTimeout(timer));
    activeTimersRef.current = [];
  };
  const addTimer = (timer) => {
    activeTimersRef.current.push(timer);
    return timer;
  };
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      {
        threshold: 0.5,
        // Require more visibility before starting animation
        rootMargin: "0px 0px -100px 0px"
        // Only trigger when well into viewport
      }
    );
    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, []);
  useEffect(() => {
    if (isVisible && isPlaying && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [currentMessageIndex, isTyping, isVisible, isPlaying]);
  useEffect(() => {
    if (!isPlaying) return;
    console.log("Simulation running:", { selectedDemo, currentMessageIndex, isVisible, isPlaying });
    const currentDemo2 = chatDemos[selectedDemo];
    if (currentMessageIndex >= currentDemo2.messages.length) {
      const restartTimer = addTimer(setTimeout(() => {
        setCurrentMessageIndex(0);
        setCurrentInputText("");
        setIsUserTyping(false);
        setIsTyping(false);
      }, 3e3));
      return () => clearTimeout(restartTimer);
    }
    const currentMessage = currentDemo2.messages[currentMessageIndex];
    const isUserMessage = currentMessage.isUser;
    if (isUserMessage) {
      setCurrentInputText("");
      setIsUserTyping(false);
      setIsTyping(false);
      const startTypingTimer = addTimer(setTimeout(() => {
        setIsUserTyping(true);
        const message = currentMessage.content;
        let charIndex = 0;
        const typeMessage = () => {
          if (charIndex < message.length) {
            setCurrentInputText(message.substring(0, charIndex + 1));
            charIndex++;
            addTimer(setTimeout(typeMessage, 50 + Math.random() * 50));
          } else {
            addTimer(setTimeout(() => {
              setCurrentInputText("");
              setIsUserTyping(false);
              setCurrentMessageIndex((prev) => prev + 1);
            }, 800));
          }
        };
        typeMessage();
      }, 1e3));
      return () => clearTimeout(startTypingTimer);
    } else {
      setCurrentInputText("");
      setIsUserTyping(false);
      setIsTyping(true);
      const typingTimer = addTimer(setTimeout(() => {
        setIsTyping(false);
        setCurrentMessageIndex((prev) => prev + 1);
      }, 1500 + Math.random() * 1e3));
      return () => clearTimeout(typingTimer);
    }
  }, [selectedDemo, currentMessageIndex, isVisible, isPlaying]);
  const handleDemoSelect = (index) => {
    setIsPlaying(false);
    clearAllTimers();
    setCurrentInputText("");
    setIsUserTyping(false);
    setIsTyping(false);
    setCurrentMessageIndex(0);
    setSelectedDemo(index);
    const restartTimer = setTimeout(() => {
      setIsPlaying(true);
    }, 200);
    activeTimersRef.current = [restartTimer];
    if (isMobile) {
      setShowButtons(false);
    }
  };
  const toggleButtons = () => {
    setShowButtons(!showButtons);
  };
  const currentDemo = chatDemos[selectedDemo];
  const visibleMessages = currentDemo.messages.slice(0, currentMessageIndex);
  console.log("Render debug:", {
    selectedDemo,
    currentMessageIndex,
    totalMessages: currentDemo.messages.length,
    visibleCount: visibleMessages.length,
    isVisible,
    isPlaying
  });
  return /* @__PURE__ */ jsx("div", { ref: sectionRef, className: `relative ${className}`, children: /* @__PURE__ */ jsxs("div", { className: "flex flex-col lg:flex-row gap-6 relative", children: [
    /* @__PURE__ */ jsx("div", { className: "flex-1", children: /* @__PURE__ */ jsxs("div", { className: "bg-white/70 dark:bg-slate-800/70 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 dark:border-slate-700/50 overflow-hidden", children: [
      /* @__PURE__ */ jsx("div", { className: "bg-gradient-to-r from-primary-500 to-secondary-500 px-6 py-4 flex items-center justify-between", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center space-x-3", children: [
        /* @__PURE__ */ jsx(
          "img",
          {
            src: "/assets/pynark_favicon.png",
            alt: "Pynark Agent",
            className: "w-8 h-8 rounded-full bg-white/20 p-1"
          }
        ),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("h3", { className: "font-semibold text-white", children: "Agente E-commerce" }),
          /* @__PURE__ */ jsxs("p", { className: "text-primary-100 text-sm", children: [
            "Simulación: ",
            currentDemo.title
          ] })
        ] })
      ] }) }),
      /* @__PURE__ */ jsxs("div", { className: "h-80 overflow-y-auto p-4 space-y-4", children: [
        visibleMessages.map((message, index) => /* @__PURE__ */ jsx(
          "div",
          {
            className: `flex ${message.isUser ? "justify-end" : "justify-start"} animate-fade-in`,
            children: /* @__PURE__ */ jsx(
              "div",
              {
                className: `max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${message.isUser ? "bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-br-sm" : "bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-bl-sm"}`,
                children: /* @__PURE__ */ jsx("p", { className: "text-sm leading-relaxed", children: message.content })
              }
            )
          },
          `${selectedDemo}-${index}`
        )),
        isTyping && /* @__PURE__ */ jsx("div", { className: "flex justify-start animate-fade-in", children: /* @__PURE__ */ jsxs("div", { className: "bg-slate-100 dark:bg-slate-700 rounded-2xl rounded-bl-sm px-4 py-2 flex items-center space-x-2", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex space-x-1", children: [
            /* @__PURE__ */ jsx("div", { className: "w-2 h-2 bg-slate-400 rounded-full animate-bounce" }),
            /* @__PURE__ */ jsx("div", { className: "w-2 h-2 bg-slate-400 rounded-full animate-bounce", style: { animationDelay: "0.1s" } }),
            /* @__PURE__ */ jsx("div", { className: "w-2 h-2 bg-slate-400 rounded-full animate-bounce", style: { animationDelay: "0.2s" } })
          ] }),
          /* @__PURE__ */ jsx("span", { className: "text-xs text-slate-500 dark:text-slate-400", children: "escribiendo..." })
        ] }) }),
        /* @__PURE__ */ jsx("div", { ref: messagesEndRef })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "p-4 border-t border-slate-200 dark:border-slate-700", children: /* @__PURE__ */ jsxs("div", { className: "flex space-x-2", children: [
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "text",
            value: currentInputText,
            placeholder: "",
            disabled: true,
            className: `flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl ${isUserTyping ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" : "bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400"} cursor-not-allowed`
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            disabled: true,
            className: `px-4 py-2 rounded-xl cursor-not-allowed min-h-12 min-w-12 flex items-center justify-center transition-colors ${isUserTyping && currentInputText.length > 0 ? "bg-gradient-to-r from-primary-500 to-primary-600 text-white" : "bg-slate-300 dark:bg-slate-600 text-slate-500 dark:text-slate-400"}`,
            children: /* @__PURE__ */ jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M12 19l9 2-9-18-9 18 9-2zm0 0v-8" }) })
          }
        )
      ] }) })
    ] }) }),
    showButtons && /* @__PURE__ */ jsx(
      "div",
      {
        className: "lg:hidden fixed inset-0 bg-black/20 backdrop-blur-sm z-40",
        onClick: () => setShowButtons(false)
      }
    ),
    /* @__PURE__ */ jsxs("div", { className: "lg:w-64 lg:relative", children: [
      !showButtons && isMobile && /* @__PURE__ */ jsx(
        "button",
        {
          onClick: toggleButtons,
          className: "absolute right-0 top-1/2 -translate-y-1/2 z-30 bg-white/30 dark:bg-slate-800/30 backdrop-blur-sm rounded-l-xl shadow-md border border-r-0 border-white/20 dark:border-slate-700/30 p-3 transition-all duration-300 hover:bg-white/50 dark:hover:bg-slate-800/50",
          "aria-label": "Mostrar opciones de chat",
          children: /* @__PURE__ */ jsx(ChevronLeft, { className: "w-5 h-5 text-slate-600/70 dark:text-slate-400/70" })
        }
      ),
      /* @__PURE__ */ jsx("div", { className: `transition-all duration-300 ease-in-out ${showButtons ? "block lg:block" : "hidden lg:block"} ${showButtons ? "absolute top-0 right-0 z-50 w-80 lg:relative lg:w-64" : "lg:relative lg:w-64"}`, children: /* @__PURE__ */ jsxs("div", { className: "bg-white/70 dark:bg-slate-800/70 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 dark:border-slate-700/50 p-4 max-h-96 overflow-y-auto", children: [
        /* @__PURE__ */ jsx("h4", { className: "font-semibold text-slate-900 dark:text-white mb-4", children: "Ejemplos de Casos" }),
        /* @__PURE__ */ jsx("div", { className: "space-y-2", children: chatDemos.map((demo, index) => /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: () => handleDemoSelect(index),
            className: `w-full text-left p-3 rounded-xl transition-all duration-200 ${selectedDemo === index ? "bg-gradient-to-r from-primary-500 to-secondary-500 text-white shadow-lg" : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"}`,
            children: [
              /* @__PURE__ */ jsx("div", { className: "font-medium text-sm", children: demo.title }),
              /* @__PURE__ */ jsxs("div", { className: `text-xs mt-1 ${selectedDemo === index ? "text-primary-100" : "text-slate-500 dark:text-slate-400"}`, children: [
                demo.messages.length,
                " mensajes"
              ] })
            ]
          },
          demo.id
        )) })
      ] }) })
    ] })
  ] }) });
};

const id = "ecomerce_test";
const name = "E-commerce Test";
const webhookUrl = "https://paneln8n.erickpinargote.com/webhook/pynark_ecomerce";
const responseUrl = null;
const avatarPath = "/assets/pynark_favicon.png";
const requestTimeoutMs = 20000;
const maxHistory = 50;
const resetMessage = "Has superado el límite de historial. Empecemos de nuevo…";
const agentConfig = {
  id,
  name,
  webhookUrl,
  responseUrl,
  avatarPath,
  requestTimeoutMs,
  maxHistory,
  resetMessage,
};

const $$Index = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Pynark Automation - Chatbots que Convierten", "data-astro-cid-j7pv25f6": true }, { "default": ($$result2) => renderTemplate`  ${maybeRenderHead()}<section class="py-20 px-4 sm:px-6 lg:px-8" data-astro-cid-j7pv25f6> <div class="max-w-7xl mx-auto text-center" data-astro-cid-j7pv25f6> <h1 class="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 dark:text-white mb-6" data-astro-cid-j7pv25f6>
Chatbots que convierten <br class="hidden sm:block" data-astro-cid-j7pv25f6> <span class="bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent" data-astro-cid-j7pv25f6>
visitas en ventas y citas
</span> </h1> <p class="text-xl text-slate-600 dark:text-slate-300 mb-12 max-w-3xl mx-auto" data-astro-cid-j7pv25f6>
Especialistas en agentes de servicio al cliente que funcionan 24/7 para hacer crecer tu negocio
</p> </div> </section>  <section class="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-primary-50/50 to-secondary-50/50 dark:from-primary-900/10 dark:to-secondary-900/10" data-astro-cid-j7pv25f6> <div class="max-w-7xl mx-auto text-center" data-astro-cid-j7pv25f6> <div id="chat-section" data-astro-cid-j7pv25f6> <button id="show-agents-btn" class="inline-flex items-center px-8 py-4 bg-gradient-to-r from-primary-600 to-secondary-600 hover:from-primary-700 hover:to-secondary-700 text-white font-semibold rounded-2xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300" data-astro-cid-j7pv25f6>
PRUEBA NUESTROS AGENTES
</button> <div id="agent-buttons" class="hidden mt-8 space-y-4" data-astro-cid-j7pv25f6> <button id="ecommerce-btn" class="inline-flex items-center px-6 py-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium rounded-xl shadow-lg hover:shadow-xl border border-slate-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-600 transition-all duration-300" data-astro-cid-j7pv25f6>
E-commerce Test
</button> </div> <div id="chat-container" class="hidden mt-8" data-astro-cid-j7pv25f6> ${renderComponent($$result2, "Chat", Chat, { "client:load": true, "agentConfig": agentConfig, "client:component-hydration": "load", "client:component-path": "C:/Users/User/Desktop/PROYECTOS/Proyecto Pynark V1/src/components/Chat.tsx", "client:component-export": "default", "data-astro-cid-j7pv25f6": true })} </div> </div> </div> </section>  <section class="py-20 px-4 sm:px-6 lg:px-8" data-astro-cid-j7pv25f6> <div class="max-w-7xl mx-auto" data-astro-cid-j7pv25f6> <div class="text-center mb-16" data-astro-cid-j7pv25f6> <h2 class="font-display text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-6" data-astro-cid-j7pv25f6>
Cómo trabajamos
</h2> </div> <div class="relative" data-astro-cid-j7pv25f6> <!-- Timeline line - Desktop --> <div class="hidden md:block absolute left-1/2 transform -translate-x-px h-full w-0.5 bg-gradient-to-b from-primary-400 to-secondary-400" data-astro-cid-j7pv25f6></div> <!-- Timeline line - Mobile --> <div class="md:hidden absolute left-8 top-0 h-full w-0.5 bg-gradient-to-b from-primary-400 to-secondary-400" data-astro-cid-j7pv25f6></div> <!-- Timeline items --> <div class="space-y-12 md:space-y-16" data-astro-cid-j7pv25f6> <!-- Step 1 --> <div class="relative flex items-center" data-astro-cid-j7pv25f6> <!-- Mobile Layout --> <div class="md:hidden flex items-start" data-astro-cid-j7pv25f6> <div class="relative flex items-center justify-center w-12 h-12 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full border-4 border-white dark:border-slate-900 shadow-lg z-10" data-astro-cid-j7pv25f6> <span class="text-white font-bold" data-astro-cid-j7pv25f6>1</span> </div> <div class="ml-6 flex-1" data-astro-cid-j7pv25f6> <div class="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700" data-astro-cid-j7pv25f6> <h3 class="font-display text-xl font-semibold text-slate-900 dark:text-white mb-2" data-astro-cid-j7pv25f6>
Diagnóstico
</h3> <p class="text-slate-600 dark:text-slate-300" data-astro-cid-j7pv25f6>
Sesión de 30-45 minutos para entender tu negocio y necesidades específicas
</p> </div> </div> </div> <!-- Desktop Layout --> <div class="hidden md:flex md:items-center w-full" data-astro-cid-j7pv25f6> <div class="flex-1 pr-8 text-right" data-astro-cid-j7pv25f6> <div class="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700" data-astro-cid-j7pv25f6> <h3 class="font-display text-xl font-semibold text-slate-900 dark:text-white mb-2" data-astro-cid-j7pv25f6>
Diagnóstico
</h3> <p class="text-slate-600 dark:text-slate-300" data-astro-cid-j7pv25f6>
Sesión de 30-45 minutos para entender tu negocio y necesidades específicas
</p> </div> </div> <div class="relative flex items-center justify-center w-12 h-12 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full border-4 border-white dark:border-slate-900 shadow-lg" data-astro-cid-j7pv25f6> <span class="text-white font-bold" data-astro-cid-j7pv25f6>1</span> </div> <div class="flex-1 pl-8" data-astro-cid-j7pv25f6></div> </div> </div> <!-- Step 2 --> <div class="relative flex items-center" data-astro-cid-j7pv25f6> <!-- Mobile Layout --> <div class="md:hidden flex items-start" data-astro-cid-j7pv25f6> <div class="relative flex items-center justify-center w-12 h-12 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full border-4 border-white dark:border-slate-900 shadow-lg z-10" data-astro-cid-j7pv25f6> <span class="text-white font-bold" data-astro-cid-j7pv25f6>2</span> </div> <div class="ml-6 flex-1" data-astro-cid-j7pv25f6> <div class="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700" data-astro-cid-j7pv25f6> <h3 class="font-display text-xl font-semibold text-slate-900 dark:text-white mb-2" data-astro-cid-j7pv25f6>
Setup de vertical
</h3> <p class="text-slate-600 dark:text-slate-300" data-astro-cid-j7pv25f6>
Configuración personalizada del agente en 2-5 días según tu industria
</p> </div> </div> </div> <!-- Desktop Layout --> <div class="hidden md:flex md:items-center w-full" data-astro-cid-j7pv25f6> <div class="flex-1 pr-8" data-astro-cid-j7pv25f6></div> <div class="relative flex items-center justify-center w-12 h-12 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full border-4 border-white dark:border-slate-900 shadow-lg" data-astro-cid-j7pv25f6> <span class="text-white font-bold" data-astro-cid-j7pv25f6>2</span> </div> <div class="flex-1 pl-8" data-astro-cid-j7pv25f6> <div class="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700" data-astro-cid-j7pv25f6> <h3 class="font-display text-xl font-semibold text-slate-900 dark:text-white mb-2" data-astro-cid-j7pv25f6>
Setup de vertical
</h3> <p class="text-slate-600 dark:text-slate-300" data-astro-cid-j7pv25f6>
Configuración personalizada del agente en 2-5 días según tu industria
</p> </div> </div> </div> </div> <!-- Step 3 --> <div class="relative flex items-center" data-astro-cid-j7pv25f6> <!-- Mobile Layout --> <div class="md:hidden flex items-start" data-astro-cid-j7pv25f6> <div class="relative flex items-center justify-center w-12 h-12 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full border-4 border-white dark:border-slate-900 shadow-lg z-10" data-astro-cid-j7pv25f6> <span class="text-white font-bold" data-astro-cid-j7pv25f6>3</span> </div> <div class="ml-6 flex-1" data-astro-cid-j7pv25f6> <div class="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700" data-astro-cid-j7pv25f6> <h3 class="font-display text-xl font-semibold text-slate-900 dark:text-white mb-2" data-astro-cid-j7pv25f6>
Go-live con monitoreo
</h3> <p class="text-slate-600 dark:text-slate-300" data-astro-cid-j7pv25f6>
Lanzamiento con supervisión activa para garantizar el rendimiento óptimo
</p> </div> </div> </div> <!-- Desktop Layout --> <div class="hidden md:flex md:items-center w-full" data-astro-cid-j7pv25f6> <div class="flex-1 pr-8 text-right" data-astro-cid-j7pv25f6> <div class="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700" data-astro-cid-j7pv25f6> <h3 class="font-display text-xl font-semibold text-slate-900 dark:text-white mb-2" data-astro-cid-j7pv25f6>
Go-live con monitoreo
</h3> <p class="text-slate-600 dark:text-slate-300" data-astro-cid-j7pv25f6>
Lanzamiento con supervisión activa para garantizar el rendimiento óptimo
</p> </div> </div> <div class="relative flex items-center justify-center w-12 h-12 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full border-4 border-white dark:border-slate-900 shadow-lg" data-astro-cid-j7pv25f6> <span class="text-white font-bold" data-astro-cid-j7pv25f6>3</span> </div> <div class="flex-1 pl-8" data-astro-cid-j7pv25f6></div> </div> </div> <!-- Step 4 --> <div class="relative flex items-center" data-astro-cid-j7pv25f6> <!-- Mobile Layout --> <div class="md:hidden flex items-start" data-astro-cid-j7pv25f6> <div class="relative flex items-center justify-center w-12 h-12 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full border-4 border-white dark:border-slate-900 shadow-lg z-10" data-astro-cid-j7pv25f6> <span class="text-white font-bold" data-astro-cid-j7pv25f6>4</span> </div> <div class="ml-6 flex-1" data-astro-cid-j7pv25f6> <div class="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700" data-astro-cid-j7pv25f6> <h3 class="font-display text-xl font-semibold text-slate-900 dark:text-white mb-2" data-astro-cid-j7pv25f6>
Optimización mensual
</h3> <p class="text-slate-600 dark:text-slate-300" data-astro-cid-j7pv25f6>
Reportes detallados con insights y mejoras continuas del rendimiento
</p> </div> </div> </div> <!-- Desktop Layout --> <div class="hidden md:flex md:items-center w-full" data-astro-cid-j7pv25f6> <div class="flex-1 pr-8" data-astro-cid-j7pv25f6></div> <div class="relative flex items-center justify-center w-12 h-12 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full border-4 border-white dark:border-slate-900 shadow-lg" data-astro-cid-j7pv25f6> <span class="text-white font-bold" data-astro-cid-j7pv25f6>4</span> </div> <div class="flex-1 pl-8" data-astro-cid-j7pv25f6> <div class="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700" data-astro-cid-j7pv25f6> <h3 class="font-display text-xl font-semibold text-slate-900 dark:text-white mb-2" data-astro-cid-j7pv25f6>
Optimización mensual
</h3> <p class="text-slate-600 dark:text-slate-300" data-astro-cid-j7pv25f6>
Reportes detallados con insights y mejoras continuas del rendimiento
</p> </div> </div> </div> </div> </div> </div> </div> </section>  <section class="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-50 to-primary-50/30 dark:from-slate-900 dark:to-primary-900/10" data-astro-cid-j7pv25f6> <div class="max-w-7xl mx-auto" data-astro-cid-j7pv25f6> <div class="text-center mb-16" data-astro-cid-j7pv25f6> <h2 class="font-display text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-6" data-astro-cid-j7pv25f6>
Ejemplos en acción
</h2> <p class="text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto" data-astro-cid-j7pv25f6>
Descubre cómo nuestros agentes manejan diferentes situaciones reales de negocio
</p> </div> ${renderComponent($$result2, "ChatSimulation", ChatSimulation, { "client:load": true, "client:component-hydration": "load", "client:component-path": "C:/Users/User/Desktop/PROYECTOS/Proyecto Pynark V1/src/components/ChatSimulation.tsx", "client:component-export": "default", "data-astro-cid-j7pv25f6": true })} </div> </section>  <section id="contact" class="py-20 px-4 sm:px-6 lg:px-8" data-astro-cid-j7pv25f6> <div class="max-w-4xl mx-auto" data-astro-cid-j7pv25f6> <div class="text-center mb-12" data-astro-cid-j7pv25f6> <h2 class="font-display text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-6" data-astro-cid-j7pv25f6>
Contáctanos
</h2> <p class="text-xl text-slate-600 dark:text-slate-300" data-astro-cid-j7pv25f6>
¿Listo para transformar tu atención al cliente? Hablemos
</p> </div> <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8" data-astro-cid-j7pv25f6> <form class="space-y-6" data-astro-cid-j7pv25f6> <div class="grid grid-cols-1 md:grid-cols-2 gap-6" data-astro-cid-j7pv25f6> <div data-astro-cid-j7pv25f6> <label for="name" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2" data-astro-cid-j7pv25f6>
Nombre
</label> <input type="text" id="name" name="name" required class="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent" placeholder="Tu nombre completo" data-astro-cid-j7pv25f6> </div> <div data-astro-cid-j7pv25f6> <label for="email" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2" data-astro-cid-j7pv25f6>
Email
</label> <input type="email" id="email" name="email" required class="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent" placeholder="tu@email.com" data-astro-cid-j7pv25f6> </div> </div> <div data-astro-cid-j7pv25f6> <label for="company" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2" data-astro-cid-j7pv25f6>
Empresa
</label> <input type="text" id="company" name="company" class="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent" placeholder="Nombre de tu empresa" data-astro-cid-j7pv25f6> </div> <div data-astro-cid-j7pv25f6> <label for="message" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2" data-astro-cid-j7pv25f6>
Mensaje
</label> <textarea id="message" name="message" rows="4" required class="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none" placeholder="Cuéntanos sobre tu proyecto y cómo podemos ayudarte..." data-astro-cid-j7pv25f6></textarea> </div> <button type="submit" class="w-full px-8 py-4 bg-gradient-to-r from-primary-600 to-secondary-600 hover:from-primary-700 hover:to-secondary-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300" data-astro-cid-j7pv25f6>
Enviar mensaje
</button> </form> </div> </div> </section> ${renderScript($$result2, "C:/Users/User/Desktop/PROYECTOS/Proyecto Pynark V1/src/pages/index.astro?astro&type=script&index=0&lang.ts")}  ` })}`;
}, "C:/Users/User/Desktop/PROYECTOS/Proyecto Pynark V1/src/pages/index.astro", void 0);

const $$file = "C:/Users/User/Desktop/PROYECTOS/Proyecto Pynark V1/src/pages/index.astro";
const $$url = "";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
