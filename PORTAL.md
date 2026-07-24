# Klepka Client Portal — build notes

Implementation of the design in `portal-design/` (client portal + internal admin console),
built into this site rather than as a separate app. Same Supabase project and auth as the
articles admin.

## Routes

| Route | Who | What |
|---|---|---|
| `/portal/login` | anyone | Portal sign-in — Google, with an email/password fallback |
| `/portal` | client users | Dashboard |
| `/portal/pipeline` | client | Stage tracker, current offer, accept / request changes, version history |
| `/portal/calls` | client | Request a slot, cancel, meeting history |
| `/portal/documents` | client | Document library, sign, download, client-side upload |
| `/portal/payments` | Client Admin + granted collaborators | Payment schedule and invoice status |
| `/portal/project` | client | Milestone timeline, approve milestones, project team roster |
| `/portal/feedback` | client | Rate + comment, scoped "About" dropdown, response history |
| `/portal/notifications` | client | Cross-module activity feed, mark read |
| `/portal/settings` | Client Admin | Account details, teammate invites |
| `/admin/portal/accounts` | Klepka staff | Accounts list with filters |
| `/admin/portal/accounts/:id` | Klepka staff | Account Workspace — Overview, Pipeline & Offers, Documents, Payments, Project, Feedback, Users & Access |
| `/admin/portal/team` | Portal Admin | Klepka team + all customer users |
| `/admin/portal/feedback` | Klepka staff | Cross-account feedback inbox |

## Database

`supabase/migrations/0004_client_portal.sql` — apply it before deploying.

Entities follow §8 of the design doc: `portal_accounts`, `portal_users`, `portal_opportunities`,
`portal_offers` (+ `portal_offer_items`), `portal_meetings`, `portal_documents`,
`portal_invoices`, `portal_projects`, `portal_milestones`, `portal_project_team`,
`portal_feedback`, `portal_activity`.

`Contract` from the design doc is folded into `portal_documents` (`doc_type` covers
MSA/SOW/NDA/contract, `signers` is a jsonb list) rather than being a separate table — the
wireframes only ever show one document library.

### Access model

- **Access is granted by email address, and no passwords are issued.** Two passwordless routes:
  *Continue with Google*, or a one-time sign-in link emailed to the address. Whichever they use,
  `portal_bootstrap_user()` links the auth identity to a `portal_users` row by email; no matching
  row means no access. Inviting someone in the admin console is the whole provisioning step.
  (An email/password form is still there, collapsed behind "I have a password", for the existing
  content admins.)
- The email-link route **needs custom SMTP on the Supabase project.** Without it Supabase accepts
  the request with `200` and the mail never reaches anyone outside the project team.
- **Internal staff** (`sales_rep`, `delivery_lead`, `ops_finance`, `portal_admin`) read every
  account. Writes are scoped by `portal_can_manage()`: portal admins everywhere, everyone else
  on accounts they own or are staffed on.
- **Client users** read only their own account, filtered further by `portal_can_view_module()`
  (Client Admin = everything, Prospect = pre-sale modules, Collaborator = pipeline/calls/feedback
  plus whatever `module_access` grants).
- **Clients never write to tables directly.** Every client action is a `SECURITY DEFINER` RPC
  (`portal_respond_to_offer`, `portal_request_meeting`, `portal_cancel_meeting`,
  `portal_approve_milestone`, `portal_submit_feedback`, `portal_mark_activity_read`,
  `portal_register_document`, `portal_invite_teammate`), so a client can only make the exact
  transitions the portal offers.

### Feedback scoping

`portal_feedback_targets()` returns the account's **active project team members on a published
project**, plus the assigned account owner — never a company-wide staff list. Removing someone
from `portal_project_team` (soft: `active = false`) stops new feedback targeting them and leaves
historical feedback intact, exactly as §11.4.5 specifies.

### Articles admin lockdown

Before this migration, *any* authenticated Supabase user could edit articles. That stops being
safe once clients can sign in, so the articles/authors/comments/storage policies now require
`portal_is_internal()`, and every pre-existing `auth.users` row is seeded as a `portal_admin`.

## Onboarding a client

1. `/admin/portal/accounts` → **New account** (name, industry, owner).
2. Workspace → **Pipeline & Offers** → create the opportunity, build an offer, send it.
3. Workspace → **Users & Access** → invite the client's people (Client Admin / Collaborator).
   That's the whole provisioning step — they sign in with **Continue with Google** using that
   exact address. Nothing to send them but the link.
4. On Closed Won: Workspace → **Project** → *Create project from opportunity* (milestones
   pre-fill from the accepted offer) → assign a Delivery Lead → **Publish**.
5. Staff the rest of the team from the Project tab — that list is what the client can rate.

## Google Drive

Drive is the file store and the internal team's working surface; the portal is the indexed,
status-aware view over it. We keep only pointers in Postgres (`portal_accounts.drive_folder_id`,
`drive_web_link`, `drive_folders`; `portal_documents.drive_file_id`, `drive_web_link`), never a
copy of the bytes. Migration: `0006_drive.sql`.

**Why an OAuth refresh token, not a service-account key.** The Google org policy
`iam.managed.disableServiceAccountKeyCreation` blocks downloadable SA keys, so the app instead
acts as a real Workspace user via a long-lived refresh token. Files it creates live in a
**Shared Drive**, so they are owned by the drive, not by that person.

**Folder tree** (created per account, phase-aligned so it mirrors migration 0005):
`00 Onboarding` · `01 Discovery` · `02 Proposal` · `03 Contracts` · `04 Invoices` · `05 Delivery`.

**One-time setup**

1. Create a **Shared Drive** ("Klepka Clients") in Workspace; note the root folder id.
2. Google Cloud → enable **Drive API** → create an **OAuth client** (type: Web application),
   add `http://localhost:5100/oauth2callback` as an authorized redirect URI.
3. Mint the refresh token locally:
   `GOOGLE_OAUTH_CLIENT_ID=… GOOGLE_OAUTH_CLIENT_SECRET=… node scripts/google-refresh-token.mjs`
   — sign in as the Shared Drive owner, copy the printed token.
4. Set in Vercel (server-only, no `VITE_` prefix): `GOOGLE_OAUTH_CLIENT_ID`,
   `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REFRESH_TOKEN`, `GOOGLE_DRIVE_ROOT_FOLDER_ID`.

**Using it.** Workspace → **Contracts & Documents** → *Create folders* provisions the tree
(idempotent — *Repair tree* refills anything missing). *Sync sharing* grants every person on
the account read access to the folder; non-Google addresses are reported as skipped (they reach
files through the portal instead). All logic is in the single serverless function
`api/google/drive.ts`, admin-gated by an internal Supabase session.

**Not yet wired:** auto-provision on account creation, and routing portal uploads straight into
the matching subfolder. Both build on `api/google/drive.ts` — folders and sharing come first.

## Not built (deliberately, matches §16 "open decisions")

- No embedded e-sign provider — documents marked `awaiting_signature` open the stored file. Swap
  in DocuSign/Salesforce-native once the provider is chosen.
- No payment processor — invoices track status; payment happens out of band.
- No calendar integration — meeting requests are proposals that Klepka confirms manually.
- Notifications are in-portal only; email digests are not wired up.
