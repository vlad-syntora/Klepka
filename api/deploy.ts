import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Self-contained on purpose: with "type": "module" Vercel transpiles api/ TS
// without bundling, so relative imports outside this file break at runtime.

function createServiceClient() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase server environment variables are not configured');
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Triggers a Vercel rebuild so prerendered article pages stay in sync.
// Admin-only: requires a valid Supabase session token.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const deployHookUrl = process.env.DEPLOY_HOOK_URL;
    if (!deployHookUrl) {
      return res.status(500).json({ error: 'Deploy hook is not configured' });
    }

    const response = await fetch(deployHookUrl, { method: 'POST' });
    if (!response.ok) {
      return res.status(502).json({ error: 'Deploy hook request failed' });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Unhandled error in api/deploy:', error);
    return res.status(500).json({ error: 'Failed to trigger deploy' });
  }
}
