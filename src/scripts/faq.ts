// FAQ accordion functionality extracted from faq.astro into a typed module

function setupFaq(): void {
  const faqButtons = document.querySelectorAll<HTMLButtonElement>('.faq-button');

  faqButtons.forEach((button) => {
    button.addEventListener('click', function (this: HTMLButtonElement) {
      const content = this.nextElementSibling as HTMLElement | null;
      const icon = this.querySelector('.faq-icon') as HTMLElement | null;
      const isOpen = !!(content && !content.classList.contains('hidden'));

      // Close all other FAQ items
      faqButtons.forEach((otherButton) => {
        if (otherButton !== button) {
          const otherContent = otherButton.nextElementSibling as HTMLElement | null;
          const otherIcon = otherButton.querySelector('.faq-icon') as HTMLElement | null;
          if (otherContent) otherContent.classList.add('hidden');
          if (otherIcon) otherIcon.style.transform = 'rotate(0deg)';
        }
      });

      // Toggle current item
      if (isOpen && content) {
        content.classList.add('hidden');
        if (icon) icon.style.transform = 'rotate(0deg)';
      } else if (content) {
        content.classList.remove('hidden');
        if (icon) icon.style.transform = 'rotate(180deg)';
      }
    });
  });
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setupFaq(), { once: true });
} else {
  setupFaq();
}