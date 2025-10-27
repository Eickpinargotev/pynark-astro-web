Sistema de precios:
# Paquetes de implementación (one-off=pago único por única vez.)
Precios en USD

A. Starter
- Incluye:
    - 1 Canal (WhatsApp o Telegram)
    - Sistema handoff (un humano puede intervenir en la conversación siempre que lo desee)
    - Reportes a número personal, telegram o google sheet
    - Smart Handoff
    - Buffer de mensajes
- Alcance: flujo FAQ + respuestas pre-definidas 
- Integraciones: 1 (reportes).
- Precio: $249–$450. ($7/mes pass-through)

B. Pro
- Incluye:
    - Todo lo del plan Starter, mas
    - 2 Canales (WhatsApp, Telegram, instagram o messenger)
    - Transcripción de audios
    - Integración con base de datos
- Alcance: flujo FAQ + captación de datos + respuestas inteligentes
- Integraciones: 2 (reportes, catálogos y agendamientos)
- Precio: $600–$1,100. ($30/mes pass-through)

C. Ultra
- Incluye:
    - Todo lo del plan Pro, mas
    - 4 Canales (WhatsApp, Telegram, instagram o messenger)
    - CRM avanzado a tu tu elección (chatwoot, hubspot, gohighlevel y más)
- Alcance: flujo FAQ + captación de datos + respuestas pre-definidas 
- Integraciones: 3 (reportes, catálogos, agendamientos)
- Precio: $1,200–$2,000. ($80/mes pass-through)

Membresías mensuales
Lite — $25/mes
1 chequeo de salud/mes.
Cambios incluidos: 0 (solo bugs).
Soporte por email en 48–72 h.

Pro — $89/mes (recomendada)
- Todo Lite + actualizaciones de plantilla (Manten tu agente en la ultima versión siempre)
- 2 cambios menores/mes (p. ej., modificar copy, palabra clave, regla simple).
- Reporte mensual básico (volumen, intents más usados).
- Soporte en 24–48 h.

Growth — $179/mes
Todo Pro + optimización proactiva (A/B simple en prompts/flows) y 4 cambios/mes.
Reunión trimestral de roadmap.
Soporte priorizado (12–24 h).



# PROMPT PARA CONSTRUCCIÓN
Manten el diseño de la pagina pricing, solo añade los datos y los botones necesarios
debes agregar los planes que tenemos y las membresias.

El resto de información, va a ir en la pagina de información, la cual es una pagina oculta



# Siempre se utilizan frases claves en cada servicio y alado del botón Get pro, escribimos mas info.
Este botón, nos lleva a una página oculta (es decir que no aparece en el header) que contiene toda la información sobre los terminos, precios, usabilidad, etc...Algo así como la pagina de documentación de cursor o de algúna librería documentada en linea.

debes utilizar astro y todo el contenido de la sección de documentación debe estar en documentos .mdx
por ejemplo
src/pages/docs/cuenta/pricing.mdx
por ahora añade documetos provicionales sobre lo hablado aqui sobre los precios y además
# Hitos y pagos
40% al inicio (Descubrimiento y blueprint, no reembolsable).
40% al demo funcional (staging).
20% al go-live + capacitación.
y en src/pages/docs/Empezar/Instalacion.mdx
escribe un poco sobre el proceso de instalación de un agente de servicio al cliente, es decir, primero se construye, luego se pone en producción y luego se realizan optimizaciones
Nota: recuerda que la pagina oculta de información debe tener un diseño como el de la pagina de cursor, pero hecha en astro, además debe estar optimizada para uso en movil tambien.
