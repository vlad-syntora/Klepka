# Articles Portal — Setup

One-time setup for the articles portal backend (Supabase + Vercel).

## 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run `migrations/0001_articles_portal.sql`, then `migrations/0003_author_profile.sql` (0002 comes later, see step 3).
3. (Optional, dev) Run `seed.sql` for sample data.

## 2. Admin users

1. **Authentication → Sign In / Up**: keep Email provider enabled, **disable "Allow new users to sign up"**.
2. **Authentication → Users → Add user**: create each admin manually (email + password).
   Every authenticated user is an admin — there is no public signup path.

## 3. Scheduled publishing

1. **Database → Extensions**: enable `pg_cron` and `pg_net`.
2. Create a Deploy Hook in Vercel (**Project → Settings → Git → Deploy Hooks**).
3. In SQL Editor, store it in Vault:
   ```sql
   select vault.create_secret('<deploy-hook-url>', 'vercel_deploy_hook_url');
   ```
4. Run `migrations/0002_scheduling.sql` (checks scheduled articles every 10 minutes).

## 4. Client portal

1. In **SQL Editor**, run `migrations/0004_client_portal.sql`.
   It creates the portal schema, its RLS policies and the private `portal-documents` bucket —
   and it tightens the articles policies so only Klepka-internal users can edit content
   (every existing auth user is seeded as a `portal_admin`, so current admins keep access).
2. **Authentication → Sign In / Providers → Google**: enable it and paste the OAuth client ID and
   secret from Google Cloud Console. Add the callback URL Supabase shows you
   (`https://<ref>.supabase.co/auth/v1/callback`) to the Google client's *Authorized redirect
   URIs*, and add `http://localhost:5173` plus the production origin to
   **Authentication → URL Configuration → Redirect URLs**.
3. **Custom SMTP** — required, not optional. Supabase's built-in sender only delivers to project
   members and is rate-limited to a few messages per hour, so client-facing magic links accept
   the request with `200` and then never arrive.

   We use Resend. First verify the domain (Resend → Domains → `klepka.solutions` → add the SPF
   and DKIM records it gives you → Verify); until a domain is verified Resend only delivers to
   your own account address. Then fill **Project Settings → Authentication → SMTP Settings**:

   | Field | Value |
   |---|---|
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Username | `resend` |
   | Password | the Resend API key (`re_…`) — it *is* the SMTP password |
   | Sender email | `portal@klepka.solutions` (must be on the verified domain) |
   | Sender name | `Klepka` |

   Then raise **Authentication → Rate Limits → Emails sent per hour** from the default if you
   expect to onboard several clients at once.

   The sender address must be on the domain that is verified **in Resend**, exactly. Ours is the
   subdomain `portal.klepka.solutions` (kept separate from the Google Workspace mail on the apex
   so portal sending can't hurt the deliverability of real business mail), hence
   `noreply@portal.klepka.solutions`.

   Branded email body: `email-templates/magic-link.html` → paste into **Authentication → Emails →
   Magic Link**. Keep the file and the dashboard in sync when editing.
4. Nobody needs a password: portal access is granted purely by email address. Invite a person
   from `/admin/portal/accounts/<account>` → **Users & Access**, and they sign in either with the
   Google account for that address, or with a one-time link emailed to it. An address that is not
   invited gets a "no portal access yet" screen.

See `PORTAL.md` in the repo root for the routes, roles and onboarding flow.

## 5. Cloudflare Turnstile

Create a widget at [dash.cloudflare.com](https://dash.cloudflare.com) → Turnstile.
For local dev you can use the test keys: site `1x00000000000000000000AA`, secret `1x0000000000000000000000000000000AA`.

## 6. Environment variables

Set in **Vercel → Project → Settings → Environment Variables** (and locally in `.env`), see `.env.example`:

| Variable | Scope |
|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Build + client |
| `VITE_TURNSTILE_SITE_KEY` | Build + client |
| `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY` from the Vercel integration) | Functions only |
| `TURNSTILE_SECRET_KEY` | Functions only |
| `DEPLOY_HOOK_URL` | Functions only (same URL as in Vault) |
| `COMMENT_IP_SALT` | Functions only (any random string) |

## How publishing works

- **Publish now** in the admin sets the article to `published` and calls `/api/deploy` → Vercel rebuild → the article gets a prerendered static page and a sitemap entry.
- **Scheduled** articles are flipped to `published` by the `publish-scheduled-articles` pg_cron job, which then calls the deploy hook via `pg_net`.
- Editing or archiving a published article also triggers a rebuild from the admin UI.
