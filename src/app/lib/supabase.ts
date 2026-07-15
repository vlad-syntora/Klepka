import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

const envSchema = z.object({
  VITE_SUPABASE_URL: z.url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
});

let client: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return envSchema.safeParse(import.meta.env).success;
}

// Lazy singleton so pages that never touch Supabase keep working without env vars.
export function getSupabase(): SupabaseClient {
  if (!client) {
    const env = envSchema.parse(import.meta.env);
    client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  }
  return client;
}
