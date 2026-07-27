import { Readable } from 'node:stream';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

// Self-contained on purpose: with "type": "module" Vercel transpiles api/ TS without bundling,
// so relative imports outside this file break at runtime. All Drive actions are dispatched
// here from a single { action } body rather than split across files.
//
// Auth model (see PORTAL.md → Google Drive): the org policy forbids service-account keys, so
// the app acts as a real Workspace user through a long-lived OAuth refresh token. Files it
// creates live in a Shared Drive, so they are owned by the drive, not by that person.

const INTERNAL_ROLES = ['sales_rep', 'delivery_lead', 'ops_finance', 'implementor', 'portal_admin'];
// Full-access roles bypass account scope; implementers are limited to accounts they are staffed on.
const FULL_ACCESS_ROLES = ['sales_rep', 'delivery_lead', 'ops_finance', 'portal_admin'];
// Clients are not internal, but may push/list files within their OWN account's Drive only.
const CLIENT_ACTIONS = ['upload', 'list'];

// Mirrors portal_staffed_on() in SQL: is this portal user on the account team or a project team?
async function isStaffedOn(supabase: SupabaseClient, userId: string, accountId: string): Promise<boolean> {
  const { data: onAccount } = await supabase
    .from('portal_account_team')
    .select('id')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .eq('active', true)
    .maybeSingle();
  if (onAccount) return true;

  const { data: onProject } = await supabase
    .from('portal_project_team')
    .select('id, portal_projects!inner(account_id)')
    .eq('user_id', userId)
    .eq('active', true)
    .eq('portal_projects.account_id', accountId)
    .maybeSingle();
  return Boolean(onProject);
}

// The account root now holds only onboarding material; everything deal-specific lives under the
// opportunity's own folder (OPP_SUBFOLDERS). Keys are stored in portal_accounts.drive_folders.
const ACCOUNT_SUBFOLDERS: { key: string; name: string }[] = [
  { key: '00_onboarding', name: '00 Onboarding' },
];

// The per-opportunity tree, created under the account root when an opportunity is provisioned.
// Numeric prefixes keep Drive's alphabetical sort aligned to the deal lifecycle. Keys are stored
// in portal_opportunities.drive_folders.
const OPP_SUBFOLDERS: { key: string; name: string }[] = [
  { key: '01_discovery', name: '01 Discovery' },
  { key: '02_proposal', name: '02 Proposal' },
  { key: '03_contracts', name: '03 Contracts' },
  { key: '04_invoices', name: '04 Invoices' },
  { key: '05_delivery', name: '05 Delivery' },
  { key: '06_candidates', name: '06 Candidates (CVs)' },
];

function serviceClient() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Supabase server environment is not configured');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function driveClient() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (!clientId || !clientSecret || !refreshToken || !rootFolderId) {
    throw new Error('DRIVE_NOT_CONFIGURED');
  }
  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });
  return { drive: google.drive({ version: 'v3', auth }), rootFolderId };
}

// Shared Drives require these flags on every call, or the API silently scopes to My Drive.
const SHARED = { supportsAllDrives: true, includeItemsFromAllDrives: true } as const;

async function createFolder(
  drive: ReturnType<typeof google.drive>,
  name: string,
  parentId: string,
): Promise<{ id: string; link: string }> {
  const { data } = await drive.files.create({
    requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
    fields: 'id, webViewLink',
    supportsAllDrives: true,
  });
  return { id: data.id as string, link: data.webViewLink ?? '' };
}

type AccountRow = {
  id: string;
  name: string;
  drive_folder_id: string | null;
  drive_web_link: string | null;
  drive_folders: Record<string, string> | null;
};

// Idempotently makes sure the account's root folder and every phase subfolder exist, persisting
// the ids on portal_accounts. Shared by the `provision` and `upload` actions so an upload never
// fails just because the tree was never provisioned by hand.
async function ensureFolders(
  drive: ReturnType<typeof google.drive>,
  supabase: SupabaseClient,
  account: AccountRow,
  rootFolderId: string,
): Promise<{ rootId: string; rootLink: string | null; folders: Record<string, string> }> {
  let rootId = account.drive_folder_id;
  let rootLink = account.drive_web_link;
  if (!rootId) {
    const created = await createFolder(drive, account.name, rootFolderId);
    rootId = created.id;
    rootLink = created.link;
  }

  const folders: Record<string, string> = { ...(account.drive_folders ?? {}) };
  for (const sub of ACCOUNT_SUBFOLDERS) {
    if (!folders[sub.key]) {
      const created = await createFolder(drive, sub.name, rootId);
      folders[sub.key] = created.id;
    }
  }

  const { error } = await supabase
    .from('portal_accounts')
    .update({ drive_folder_id: rootId, drive_web_link: rootLink, drive_folders: folders })
    .eq('id', account.id);
  if (error) throw new Error(error.message);

  return { rootId, rootLink, folders };
}

type OpportunityRow = {
  id: string;
  name: string;
  account_id: string;
  drive_folder_id: string | null;
  drive_web_link: string | null;
  drive_folders: Record<string, string> | null;
};

// Idempotently makes sure an opportunity has its own folder (under the account root) and every
// OPP_SUBFOLDER, persisting the ids on portal_opportunities. Shared by the `provisionOpportunity`
// action and any opportunity-scoped upload, so uploading is enough to bootstrap an opp's tree —
// including pre-existing opportunities created before this structure existed.
async function ensureOpportunityFolders(
  drive: ReturnType<typeof google.drive>,
  supabase: SupabaseClient,
  opp: OpportunityRow,
  accountRootId: string,
): Promise<{ folderId: string; webLink: string | null; folders: Record<string, string> }> {
  let folderId = opp.drive_folder_id;
  let webLink = opp.drive_web_link;
  if (!folderId) {
    const created = await createFolder(drive, opp.name, accountRootId);
    folderId = created.id;
    webLink = created.link;
  }

  const folders: Record<string, string> = { ...(opp.drive_folders ?? {}) };
  for (const sub of OPP_SUBFOLDERS) {
    if (!folders[sub.key]) {
      const created = await createFolder(drive, sub.name, folderId);
      folders[sub.key] = created.id;
    }
  }

  const { error } = await supabase
    .from('portal_opportunities')
    .update({ drive_folder_id: folderId, drive_web_link: webLink, drive_folders: folders })
    .eq('id', opp.id);
  if (error) throw new Error(error.message);

  return { folderId, webLink, folders };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // Admin gate: valid Supabase session belonging to an internal portal user.
    const token = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice('Bearer '.length)
      : null;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const supabase = serviceClient();
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) return res.status(401).json({ error: 'Unauthorized' });

    const { data: me } = await supabase
      .from('portal_users')
      .select('id, role, account_id')
      .eq('auth_user_id', authData.user.id)
      .maybeSingle();
    const isInternal = Boolean(me && INTERNAL_ROLES.includes(me.role));
    const isClient = Boolean(me && !isInternal && me.account_id);
    if (!me || (!isInternal && !isClient)) return res.status(403).json({ error: 'Forbidden' });

    const { action, accountId, opportunityId, folderKey, storagePath, name, documentId, resourceId } =
      (req.body ?? {}) as {
        action?: string;
        accountId?: string;
        opportunityId?: string;
        folderKey?: string;
        storagePath?: string;
        name?: string;
        documentId?: string;
        resourceId?: string;
      };
    if (!accountId) return res.status(400).json({ error: 'accountId is required' });

    let drive: ReturnType<typeof google.drive>;
    let rootFolderId: string;
    try {
      ({ drive, rootFolderId } = driveClient());
    } catch (error) {
      if (error instanceof Error && error.message === 'DRIVE_NOT_CONFIGURED') {
        return res.status(503).json({ error: 'DRIVE_NOT_CONFIGURED' });
      }
      throw error;
    }

    // Clients are locked to safe actions on their own account's Drive.
    if (isClient && (!CLIENT_ACTIONS.includes(action ?? '') || accountId !== me.account_id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    // Implementers (internal, non full-access) may only touch accounts they are staffed on.
    if (isInternal && !FULL_ACCESS_ROLES.includes(me.role) && !(await isStaffedOn(supabase, me.id, accountId))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { data: account, error: accountError } = await supabase
      .from('portal_accounts')
      .select('id, name, drive_folder_id, drive_web_link, drive_folders')
      .eq('id', accountId)
      .single();
    if (accountError || !account) return res.status(404).json({ error: 'Account not found' });

    // Opportunity-scoped actions load the opportunity up front and verify it belongs to the
    // account, so deal artefacts always land under the right opportunity's folder.
    let opportunity: OpportunityRow | null = null;
    if (opportunityId) {
      const { data: opp, error: oppError } = await supabase
        .from('portal_opportunities')
        .select('id, name, account_id, drive_folder_id, drive_web_link, drive_folders')
        .eq('id', opportunityId)
        .single();
      if (oppError || !opp) return res.status(404).json({ error: 'Opportunity not found' });
      if (opp.account_id !== accountId) return res.status(403).json({ error: 'Forbidden' });
      opportunity = opp as OpportunityRow;
    }

    /* -------------------------------------------------------------- provision */
    if (action === 'provision') {
      const { rootId, rootLink, folders } = await ensureFolders(drive, supabase, account, rootFolderId);
      return res.status(200).json({ ok: true, folderId: rootId, webLink: rootLink, folders });
    }

    /* ------------------------------------------------ provision opportunity */
    if (action === 'provisionOpportunity') {
      if (!opportunity) return res.status(400).json({ error: 'opportunityId is required' });
      const { rootId } = await ensureFolders(drive, supabase, account, rootFolderId);
      const { folderId, webLink, folders } = await ensureOpportunityFolders(drive, supabase, opportunity, rootId);
      return res.status(200).json({ ok: true, folderId, webLink, folders });
    }

    /* ----------------------------------------------------------------- rename */
    // Keep the Drive root folder's name in sync with the account name. Called after an account
    // is renamed in the portal; the DB already holds the new name, so we push it to Drive.
    if (action === 'rename') {
      if (!account.drive_folder_id) return res.status(409).json({ error: 'Folders not provisioned yet' });

      const { data } = await drive.files.update({
        fileId: account.drive_folder_id,
        requestBody: { name: account.name },
        fields: 'id, webViewLink',
        supportsAllDrives: true,
      });

      // The share link is stable across a rename, but refresh our stored copy just in case.
      if (data.webViewLink && data.webViewLink !== account.drive_web_link) {
        await supabase
          .from('portal_accounts')
          .update({ drive_web_link: data.webViewLink })
          .eq('id', account.id);
      }
      return res.status(200).json({ ok: true, webLink: data.webViewLink ?? account.drive_web_link });
    }

    /* ----------------------------------------------------------------- upload */
    if (action === 'upload') {
      if (!storagePath) return res.status(400).json({ error: 'storagePath is required' });

      // The browser already put the bytes in the private Supabase bucket; pull them here with
      // the service role and push a copy into the matching folder. Auto-provisions the tree if it
      // was never created, so uploading is enough to bootstrap the Drive. Opportunity-scoped
      // uploads land in the opportunity's own subfolder tree; everything else in the account root.
      const { rootId, folders: accountFolders } = await ensureFolders(drive, supabase, account, rootFolderId);
      let parentId: string;
      if (opportunity) {
        const { folderId, folders } = await ensureOpportunityFolders(drive, supabase, opportunity, rootId);
        parentId = (folderKey && folders[folderKey]) || folderId;
      } else {
        parentId = (folderKey && accountFolders[folderKey]) || rootId;
      }

      const { data: blob, error: downloadError } = await supabase.storage
        .from('portal-documents')
        .download(storagePath);
      if (downloadError || !blob) {
        return res.status(404).json({ error: `File not found in storage: ${storagePath}` });
      }
      const buffer = Buffer.from(await blob.arrayBuffer());

      const { data: uploaded } = await drive.files.create({
        requestBody: { name: name || storagePath.split('/').pop() || 'upload', parents: [parentId] },
        media: { mimeType: blob.type || 'application/octet-stream', body: Readable.from(buffer) },
        fields: 'id, webViewLink',
        supportsAllDrives: true,
      });

      // Backfill the pointer on the document row when this upload was a portal_document, and
      // promote Drive to the file's home: file_url now points at Drive so every "Open" button
      // works, and the temporary bucket copy is dropped (Drive is the single source of truth).
      if (documentId) {
        await supabase
          .from('portal_documents')
          .update({
            drive_file_id: uploaded.id,
            drive_web_link: uploaded.webViewLink ?? null,
            file_url: uploaded.webViewLink ?? null,
          })
          .eq('id', documentId);
        // Best-effort cleanup — a lingering temp file must not fail the upload.
        await supabase.storage.from('portal-documents').remove([storagePath]).catch(() => {});
      } else if (resourceId) {
        // Onboarding-material rows point at file_path; repoint it at Drive and drop the temp copy.
        await supabase
          .from('portal_resources')
          .update({ file_path: uploaded.webViewLink ?? null })
          .eq('id', resourceId);
        await supabase.storage.from('portal-documents').remove([storagePath]).catch(() => {});
      }

      return res.status(200).json({ ok: true, fileId: uploaded.id, webLink: uploaded.webViewLink ?? null });
    }

    /* ------------------------------------------------------------------- list */
    if (action === 'list') {
      const scope = opportunity
        ? { folders: (opportunity.drive_folders ?? {}) as Record<string, string>, root: opportunity.drive_folder_id }
        : { folders: (account.drive_folders ?? {}) as Record<string, string>, root: account.drive_folder_id };
      const parentId = folderKey ? scope.folders[folderKey] : scope.root;
      if (!parentId) return res.status(200).json({ files: [] });

      const { data } = await drive.files.list({
        q: `'${parentId}' in parents and trashed = false`,
        fields: 'files(id, name, mimeType, webViewLink, modifiedTime, size)',
        orderBy: 'folder,name',
        pageSize: 200,
        ...SHARED,
      });
      return res.status(200).json({ files: data.files ?? [] });
    }

    /* ------------------------------------------------------------------ share */
    if (action === 'share') {
      if (!account.drive_folder_id) return res.status(409).json({ error: 'Folders not provisioned yet' });

      // Everyone attached to the account gets read access to the whole folder. Sharing is
      // best-effort: a non-Google address simply won't resolve, and we report which did.
      const { data: users } = await supabase
        .from('portal_users')
        .select('email, role')
        .eq('account_id', accountId);

      const shared: string[] = [];
      const skipped: string[] = [];
      for (const user of users ?? []) {
        try {
          await drive.permissions.create({
            fileId: account.drive_folder_id,
            sendNotificationEmail: false,
            requestBody: { type: 'user', role: 'reader', emailAddress: user.email },
            supportsAllDrives: true,
          });
          shared.push(user.email);
        } catch {
          skipped.push(user.email);
        }
      }
      return res.status(200).json({ ok: true, shared, skipped });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (error) {
    console.error('Unhandled error in api/google/drive:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Drive request failed' });
  }
}
