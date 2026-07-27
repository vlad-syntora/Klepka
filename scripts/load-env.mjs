import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Minimal .env loader for build scripts (Vite only injects env into the bundle,
 * not into node scripts). Does not override variables already set in the shell.
 */
export function loadEnv() {
  for (const file of ['.env', '.env.local']) {
    let content;
    try {
      content = readFileSync(join(ROOT, file), 'utf-8');
    } catch {
      continue;
    }
    for (const line of content.split('\n')) {
      const match = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key] !== undefined) continue;
      process.env[key] = rawValue.replace(/^["']|["']$/g, '');
    }
  }
}

/** Fetches slugs of published articles; returns [] when Supabase is unreachable. */
export async function fetchPublishedArticles() {
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    console.warn('⚠ Supabase env vars are not set; skipping article routes');
    return [];
  }

  try {
    const response = await fetch(
      `${url}/rest/v1/articles?select=slug,updated_at&status=eq.published`,
      { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } },
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const rows = await response.json();
    return Array.isArray(rows) ? rows.filter((row) => typeof row.slug === 'string') : [];
  } catch (error) {
    console.warn(`⚠ Failed to fetch article slugs (${error.message}); skipping article routes`);
    return [];
  }
}
