import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Self-contained on purpose (see api/google/drive.ts): with "type": "module" Vercel transpiles
// api/ TS without bundling, so relative imports outside this file break at runtime.
//
// Provisions a real Supabase Auth user for an invited portal profile and emails them Supabase's
// invite link, then marks the profile 'invited'. Runs under the service role — the anon client
// in the browser cannot touch auth.admin. Callers must be full-access Klepka staff.

const FULL_ACCESS_ROLES = ['sales_rep', 'delivery_lead', 'ops_finance', 'portal_admin'];

// Mirrors prettyName() in src/app/lib/portal-format.ts (api/ is self-contained on purpose):
// turns an email-prefix name like "daria.ezerovych" into "Daria Ezerovych", leaves real
// spaced names untouched. Used to greet the invitee by name in the email template.
function prettyName(value: string | null | undefined): string {
  const name = (value ?? '').trim();
  if (!name || /\s/.test(name)) return name;
  return name
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function serviceClient() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Supabase server environment is not configured');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const token = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice('Bearer '.length)
      : null;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const supabase = serviceClient();
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) return res.status(401).json({ error: 'Unauthorized' });

    const { data: me } = await supabase
      .from('portal_users')
      .select('role, status')
      .eq('auth_user_id', authData.user.id)
      .maybeSingle();
    if (!me || me.status === 'inactive' || !FULL_ACCESS_ROLES.includes(me.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { userId } = (req.body ?? {}) as { userId?: string };
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const { data: target, error: targetError } = await supabase
      .from('portal_users')
      .select('id, email, role, full_name')
      .eq('id', userId)
      .single();
    if (targetError || !target) return res.status(404).json({ error: 'User not found' });

    // Greeting name for the invite template ({{ .Data.full_name }}). Prettified so a seeded
    // email-prefix handle still reads as a proper name; falls back to '' (template says "Hi there").
    const fullName = prettyName(target.full_name);

    // Clients land on the portal, staff on the admin console.
    const isStaff = FULL_ACCESS_ROLES.includes(target.role) || target.role === 'implementor';
    const base = process.env.PORTAL_BASE_URL ?? req.headers.origin ?? '';
    const redirectTo = `${base}${isStaff ? '/admin/portal/accounts' : '/portal'}`;

    let emailed = true;
    let alreadyRegistered = false;
    const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(target.email, {
      redirectTo,
      data: { full_name: fullName },
    });
    if (inviteError) {
      // Already registered → nothing to provision. Any other error (typically SMTP not set up)
      // is not fatal: we still hand back a sign-in link below so the admin can share it directly.
      const message = inviteError.message.toLowerCase();
      alreadyRegistered = message.includes('already') && (message.includes('registered') || message.includes('exists'));
      emailed = false;
    }

    // Always produce a shareable link as a fallback, so the invite works even without SMTP. When
    // the user still doesn't exist (invite failed for a non-registration reason) an 'invite' link
    // also creates them; otherwise a one-time 'magiclink' signs the existing user in.
    let actionLink: string | null = null;
    try {
      const gen =
        inviteError && !alreadyRegistered
          ? await supabase.auth.admin.generateLink({
              type: 'invite',
              email: target.email,
              options: { redirectTo, data: { full_name: fullName } },
            })
          : await supabase.auth.admin.generateLink({ type: 'magiclink', email: target.email, options: { redirectTo } });
      actionLink = gen.data?.properties?.action_link ?? null;
    } catch {
      // Link generation is best-effort; the status update below is what matters.
    }

    const { error: statusError } = await supabase
      .from('portal_users')
      .update({ status: 'invited' })
      .eq('id', userId);
    if (statusError) return res.status(500).json({ error: statusError.message });

    return res.status(200).json({ ok: true, emailed, alreadyRegistered, actionLink });
  } catch (error) {
    console.error('Unhandled error in api/portal/invite:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Invite failed' });
  }
}
