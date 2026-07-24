-- 0006_drive.sql — Google Drive workspace links for portal accounts and documents.
--
-- Drive is the file store and the internal team's working surface; the portal is the
-- indexed, status-aware view over it. We keep only pointers here — the folder/file ids and
-- the shareable web link — never a copy of the bytes. Provisioning and sharing run in the
-- api/google/drive serverless function under the service role, so no RLS changes are needed:
-- clients already read portal_documents through the policies in 0004, and these columns ride
-- along in the same rows.

alter table portal_accounts
  -- The account's top-level folder inside the "Klepka Clients" Shared Drive.
  add column if not exists drive_folder_id text,
  add column if not exists drive_web_link text,
  -- Map of phase-folder key -> Drive folder id, e.g. {"00_onboarding": "abc", ...}.
  -- Kept as a map (not six columns) so the folder set can grow without a migration.
  add column if not exists drive_folders jsonb not null default '{}';

alter table portal_documents
  add column if not exists drive_file_id text,
  add column if not exists drive_web_link text;
