const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const DATE_SHORT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : DATE.format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${DATE_SHORT.format(date)}, ${TIME.format(date)}`;
}

export function formatMoney(amount: number | null | undefined, currency = 'USD'): string {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export function formatRelative(value: string | null | undefined): string {
  if (!value) return 'never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'never';

  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return formatDate(value);
}

/** Local `datetime-local` input value → ISO string. */
export function localInputToIso(value: string): string {
  return new Date(value).toISOString();
}

export function isoToLocalInput(value: string): string {
  const date = new Date(value);
  const offsetMs = date.getTime() - date.getTimezoneOffset() * 60_000;
  return new Date(offsetMs).toISOString().slice(0, 16);
}

/**
 * Presentable display name. Some early rows were seeded with an email prefix as the full name
 * (e.g. "daria.ezerovych"); when a value looks like that — no spaces, separated by . _ or - — we
 * title-case each part into "Daria Ezerovych". Real names with spaces are returned untouched.
 */
export function prettyName(value: string | null | undefined): string {
  const name = (value ?? '').trim();
  if (!name) return '';
  if (/\s/.test(name)) return name;
  return name
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** First-letter initials for an avatar fallback, from a (possibly email-prefixed) name. */
export function initialsOf(value: string | null | undefined): string {
  const parts = prettyName(value).split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}
