import React from 'react';
import { toast } from 'sonner';
import { Download, Link2, Trash2, Upload } from 'lucide-react';
import { useAsync } from '@/app/hooks/use-async';
import {
  adminDeleteDocument,
  adminListDocuments,
  adminListOpportunities,
  adminListProjects,
  adminUpdateDocument,
  adminUploadDocument,
} from '@/app/lib/portal-admin-api';
import { getDocumentUrl } from '@/app/lib/portal-api';
import { formatDate } from '@/app/lib/portal-format';
import {
  DOC_STATUSES,
  DOC_STATUS_LABELS,
  DOC_TYPES,
  DOC_TYPE_LABELS,
  type DocStatus,
  type DocType,
  type PortalAccount,
} from '@/app/lib/portal-types';
import {
  Cell,
  EmptyState,
  ErrorNote,
  Field,
  PortalButton,
  PortalCard,
  PortalSpinner,
  PortalTable,
  Row,
  StatusTag,
  inputClass,
  toneFor,
} from '@/app/components/portal/PortalUi';

export const WorkspaceDocuments: React.FC<{ account: PortalAccount }> = ({ account }) => {
  const documents = useAsync(() => adminListDocuments(account.id), [account.id]);
  const opportunities = useAsync(() => adminListOpportunities(account.id), [account.id]);
  const projects = useAsync(() => adminListProjects(account.id), [account.id]);
  const oppName = (id: string | null | undefined) =>
    id ? opportunities.data?.find((entry) => entry.id === id)?.name : undefined;
  const projectName = (id: string | null | undefined) =>
    id ? projects.data?.find((entry) => entry.id === id)?.name : undefined;
  const [showUpload, setShowUpload] = React.useState(false);
  const [name, setName] = React.useState('');
  const [docType, setDocType] = React.useState<DocType>('proposal');
  const [status, setStatus] = React.useState<DocStatus>('sent');
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);

  const upload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      toast.error('Give the document a name.');
      return;
    }
    setBusy(true);
    try {
      await adminUploadDocument({ account_id: account.id, name: name.trim(), doc_type: docType, status, file });
      toast.success('Document added.');
      setName('');
      setFile(null);
      setShowUpload(false);
      await documents.reload();
    } catch (cause) {
      toast.error('Upload failed', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (id: string, next: DocStatus) => {
    try {
      await adminUpdateDocument(id, { status: next });
      await documents.reload();
    } catch (cause) {
      toast.error('Could not update', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  const remove = async (id: string, label: string) => {
    if (!window.confirm(`Delete "${label}"? This removes it from the client's portal.`)) return;
    try {
      await adminDeleteDocument(id);
      await documents.reload();
    } catch (cause) {
      toast.error('Could not delete', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  const open = async (path: string | null) => {
    if (!path) return;
    try {
      window.open(await getDocumentUrl(path), '_blank', 'noopener');
    } catch (cause) {
      toast.error('Could not open', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  // The Drive share link (falls back to a direct http file_url) — copyable so it can be pasted anywhere.
  const shareLink = (doc: { drive_web_link?: string | null; file_url: string | null }) =>
    doc.drive_web_link || (doc.file_url && /^https?:\/\//.test(doc.file_url) ? doc.file_url : null);

  const copyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Drive link copied.');
    } catch {
      toast.error('Could not copy — here it is:', { description: link });
    }
  };

  if (documents.loading) return <PortalSpinner />;
  if (documents.error) return <ErrorNote>{documents.error}</ErrorNote>;

  return (
    <PortalCard
      title="Documents"
      description="Uploading a document with an existing name creates a new version automatically."
      action={
        <PortalButton onClick={() => setShowUpload((value) => !value)}>
          <Upload className="h-4 w-4" /> Add document
        </PortalButton>
      }
    >
      {showUpload && (
        <form onSubmit={upload} className="mb-4 grid gap-3 rounded-lg border border-border-color bg-off-white p-4 sm:grid-cols-5">
          <Field label="Name">
            <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} required />
          </Field>
          <Field label="Type">
            <select className={inputClass} value={docType} onChange={(event) => setDocType(event.target.value as DocType)}>
              {DOC_TYPES.map((type) => (
                <option key={type} value={type}>
                  {DOC_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value as DocStatus)}>
              {DOC_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {DOC_STATUS_LABELS[value]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="File" hint="Optional — a placeholder row is fine.">
            <input
              type="file"
              className={`${inputClass} py-1.5`}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </Field>
          <div className="flex items-end gap-2">
            <PortalButton type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </PortalButton>
            <PortalButton variant="ghost" type="button" onClick={() => setShowUpload(false)}>
              Cancel
            </PortalButton>
          </div>
        </form>
      )}

      {(documents.data ?? []).length === 0 ? (
        <EmptyState title="No documents on this account" />
      ) : (
        <PortalTable head={['Document', 'Type', 'Scope', 'Status', 'Updated', '']}>
          {(documents.data ?? []).map((doc) => (
            <Row key={doc.id}>
              <Cell>
                <div className="font-medium">{doc.name}</div>
                <div className="text-xs text-grey">
                  v{doc.version}
                  {doc.uploaded_by_client ? ' · uploaded by client' : ''}
                </div>
              </Cell>
              <Cell className="whitespace-nowrap text-grey">{DOC_TYPE_LABELS[doc.doc_type]}</Cell>
              <Cell className="text-grey">
                <div className="flex flex-wrap gap-1">
                  {oppName(doc.opportunity_id) && <StatusTag tone="violet">{oppName(doc.opportunity_id)}</StatusTag>}
                  {projectName(doc.related_project_id) && (
                    <StatusTag tone="green">{projectName(doc.related_project_id)}</StatusTag>
                  )}
                  {!doc.opportunity_id && !doc.related_project_id && <span className="text-xs">Account</span>}
                </div>
              </Cell>
              <Cell>
                <select
                  className={`${inputClass} w-auto py-1 text-xs`}
                  value={doc.status}
                  onChange={(event) => changeStatus(doc.id, event.target.value as DocStatus)}
                >
                  {DOC_STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {DOC_STATUS_LABELS[value]}
                    </option>
                  ))}
                </select>
              </Cell>
              <Cell className="whitespace-nowrap text-grey">
                <StatusTag tone={toneFor(doc.status)} className="mr-2">
                  {DOC_STATUS_LABELS[doc.status]}
                </StatusTag>
                {formatDate(doc.updated_at)}
              </Cell>
              <Cell className="whitespace-nowrap text-right">
                {shareLink(doc) && (
                  <PortalButton variant="ghost" onClick={() => copyLink(shareLink(doc)!)} aria-label="Copy Drive link">
                    <Link2 className="h-4 w-4" />
                  </PortalButton>
                )}
                {doc.file_url && (
                  <PortalButton variant="ghost" onClick={() => open(doc.file_url)}>
                    <Download className="h-4 w-4" />
                  </PortalButton>
                )}
                <PortalButton variant="ghost" onClick={() => remove(doc.id, doc.name)} aria-label="Delete document">
                  <Trash2 className="h-4 w-4" />
                </PortalButton>
              </Cell>
            </Row>
          ))}
        </PortalTable>
      )}
    </PortalCard>
  );
};
