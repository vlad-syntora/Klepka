# Articles Portal — Setup

One-time setup for the articles portal backend (Supabase + Vercel).

## 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run `migrations/0001_articles_portal.sql`.
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

## 4. Cloudflare Turnstile

Create a widget at [dash.cloudflare.com](https://dash.cloudflare.com) → Turnstile.
For local dev you can use the test keys: site `1x00000000000000000000AA`, secret `1x0000000000000000000000000000000AA`.

## 5. Environment variables

Set in **Vercel → Project → Settings → Environment Variables** (and locally in `.env`), see `.env.example`:

| Variable | Scope |
|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Build + client |
| `VITE_TURNSTILE_SITE_KEY` | Build + client |
| `SUPABASE_SERVICE_ROLE_KEY` | Functions only |
| `TURNSTILE_SECRET_KEY` | Functions only |
| `DEPLOY_HOOK_URL` | Functions only (same URL as in Vault) |
| `COMMENT_IP_SALT` | Functions only (any random string) |

## How publishing works

- **Publish now** in the admin sets the article to `published` and calls `/api/deploy` → Vercel rebuild → the article gets a prerendered static page and a sitemap entry.
- **Scheduled** articles are flipped to `published` by the `publish-scheduled-articles` pg_cron job, which then calls the deploy hook via `pg_net`.
- Editing or archiving a published article also triggers a rebuild from the admin UI.
