import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft } from 'lucide-react';

interface ChatMessage {
  content: string;
  isUser: boolean;
}

interface ChatDemo {
  id: string;
  title: string;
  messages: ChatMessage[];
}

const chatDemos: ChatDemo[] = [
  {
    id: 'inventario-pagos',
    title: 'Inventario y pagos',
    messages: [
      { content: '¿Tienen disponible la cafetera modelo X?', isUser: true },
      { content: 'Sí, contamos con 5 en inventario. Puedes pagar en efectivo, tarjeta o transferencia.', isUser: false },
      { content: 'Perfecto, la quiero con pago por tarjeta.', isUser: true },
      { content: 'Listo, he reservado tu cafetera y actualizado el inventario.', isUser: false }
    ]
  },
  {
    id: 'precios-dinamicos',
    title: 'Precios dinámicos',
    messages: [
      { content: '¿Cuánto cuesta la pizza familiar si pago con tarjeta?', isUser: true },
      { content: 'Con tarjeta el precio es $180, en efectivo serían $170.', isUser: false },
      { content: 'Entonces la pido con efectivo.', isUser: true },
      { content: 'Perfecto, registré tu pedido con el precio de $170.', isUser: false }
    ]
  },
  {
    id: 'quejas-reportes',
    title: 'Quejas y reportes',
    messages: [
      { content: 'La entrega llegó fría y tarde.', isUser: true },
      { content: 'Lamento mucho la experiencia. He generado un reporte automático para administración.', isUser: false },
      { content: 'Gracias, espero mejor atención la próxima.', isUser: true },
      { content: 'Claro que sí, tu comentario ayudará a mejorar nuestro servicio.', isUser: false }
    ]
  },
  {
    id: 'alertas-atencion',
    title: 'Alertas de atención',
    messages: [
      { content: 'Quiero cancelar mi pedido y pedir reembolso.', isUser: true },
      { content: 'Entiendo, este caso requiere atención especial. He enviado una alerta a tu administrador en Telegram.', isUser: false },
      { content: 'Ah perfecto, esperaré la respuesta.', isUser: true },
      { content: 'Gracias por tu paciencia, pronto te contactarán.', isUser: false }
    ]
  },
  {
    id: 'faq-negocio',
    title: 'FAQ del negocio',
    messages: [
      { content: '¿Dónde están ubicados y cuál es su horario?', isUser: true },
      { content: 'Estamos en Av. Central 123 y abrimos de 9 am a 9 pm, todos los días.', isUser: false },
      { content: '¿Y qué garantía tienen los productos?', isUser: true },
      { content: 'Todos cuentan con garantía de 30 días por defectos de fábrica.', isUser: false }
    ]
  }
];

interface ChatSimulationProps {
  className?: string;
}

const ChatSimulation: React.FC<ChatSimulationProps> = ({ className = '' }) => {
  const [selectedDemo, setSelectedDemo] = useState(0);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  // Removed visibility gating to avoid re-runs during scroll
  // Default hidden to avoid initial overlay blur on mobile before effect runs
  const [showButtons, setShowButtons] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isUserTyping, setIsUserTyping] = useState(false);
  const [currentInputText, setCurrentInputText] = useState('');
  const activeTimersRef = useRef<NodeJS.Timeout[]>([]);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef<boolean>(true);
  const restartTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Auto-hide buttons on mobile on initial load
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024; // lg breakpoint
      setIsMobile(mobile);
      if (mobile) {
        setShowButtons(false);
      } else {
        setShowButtons(true);
      }
    };
    
    // Check on initial load
    handleResize();
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Function to clear all active timers
  const clearAllTimers = () => {
    activeTimersRef.current.forEach(timer => clearTimeout(timer));
    activeTimersRef.current = [];
  };
  
  // Function to add timer to tracking
  const addTimer = (timer: NodeJS.Timeout) => {
    activeTimersRef.current.push(timer);
    return timer;
  };

  // Track whether the user is near the bottom of the messages container to avoid
  // fighting their scroll and causing flicker.
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const handleScroll = () => {
      const threshold = 16; // px tolerance
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
      isAtBottomRef.current = atBottom;
    };
    // Initialize state
    isAtBottomRef.current = true;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, []);

  // Disabled internal auto-scroll to honor request: no autoscroll.
  // If needed in the future, re-enable conditionally via a prop.

  // Simulation logic
  useEffect(() => {
    if (!isPlaying) return;

    const currentDemo = chatDemos[selectedDemo];
    if (currentMessageIndex >= currentDemo.messages.length) {
      // Restart simulation after a delay
      const restartTimer = addTimer(setTimeout(() => {
        setCurrentMessageIndex(0);
        setCurrentInputText('');
        setIsUserTyping(false);
        setIsTyping(false);
      }, 3000));
      return () => {
        clearTimeout(restartTimer);
        clearAllTimers();
      };
    }

    const currentMessage = currentDemo.messages[currentMessageIndex];
    const isUserMessage = currentMessage.isUser;
    
    if (isUserMessage) {
      // Clear any previous state first
      setCurrentInputText('');
      setIsUserTyping(false);
      setIsTyping(false);
      
      // Start user typing simulation after a delay
      const startTypingTimer = addTimer(setTimeout(() => {
        setIsUserTyping(true);
        
        // Type the message character by character
        const message = currentMessage.content;
        let charIndex = 0;
        
        const typeMessage = () => {
          if (charIndex < message.length) {
            setCurrentInputText(message.substring(0, charIndex + 1));
            charIndex++;
            addTimer(setTimeout(typeMessage, 50 + Math.random() * 50));
          } else {
            // Finished typing, now "send" the message
            addTimer(setTimeout(() => {
              setCurrentInputText('');
              setIsUserTyping(false);
              setCurrentMessageIndex(prev => prev + 1);
            }, 800));
          }
        };
        
        typeMessage();
      }, 1000));

      return () => {
        clearTimeout(startTypingTimer);
        clearAllTimers();
      };
    } else {
      // Clear input state for bot messages
      setCurrentInputText('');
      setIsUserTyping(false);
      
      // Bot message - show typing indicator then message
      setIsTyping(true);
      const typingTimer = addTimer(setTimeout(() => {
        setIsTyping(false);
        setCurrentMessageIndex(prev => prev + 1);
      }, 1500 + Math.random() * 1000));
      return () => {
        clearTimeout(typingTimer);
        clearAllTimers();
      };
    }
  }, [selectedDemo, currentMessageIndex, isPlaying]);

  const handleDemoSelect = (index: number) => {
    // Immediately stop current simulation
    setIsPlaying(false);
    
    // Clear ALL active timers to prevent overlapping
    clearAllTimers();
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    
    // Clear all states immediately
    setCurrentInputText('');
    setIsUserTyping(false);
    setIsTyping(false);
    setCurrentMessageIndex(0);
    
    // Set new demo
    setSelectedDemo(index);
    
    // Restart simulation after ensuring everything is clean
    restartTimerRef.current = setTimeout(() => {
      setIsPlaying(true);
    }, 200);
    
    // Close buttons on mobile after selection
    if (isMobile) {
      setShowButtons(false);
    }
  };

  const toggleButtons = () => {
    setShowButtons(!showButtons);
  };

  const currentDemo = chatDemos[selectedDemo];
  const visibleMessages = currentDemo.messages.slice(0, currentMessageIndex);
  
  // Debug logs removed to prevent console noise and potential perf issues

  return (
    <div className={`relative ${className}`}>
      <div className="flex flex-col lg:flex-row gap-6 relative">
        {/* Chat Display */}
        <div className="flex-1">
          <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 dark:border-slate-700/50 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-primary-500 to-secondary-500 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <img 
                  src="/assets/pynark_favicon.png" 
                  alt="Pynark Agent"
                  className="w-8 h-8 rounded-full bg-white/20 p-1"
                />
                <div>
                  <h3 className="font-semibold text-white">Agente E-commerce</h3>
                  <p className="text-primary-100 text-sm">Simulación: {currentDemo.title}</p>
                </div>
              </div>
              
              {/* Mobile button toggle */}
            </div>

            {/* Messages */}
            <div ref={messagesContainerRef} className="h-80 overflow-y-auto p-4 space-y-4">
              {visibleMessages.map((message, index) => (
                <div
                  key={`${selectedDemo}-${index}`}
                  className={`flex ${message.isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                      message.isUser
                        ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-br-sm'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-bl-sm'
                    }`}
                  >
                    <p className="text-sm leading-relaxed">{message.content}</p>
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start animate-fade-in">
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

              <div ref={messagesEndRef} />
            </div>

            {/* Input (simulation) */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-700">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={currentInputText}
                  placeholder=""
                  disabled
                  className={`flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl ${
                    isUserTyping 
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100' 
                      : 'bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                  } cursor-not-allowed`}
                />
                <button
                  disabled
                  className={`px-4 py-2 rounded-xl cursor-not-allowed min-h-12 min-w-12 flex items-center justify-center transition-colors ${
                    isUserTyping && currentInputText.length > 0
                      ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white'
                      : 'bg-slate-300 dark:bg-slate-600 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Overlay: only render on mobile when panel is open */}
        {isMobile && showButtons && (
          <div 
            className="lg:hidden fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            onClick={() => setShowButtons(false)}
          />
        )}

        {/* Demo Buttons Container */}
        <div className="lg:w-64 lg:relative">
          {/* Mobile Tab (when buttons are hidden) */}
          {!showButtons && isMobile && (
            <button
              onClick={toggleButtons}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-30 bg-white/30 dark:bg-slate-800/30 backdrop-blur-sm rounded-l-xl shadow-md border border-r-0 border-white/20 dark:border-slate-700/30 p-3 transition-all duration-300 hover:bg-white/50 dark:hover:bg-slate-800/50"
              aria-label="Mostrar opciones de chat"
            >
              <ChevronLeft className="w-5 h-5 text-slate-600/70 dark:text-slate-400/70" />
            </button>
          )}

          {/* Demo Buttons Panel */}
          <div className={`transition-all duration-300 ease-in-out ${
            showButtons 
              ? 'block lg:block' 
              : 'hidden lg:block'
          } ${
            showButtons
              ? 'absolute top-0 right-0 z-50 w-80 lg:relative lg:w-64'
              : 'lg:relative lg:w-64'
          }`}>
            <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 dark:border-slate-700/50 p-4 max-h-96 overflow-y-auto">
              <h4 className="font-semibold text-slate-900 dark:text-white mb-4">Ejemplos de Casos</h4>
              <div className="space-y-2">
                {chatDemos.map((demo, index) => (
                  <button
                    key={demo.id}
                    onClick={() => handleDemoSelect(index)}
                    className={`w-full text-left p-3 rounded-xl transition-all duration-200 ${
                      selectedDemo === index
                        ? 'bg-gradient-to-r from-primary-500 to-secondary-500 text-white shadow-lg'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                    }`}
                  >
                    <div className="font-medium text-sm">{demo.title}</div>
                    <div className={`text-xs mt-1 ${
                      selectedDemo === index ? 'text-primary-100' : 'text-slate-500 dark:text-slate-400'
                    }`}>
                      {demo.messages.length} mensajes
                    </div>
                  </button>
                ))}
              </div>
              
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatSimulation;
