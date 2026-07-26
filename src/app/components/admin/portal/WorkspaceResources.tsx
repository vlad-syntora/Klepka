import React from 'react';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useAsync } from '@/app/hooks/use-async';
import {
  DriveNotConfiguredError,
  PHASE_TO_DRIVE_FOLDER,
  adminDeleteResource,
  adminListResources,
  adminUploadResourceFile,
  adminUpsertResource,
  driveUploadFromStorage,
} from '@/app/lib/portal-admin-api';
import { adminListArticles } from '@/app/lib/admin-api';
import {
  RESOURCE_KINDS,
  RESOURCE_KIND_LABELS,
  type PortalAccount,
  type PortalResource,
} from '@/app/lib/portal-types';
import { PHASE_LABELS } from '@/app/lib/portal-phase';
import {
  Cell,
  EmptyState,
  ErrorNote,
  Field,
  InfoNote,
  PortalButton,
  PortalCard,
  PortalSpinner,
  PortalTable,
  Row,
  StatusTag,
  inputClass,
} from '@/app/components/portal/PortalUi';

const PHASES: PortalResource['phase'][] = ['onboarding', 'discovery', 'proposal', 'delivery', 'any'];

const phaseLabel = (phase: PortalResource['phase']) =>
  phase === 'any' ? 'All stages' : PHASE_LABELS[phase];

export const WorkspaceResources: React.FC<{ account: PortalAccount }> = ({ account }) => {
  const resources = useAsync(() => adminListResources(account.id), [account.id]);
  const articles = useAsync(() => adminListArticles(), []);

  const [showForm, setShowForm] = React.useState(false);
  // The material being edited (its existing file_path is kept unless a new file is uploaded). null = adding new.
  const [editing, setEditing] = React.useState<PortalResource | null>(null);
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [kind, setKind] = React.useState<PortalResource['kind']>('presentation');
  const [phase, setPhase] = React.useState<PortalResource['phase']>('onboarding');
  const [url, setUrl] = React.useState('');
  const [articleId, setArticleId] = React.useState('');
  const [file, setFile] = React.useState<File | null>(null);
  const [shared, setShared] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const rows = resources.data ?? [];

  const resetForm = () => {
    setEditing(null);
    setTitle('');
    setDescription('');
    setKind('presentation');
    setPhase('onboarding');
    setUrl('');
    setArticleId('');
    setFile(null);
    setShared(false);
  };

  const startAdd = () => {
    if (showForm && !editing) {
      setShowForm(false);
      return;
    }
    resetForm();
    setShowForm(true);
  };

  const startEdit = (resource: PortalResource) => {
    setEditing(resource);
    setTitle(resource.title ?? '');
    setDescription(resource.description ?? '');
    setKind(resource.kind);
    setPhase(resource.phase);
    setUrl(resource.url ?? '');
    setArticleId(resource.article_id ?? '');
    setFile(null);
    setShared(resource.account_id === null);
    setShowForm(true);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (kind === 'article' && !articleId) {
      toast.error('Pick an article.');
      return;
    }
    // Non-article material needs a source: a link, a new upload, or (when editing) a file already attached.
    const hasExistingFile = Boolean(editing?.file_path);
    if (kind !== 'article' && !url.trim() && !file && !hasExistingFile) {
      toast.error('Add a link or upload a file.');
      return;
    }

    setBusy(true);
    try {
      const accountId = shared ? null : account.id;
      // Upload a new file if provided; otherwise keep the existing one when editing (null when adding).
      const filePath = file ? await adminUploadResourceFile(accountId, file) : (editing?.file_path ?? null);
      const resourceId = await adminUpsertResource({
        id: editing?.id,
        account_id: accountId,
        title: title.trim() || 'Untitled',
        description: description.trim(),
        kind,
        url: url.trim() || null,
        file_path: filePath,
        article_id: kind === 'article' ? articleId : null,
        phase,
        position: editing?.position ?? rows.length,
        published: editing?.published ?? true,
      });

      // Move an account-specific upload into Drive (server repoints file_path at the Drive link and
      // drops the temp copy). A phase with no dedicated folder — and 'any' — lands in the account
      // root. Best-effort: a shared-library file has no single account, and a missing Drive setup
      // shouldn't block the save that already succeeded above.
      if (file && filePath && !shared) {
        try {
          await driveUploadFromStorage({
            accountId: account.id,
            storagePath: filePath,
            folderKey: PHASE_TO_DRIVE_FOLDER[phase], // undefined → account root folder
            name: title.trim() || file.name,
            resourceId,
          });
        } catch (cause) {
          if (!(cause instanceof DriveNotConfiguredError)) {
            toast.warning('Saved, but could not move the file to Google Drive', {
              description: cause instanceof Error ? cause.message : undefined,
            });
          }
        }
      }

      toast.success(editing ? 'Material updated.' : shared ? 'Added to the shared library.' : 'Added for this account.');
      resetForm();
      setShowForm(false);
      await resources.reload();
    } catch (cause) {
      toast.error('Could not save', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const togglePublished = async (resource: PortalResource) => {
    try {
      await adminUpsertResource({
        id: resource.id,
        account_id: resource.account_id,
        title: resource.title,
        description: resource.description,
        kind: resource.kind,
        url: resource.url,
        file_path: resource.file_path,
        article_id: resource.article_id,
        phase: resource.phase,
        position: resource.position,
        published: !resource.published,
      });
      await resources.reload();
    } catch (cause) {
      toast.error('Could not update', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  const remove = async (resource: PortalResource) => {
    if (!window.confirm(`Remove "${resource.title}"?`)) return;
    await adminDeleteResource(resource.id);
    await resources.reload();
  };

  if (resources.loading) return <PortalSpinner />;
  if (resources.error) return <ErrorNote>{resources.error}</ErrorNote>;

  return (
    <div className="space-y-5">
      <PortalCard
        title="Onboarding material"
        description="Presentations, docs and articles the client sees under Getting started."
        action={
          <PortalButton onClick={startAdd}>
            <Plus className="h-4 w-4" /> Add material
          </PortalButton>
        }
      >
        {showForm && (
          <form onSubmit={submit} className="mb-4 space-y-3 rounded-lg border border-border-color bg-off-white p-4">
            <div className="text-sm font-semibold">{editing ? 'Edit material' : 'New material'}</div>
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Kind">
                <select
                  className={inputClass}
                  value={kind}
                  onChange={(event) => setKind(event.target.value as PortalResource['kind'])}
                >
                  {RESOURCE_KINDS.map((value) => (
                    <option key={value} value={value}>
                      {RESOURCE_KIND_LABELS[value]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Shown from" hint="And every stage after it.">
                <select
                  className={inputClass}
                  value={phase}
                  onChange={(event) => setPhase(event.target.value as PortalResource['phase'])}
                >
                  {PHASES.map((value) => (
                    <option key={value} value={value}>
                      {phaseLabel(value)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Title" className="sm:col-span-2">
                <input className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} />
              </Field>
            </div>

            <Field label="Description">
              <input
                className={inputClass}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>

            {kind === 'article' ? (
              <Field label="Article" hint="Published articles from the site.">
                <select className={inputClass} value={articleId} onChange={(event) => setArticleId(event.target.value)}>
                  <option value="">Select…</option>
                  {(articles.data ?? [])
                    .filter((article) => article.status === 'published')
                    .map((article) => (
                      <option key={article.id} value={article.id}>
                        {article.title}
                      </option>
                    ))}
                </select>
              </Field>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Link" hint="External URL — or upload a file instead.">
                  <input className={inputClass} value={url} onChange={(event) => setUrl(event.target.value)} />
                </Field>
                <Field
                  label="Upload"
                  hint={editing?.file_path ? 'Leave empty to keep the current file.' : undefined}
                >
                  <input
                    type="file"
                    className={`${inputClass} py-1.5`}
                    onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  />
                </Field>
              </div>
            )}

            <label className="flex items-center gap-2 text-sm text-grey">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[color:var(--violet)]"
                checked={shared}
                onChange={(event) => setShared(event.target.checked)}
              />
              Add to the shared library — every account sees it, not just {account.name}
            </label>

            <div className="flex gap-2">
              <PortalButton type="submit" disabled={busy}>
                {busy ? 'Saving…' : editing ? 'Save changes' : 'Add'}
              </PortalButton>
              <PortalButton
                variant="ghost"
                type="button"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
              >
                Cancel
              </PortalButton>
            </div>
          </form>
        )}

        {rows.length === 0 ? (
          <EmptyState title="No material yet" description="A new lead lands on an empty Getting started page." />
        ) : (
          <PortalTable head={['Title', 'Kind', 'Shown from', 'Scope', 'Visible', '']}>
            {rows.map((resource) => (
              <Row key={resource.id}>
                <Cell>
                  <div className="font-medium">{resource.title || resource.article?.title}</div>
                  {resource.description && <div className="text-xs text-grey">{resource.description}</div>}
                </Cell>
                <Cell className="whitespace-nowrap text-grey">{RESOURCE_KIND_LABELS[resource.kind]}</Cell>
                <Cell className="whitespace-nowrap text-grey">{phaseLabel(resource.phase)}</Cell>
                <Cell>
                  <StatusTag tone={resource.account_id ? 'violet' : 'grey'}>
                    {resource.account_id ? 'This account' : 'Shared'}
                  </StatusTag>
                </Cell>
                <Cell>
                  <PortalButton variant="ghost" onClick={() => togglePublished(resource)}>
                    <StatusTag tone={resource.published ? 'green' : 'grey'}>
                      {resource.published ? 'Visible' : 'Hidden'}
                    </StatusTag>
                  </PortalButton>
                </Cell>
                <Cell className="text-right">
                  <div className="flex justify-end gap-1">
                    <PortalButton variant="ghost" onClick={() => startEdit(resource)} aria-label="Edit">
                      <Pencil className="h-4 w-4" />
                    </PortalButton>
                    <PortalButton variant="ghost" onClick={() => remove(resource)} aria-label="Remove">
                      <Trash2 className="h-4 w-4" />
                    </PortalButton>
                  </div>
                </Cell>
              </Row>
            ))}
          </PortalTable>
        )}
      </PortalCard>

      <InfoNote>
        Material tagged with a stage appears from that stage onwards — an onboarding deck stays available later, but a
        delivery handbook won’t leak to a brand-new lead. Shared items are the default kit every new account gets.
      </InfoNote>
    </div>
  );
};
