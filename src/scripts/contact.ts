// Client-side page initialization for index.astro
// Moves inline logic into typed module for strict TS builds

export function initPage(): void {
  // Prevent initial unwanted scroll
  if (!window.location.hash || window.location.hash === '#') {
    window.scrollTo(0, 0);
  }

  // Chat section interactivity
  const showAgentsBtn = document.getElementById('show-agents-btn') as HTMLButtonElement | null;
  const agentButtons = document.getElementById('agent-buttons') as HTMLDivElement | null;
  const ecommerceBtn = document.getElementById('ecommerce-btn') as HTMLButtonElement | null;
  const chatContainer = document.getElementById('chat-container') as HTMLDivElement | null;

  showAgentsBtn?.addEventListener('click', () => {
    if (!showAgentsBtn) return;
    showAgentsBtn.style.display = 'none';
    agentButtons?.classList.remove('hidden');
  });

  ecommerceBtn?.addEventListener('click', () => {
    agentButtons?.classList.add('hidden');
    chatContainer?.classList.remove('hidden');
  });

  // Contact form logic
  const formEl = document.getElementById('contact-form');
  if (!(formEl instanceof HTMLFormElement)) return;

  const nameInput = document.getElementById('name');
  const emailInput = document.getElementById('email');
  const companyInput = document.getElementById('company');
  const phoneInput = document.getElementById('phone');
  const dtInput = document.getElementById('meeting-datetime');

  if (
    !(nameInput instanceof HTMLInputElement) ||
    !(emailInput instanceof HTMLInputElement) ||
    !(companyInput instanceof HTMLInputElement) ||
    !(phoneInput instanceof HTMLInputElement) ||
    !(dtInput instanceof HTMLInputElement)
  ) {
    return;
  }

  const submitBtn = document.getElementById('contact-submit');
  const submitSpinner = document.getElementById('contact-submit-spinner');
  const submitText = document.getElementById('contact-submit-text');
  const statusEl = document.getElementById('contact-status');

  if (
    !(submitBtn instanceof HTMLButtonElement) ||
    !(submitSpinner instanceof SVGElement) ||
    !(submitText instanceof HTMLSpanElement) ||
    !(statusEl instanceof HTMLDivElement)
  ) {
    return;
  }

  const WEBHOOK_URL: string = 'https://paneln8n.erickpinargote.com/webhook/contacto_pynark';

  const pad = (n: number): string => String(n).padStart(2, '0');

  const formatForDateTimeLocal = (d: Date): string =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

  const parseLocalDateTime = (val: string): Date | null => {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  };

  // Reference time: entry time + 2 hours
  const entryTime = new Date();
  const minDate = new Date(entryTime.getTime() + 2 * 60 * 60 * 1000);

  const minStr = formatForDateTimeLocal(minDate);
  dtInput.min = minStr;
  if (!dtInput.value) {
    dtInput.value = minStr;
  }

  const validateDateTime = (): void => {
    const chosen = parseLocalDateTime(dtInput.value);
    if (!chosen) {
      dtInput.setCustomValidity('Selecciona una fecha y hora válidas.');
    } else if (chosen.getTime() < minDate.getTime()) {
      dtInput.setCustomValidity('Elige una fecha y hora al menos 2 horas desde ahora.');
    } else {
      dtInput.setCustomValidity('');
    }
  };

  dtInput.addEventListener('input', validateDateTime);
  dtInput.addEventListener('change', validateDateTime);
  validateDateTime();

  const setStatus = (type: 'success' | 'error', text: string): void => {
    statusEl.classList.remove('hidden');
    statusEl.textContent = text;

    statusEl.classList.remove(
      'bg-green-50','text-green-700','border-green-200',
      'bg-red-50','text-red-700','border-red-200'
    );
    if (type === 'success') {
      statusEl.classList.add('bg-green-50','text-green-700','border-green-200');
    } else {
      statusEl.classList.add('bg-red-50','text-red-700','border-red-200');
    }
  };

  const setLoading = (loading: boolean): void => {
    submitBtn.disabled = loading;
    submitBtn.setAttribute('aria-busy', loading ? 'true' : 'false');
    if (loading) {
      submitSpinner.classList.remove('hidden');
      submitText.textContent = 'Enviando...';
    } else {
      submitSpinner.classList.add('hidden');
      submitText.textContent = 'Enviar mensaje';
    }
  };

  formEl.addEventListener('submit', async (e: SubmitEvent) => {
    e.preventDefault();

    if (!formEl.checkValidity()) {
      formEl.reportValidity();
      return;
    }

    const chosen = parseLocalDateTime(dtInput.value);
    if (!chosen || chosen.getTime() < minDate.getTime()) {
      dtInput.reportValidity();
      return;
    }

    const dd = pad(chosen.getDate());
    const mm = pad(chosen.getMonth() + 1);
    const yyyy = chosen.getFullYear();
    const hh = pad(chosen.getHours());
    const mi = pad(chosen.getMinutes());

    const nombre = nameInput.value.trim();
    const numero = phoneInput.value.trim();

    const mensaje =
      `Hola, has recibido una solicitud para una reunión de ${nombre} ` +
      `para reunirse el ${dd}/${mm}/${yyyy} a las ${hh}:${mi}, ` +
      `el número de telefono de contacto es ${numero}.`;

    let timeoutId: number | undefined;
    const ac = new AbortController();

    try {
      setLoading(true);
      timeoutId = window.setTimeout(() => ac.abort(), 10000);

      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Pynark-Web/1.0'
        },
        body: JSON.stringify({ message: mensaje }),
        signal: ac.signal
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`Error del servidor: ${response.status} ${errText}`);
      }

      setStatus('success', '¡Solicitud enviada correctamente! Te contactaremos pronto.');
      (formEl as HTMLFormElement).reset();
      dtInput.value = formatForDateTimeLocal(minDate);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error enviando webhook de contacto:', err);
      setStatus('error', 'No se pudo enviar tu solicitud. Intenta nuevamente en unos minutos.');
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      setLoading(false);
    }
  });
}