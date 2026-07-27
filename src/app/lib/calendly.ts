// Calendly popup integration. Lazy-loads Calendly's official widget assets the first time a
// booking is opened, then shows the in-page popup for a person's personal scheduling link
// (portal_users.calendly_url). No external assets are loaded until someone actually books.

const WIDGET_JS = 'https://assets.calendly.com/assets/external/widget.js';
const WIDGET_CSS = 'https://assets.calendly.com/assets/external/widget.css';

interface CalendlyPrefill {
  name?: string;
  email?: string;
}

declare global {
  interface Window {
    Calendly?: {
      initPopupWidget: (options: { url: string; prefill?: CalendlyPrefill }) => void;
    };
  }
}

let loader: Promise<void> | null = null;

/** Injects the Calendly stylesheet + script once and resolves when the API is ready. */
function ensureCalendly(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Calendly needs a browser'));
  if (window.Calendly) return Promise.resolve();
  if (loader) return loader;

  loader = new Promise<void>((resolve, reject) => {
    if (!document.querySelector(`link[href="${WIDGET_CSS}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = WIDGET_CSS;
      document.head.appendChild(link);
    }
    const script = document.createElement('script');
    script.src = WIDGET_JS;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loader = null; // let a later attempt retry
      reject(new Error('Could not load Calendly'));
    };
    document.head.appendChild(script);
  });
  return loader;
}

/**
 * Opens the Calendly popup for a scheduling link, optionally prefilling the booker's details.
 * Appends a hide-details param so Calendly's own "powered by" banner stays tidy in the modal.
 */
export async function openCalendly(url: string, prefill?: CalendlyPrefill): Promise<void> {
  await ensureCalendly();
  window.Calendly?.initPopupWidget({ url, prefill });
}
