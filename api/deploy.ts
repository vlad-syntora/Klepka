import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createServiceClient } from './_lib/supabase-server';

// Triggers a Vercel rebuild so prerendered article pages stay in sync.
// Admin-only: requires a valid Supabase session token.
export default async function handler(req: VercelRequest, res: VercelResponse) {
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
}
