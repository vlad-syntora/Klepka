import { createHash, randomUUID } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// Self-contained on purpose: with "type": "module" Vercel transpiles api/ TS
// without bundling, so relative imports outside this file break at runtime.

const CommentInputSchema = z.object({
  articleId: z.guid(),
  name: z.string().trim().min(1).max(80),
  email: z.email().max(255),
  body: z.string().trim().min(1).max(5000),
  turnstileToken: z.string().min(1),
  // Honeypot field: real users leave it empty.
  website: z.string().optional().default(''),
});

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const MAX_LINKS = 2;
const RATE_LIMIT_COUNT = 3;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

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

function getClientIp(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return value?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
}

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.warn('TURNSTILE_SECRET_KEY is not set; skipping captcha verification');
    return true;
  }

  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: 'POST',
    body: new URLSearchParams({ secret, response: token, remoteip: ip }),
  });
  const result = (await response.json()) as { success?: boolean };
  return result.success === true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const parsed = CommentInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid comment data' });
    }
    const input = parsed.data;

    // Honeypot filled: pretend success so bots do not adapt.
    if (input.website) {
      return res.status(201).json({
        id: randomUUID(),
        article_id: input.articleId,
        author_name: input.name,
        body: input.body,
        created_at: new Date().toISOString(),
      });
    }

    const linkCount = (input.body.match(/https?:\/\//gi) ?? []).length;
    if (linkCount > MAX_LINKS) {
      return res.status(400).json({ error: 'Too many links in the comment' });
    }

    const ip = getClientIp(req);
    if (!(await verifyTurnstile(input.turnstileToken, ip))) {
      return res.status(400).json({ error: 'Verification failed. Please try again.' });
    }

    const supabase = createServiceClient();
    const ipHash = createHash('sha256')
      .update(ip + (process.env.COMMENT_IP_SALT ?? ''))
      .digest('hex');

    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
    const { count, error: countError } = await supabase
      .from('comments')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .gte('created_at', windowStart);

    if (countError) {
      console.error('Rate limit check failed:', countError.message);
      return res.status(500).json({ error: 'Failed to post comment' });
    }
    if ((count ?? 0) >= RATE_LIMIT_COUNT) {
      return res.status(429).json({ error: 'Too many comments. Please try again later.' });
    }

    const { data: article, error: articleError } = await supabase
      .from('articles')
      .select('id')
      .eq('id', input.articleId)
      .eq('status', 'published')
      .maybeSingle();

    if (articleError || !article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    const { data: comment, error: insertError } = await supabase
      .from('comments')
      .insert({
        article_id: input.articleId,
        author_name: input.name,
        author_email: input.email,
        body: input.body,
        ip_hash: ipHash,
      })
      .select('id, article_id, author_name, body, created_at')
      .single();

    if (insertError) {
      console.error('Comment insert failed:', insertError.message);
      return res.status(500).json({ error: 'Failed to post comment' });
    }

    return res.status(201).json(comment);
  } catch (error) {
    console.error('Unhandled error in api/comments:', error);
    return res.status(500).json({ error: 'Failed to post comment' });
  }
}
