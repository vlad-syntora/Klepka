// Shared calendar-period helpers for the admin portal's time-filtered views (dashboard reports and
// the employee analytics tab). A "period" is a preset range anchored to today; custom from/to dates
// override it. Buckets choose the x-axis granularity that suits the range.

export type Period = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'all';

export const PERIODS: { key: Period; label: string }[] = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'quarter', label: 'Quarter' },
  { key: 'year', label: 'Year' },
  { key: 'all', label: 'All' },
];

// Local-timezone YYYY-MM-DD for a Date (avoids the UTC shift a bare toISOString would introduce).
export const iso = (date: Date): string => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

export const todayIso = (): string => iso(new Date());

// The first day (inclusive) of the current calendar period. `all` has no lower bound.
export const periodStart = (period: Period): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  switch (period) {
    case 'day':
      return iso(now);
    case 'week': {
      const day = now.getDay();
      const diff = (day + 6) % 7;
      return iso(new Date(year, month, now.getDate() - diff));
    }
    case 'month':
      return iso(new Date(year, month, 1));
    case 'quarter':
      return iso(new Date(year, Math.floor(month / 3) * 3, 1));
    case 'year':
      return iso(new Date(year, 0, 1));
    default:
      return '';
  }
};

// Bucket a date into the chart x-axis key at the granularity that suits the period: day-level for
// short ranges, week-start for a quarter, month for a year / all.
export const bucketKey = (dateStr: string, period: Period): string => {
  if (period === 'year' || period === 'all') return dateStr.slice(0, 7); // YYYY-MM
  if (period === 'quarter') {
    const d = new Date(`${dateStr}T00:00:00`);
    const diff = (d.getDay() + 6) % 7;
    return iso(new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff));
  }
  return dateStr; // YYYY-MM-DD
};

export const bucketLabel = (key: string): string => {
  if (key.length === 7) {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
  }
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

// An explicit time-grouping granularity for chart x-axes — chosen directly by the user (unlike the
// range presets above, which pick both a window and a granularity). The date window is set separately.
export type Granularity = 'day' | 'week' | 'month' | 'quarter' | 'year';

export const GRANULARITIES: { key: Granularity; label: string }[] = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'quarter', label: 'Quarter' },
  { key: 'year', label: 'Year' },
];

// Bucket a date into a chronologically-sortable key at the chosen grouping granularity. Each granularity
// yields a distinct key shape so groupBucketLabel can infer how to render it: YYYY-MM-DD (day / week-start),
// YYYY-MM (month), YYYY-Qn (quarter), YYYY (year).
export const groupBucketKey = (dateStr: string, gran: Granularity): string => {
  switch (gran) {
    case 'day':
      return dateStr; // YYYY-MM-DD
    case 'week': {
      const d = new Date(`${dateStr}T00:00:00`);
      const diff = (d.getDay() + 6) % 7; // ISO week starts Monday
      return iso(new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff));
    }
    case 'month':
      return dateStr.slice(0, 7); // YYYY-MM
    case 'quarter': {
      const d = new Date(`${dateStr}T00:00:00`);
      return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
    }
    case 'year':
      return dateStr.slice(0, 4); // YYYY
  }
};

// Human label for a groupBucketKey, inferred from the key shape: "2026" (year), "Q3 '26" (quarter),
// "Jul 26" (month), "Jul 22" (day / week-of).
export const groupBucketLabel = (key: string): string => {
  if (/^\d{4}$/.test(key)) return key; // year
  if (key.includes('-Q')) {
    const [y, q] = key.split('-Q');
    return `Q${q} '${y.slice(2)}`;
  }
  if (key.length === 7) {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
  }
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};
