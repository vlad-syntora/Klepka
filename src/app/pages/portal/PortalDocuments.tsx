import React from 'react';
import { toast } from 'sonner';
import { Eye, Link2, PenLine, Upload } from 'lucide-react';
import { usePortalData } from '@/app/hooks/use-portal-data';
import { getDocumentUrl, uploadClientDocument } from '@/app/lib/portal-api';
import { resolveFileView } from '@/app/lib/file-view';
import { FileViewer, type FileViewerFile } from '@/app/components/portal/FileViewer';
import { formatDate } from '@/app/lib/portal-format';
import { DOC_STATUS_LABELS, DOC_TYPES, DOC_TYPE_LABELS, type DocType } from '@/app/lib/portal-types';
import {
  Cell,
  EmptyState,
  Field,
  InfoNote,
  PortalButton,
  PortalCard,
  PortalTable,
  Row,
  StatusTag,
  inputClass,
  toneFor,
} from '@/app/components/portal/PortalUi';

export const PortalDocuments: React.FC = () => {
  const { snapshot, reload } = usePortalData();
  const [filter, setFilter] = React.useState<DocType | 'all'>('all');
  const [uploading, setUploading] = React.useState(false);
  const [showUpload, setShowUpload] = React.useState(false);
  const [name, setName] = React.useState('');
  const [file, setFile] = React.useState<File | null>(null);
  const [viewerFile, setViewerFile] = React.useState<FileViewerFile | null>(null);

  if (!snapshot) return null;

  const documents = snapshot.documents.filter((doc) => filter === 'all' || doc.doc_type === filter);
  const presentTypes = Array.from(new Set(snapshot.documents.map((doc) => doc.doc_type)));

  // Signature docs still open in the e-signature provider; everything else previews inside the portal.
  const openDocument = async (path: string | null) => {
    if (!path) {
      toast.error('This document has no file attached yet.');
      return;
    }
    try {
      window.open(await getDocumentUrl(path), '_blank', 'noopener');
    } catch (cause) {
      toast.error('Could not open the document', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  const viewDocument = async (doc: (typeof documents)[number]) => {
    if (!doc.file_url) {
      toast.error('This document has no file attached yet.');
      return;
    }
    try {
      const resolved = await getDocumentUrl(doc.file_url);
      setViewerFile({ title: doc.name, ...resolveFileView(resolved, doc.drive_file_id) });
    } catch (cause) {
      toast.error('Could not open the document', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  // The Drive share link (falls back to a direct http file_url) — copyable to paste elsewhere.
  const shareLink = (doc: { drive_web_link?: string | null; file_url: string | null }) =>
    doc.drive_web_link || (doc.file_url && /^https?:\/\//.test(doc.file_url) ? doc.file_url : null);

  const copyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Link copied.');
    } catch {
      toast.error('Could not copy — here it is:', { description: link });
    }
  };

  const submitUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) {
      toast.error('Choose a file first.');
      return;
    }
    setUploading(true);
    try {
      await uploadClientDocument(snapshot.account.id, file, name.trim() || file.name);
      toast.success('Uploaded — your Klepka team can see it now.');
      setFile(null);
      setName('');
      setShowUpload(false);
      await reload();
    } catch (cause) {
      toast.error('Upload failed', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <PortalCard
        title="Documents"
        description="Contracts, SOWs, proposals and anything you share with us."
        action={
          <>
            <select
              className={`${inputClass} w-auto py-1.5 text-xs`}
              value={filter}
              onChange={(event) => setFilter(event.target.value as DocType | 'all')}
            >
              <option value="all">All types</option>
              {DOC_TYPES.filter((type) => presentTypes.includes(type)).map((type) => (
                <option key={type} value={type}>
                  {DOC_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
            <PortalButton variant="secondary" onClick={() => setShowUpload((open) => !open)}>
              <Upload className="h-4 w-4" /> Upload
            </PortalButton>
          </>
        }
      >
        {showUpload && (
          <form onSubmit={submitUpload} className="mb-4 space-y-3 rounded-lg border border-border-color bg-off-white p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Document name">
                <input
                  className={inputClass}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Defaults to the file name"
                />
              </Field>
              <Field label="File">
                <input
                  type="file"
                  className={`${inputClass} py-1.5`}
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  required
                />
              </Field>
            </div>
            <div className="flex gap-2">
              <PortalButton type="submit" disabled={uploading}>
                {uploading ? 'Uploading…' : 'Upload document'}
              </PortalButton>
              <PortalButton variant="ghost" type="button" onClick={() => setShowUpload(false)}>
                Cancel
              </PortalButton>
            </div>
          </form>
        )}

        {documents.length === 0 ? (
          <EmptyState title="No documents yet" description="Anything Klepka shares with you shows up here." />
        ) : (
          <PortalTable head={['Document', 'Type', 'Status', 'Updated', '']}>
            {documents.map((doc) => (
              <Row key={doc.id}>
                <Cell>
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-portal-tint text-[10px] font-bold uppercase text-violet">
                      {doc.doc_type.slice(0, 2)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{doc.name}</span>
                      <span className="text-xs text-grey">
                        v{doc.version}
                        {doc.uploaded_by_client ? ' · uploaded by you' : ''}
                      </span>
                    </span>
                  </div>
                </Cell>
                <Cell className="whitespace-nowrap text-grey">{DOC_TYPE_LABELS[doc.doc_type]}</Cell>
                <Cell>
                  <StatusTag tone={toneFor(doc.status)}>{DOC_STATUS_LABELS[doc.status]}</StatusTag>
                </Cell>
                <Cell className="whitespace-nowrap text-grey">{formatDate(doc.updated_at)}</Cell>
                <Cell className="text-right">
                  <div className="inline-flex items-center gap-1.5">
                    {shareLink(doc) && (
                      <PortalButton variant="ghost" onClick={() => copyLink(shareLink(doc)!)} aria-label="Copy link">
                        <Link2 className="h-4 w-4" />
                      </PortalButton>
                    )}
                    {doc.status === 'awaiting_signature' ? (
                      <PortalButton onClick={() => openDocument(doc.file_url)}>
                        <PenLine className="h-4 w-4" /> Sign
                      </PortalButton>
                    ) : doc.file_url ? (
                      <PortalButton variant="ghost" onClick={() => viewDocument(doc)}>
                        <Eye className="h-4 w-4" /> View
                      </PortalButton>
                    ) : (
                      <span className="text-xs text-grey">—</span>
                    )}
                  </div>
                </Cell>
              </Row>
            ))}
          </PortalTable>
        )}
      </PortalCard>

      <InfoNote>
        Documents marked <strong>Signature required</strong> open in our e-signature provider. Every revision is kept —
        earlier versions stay available and are marked <em>Superseded</em>.
      </InfoNote>

      <FileViewer file={viewerFile} onClose={() => setViewerFile(null)} />
    </div>
  );
};
