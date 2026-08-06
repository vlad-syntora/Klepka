import React from 'react';
import { toast } from 'sonner';
import { CalendarClock, CheckCircle2, ChevronDown, Eye, Loader2, Paperclip } from 'lucide-react';
import { usePortalData } from '@/app/hooks/use-portal-data';
import { getDocumentUrl, updateIntakeItem, uploadClientDocument } from '@/app/lib/portal-api';
import { resolveFileView } from '@/app/lib/file-view';
import { formatDate } from '@/app/lib/portal-format';
import { INTAKE_STATUS_LABELS, STAGE_LABELS, type IntakeItem, type PortalDocument } from '@/app/lib/portal-types';
import { FileViewer, type FileViewerFile } from '@/app/components/portal/FileViewer';
import { cn } from '@/app/components/ui/utils';
import { EmptyState, Field, InfoNote, PortalButton, PortalCard, StatusTag, Tone, inputClass, toneFor } from '@/app/components/portal/PortalUi';

// An item is "settled" once the client has handed it off — the due date stops mattering then and
// the card can collapse out of the way.
const SETTLED = ['submitted', 'in_review', 'approved'];

// Files attached to an intake item land in the account's Discovery Drive folder.
const DISCOVERY_FOLDER = '01_discovery';

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
};

const daysUntil = (iso: string) =>
  Math.round((new Date(`${iso.slice(0, 10)}T00:00:00`).getTime() - startOfToday()) / 86_400_000);

interface DueInfo {
  text: string;
  tone: Tone;
  urgent: boolean; // due soon or overdue — worth a bright colour
  overdue: boolean;
}

/**
 * How a due date should read to the client: overdue and near-term items get a bright colour, the
 * rest stay quiet. Settled items only ever show a muted date.
 */
const dueInfo = (item: IntakeItem): DueInfo | null => {
  if (!item.due_date) return null;
  const muted: DueInfo = { text: `Due ${formatDate(item.due_date)}`, tone: 'grey', urgent: false, overdue: false };
  if (SETTLED.includes(item.status)) return muted;

  const days = daysUntil(item.due_date);
  if (days < 0) {
    return { text: days === -1 ? 'Overdue by 1 day' : `Overdue by ${-days} days`, tone: 'red', urgent: true, overdue: true };
  }
  if (days === 0) return { text: 'Due today', tone: 'amber', urgent: true, overdue: false };
  if (days === 1) return { text: 'Due tomorrow', tone: 'amber', urgent: true, overdue: false };
  if (days <= 3) return { text: `Due in ${days} days`, tone: 'amber', urgent: true, overdue: false };
  return muted;
};

// Bright, solid pill for the due date — the more urgent, the louder.
const duePillClass = (info: DueInfo) =>
  info.overdue
    ? 'bg-portal-red text-white'
    : info.urgent
      ? 'bg-portal-amber text-white'
      : 'bg-slate-100 text-slate-600';

const Item: React.FC<{
  item: IntakeItem;
  accountId: string;
  docs: PortalDocument[];
  onView: (file: FileViewerFile) => void;
  onChanged: () => Promise<void>;
}> = ({ item, accountId, docs, onView, onChanged }) => {
  const [note, setNote] = React.useState(item.client_note ?? '');
  const [due, setDue] = React.useState((item.due_date ?? '').slice(0, 10));
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const fileInput = React.useRef<HTMLInputElement>(null);
  const mine = item.owner_side === 'client';
  const locked = SETTLED.includes(item.status);
  // Settled items collapse — there's nothing to act on. The client can still expand them by hand.
  // Re-sync on every status change so an item collapses the moment it's submitted (the component
  // instance persists across the reload, so the initial state alone wouldn't catch it).
  const [expanded, setExpanded] = React.useState(!locked);
  React.useEffect(() => {
    setExpanded(!SETTLED.includes(item.status));
  }, [item.status]);
  const info = dueInfo(item);

  const submit = async (status: 'in_progress' | 'submitted') => {
    setBusy(true);
    try {
      await updateIntakeItem(item.id, status, note.trim() || undefined, due || null);
      toast.success(status === 'submitted' ? 'Submitted for review.' : 'Saved.');
      setOpen(false);
      await onChanged();
    } catch (cause) {
      toast.error('Could not update', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const upload = async (picked: File) => {
    setUploading(true);
    try {
      await uploadClientDocument(accountId, picked, picked.name, {
        intakeItemId: item.id,
        opportunityId: item.opportunity_id,
        folderKey: DISCOVERY_FOLDER,
      });
      toast.success('File attached.');
      if (fileInput.current) fileInput.current.value = '';
      await onChanged();
    } catch (cause) {
      toast.error('Upload failed', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setUploading(false);
    }
  };

  const viewDoc = async (doc: PortalDocument) => {
    if (!doc.file_url) return;
    try {
      const resolved = await getDocumentUrl(doc.file_url);
      onView({ title: doc.name, ...resolveFileView(resolved, doc.drive_file_id) });
    } catch (cause) {
      toast.error('Could not open the file', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  return (
    <li
      className={cn(
        'rounded-xl border p-3 transition-colors',
        info?.overdue
          ? 'border-portal-red/40 bg-portal-red/5'
          : info?.urgent
            ? 'border-portal-amber/40 bg-portal-amber/5'
            : 'border-border-color bg-card',
      )}
    >
      {/* Header — everything at a glance: name, status, due date, submitted date. */}
      <div className="flex flex-wrap items-center gap-2">
        {locked && <CheckCircle2 className="h-4 w-4 shrink-0 text-portal-green" />}
        <span className="text-sm font-medium">{item.name}</span>
        <StatusTag tone={toneFor(item.status)}>{INTAKE_STATUS_LABELS[item.status]}</StatusTag>
        <StatusTag tone={mine ? 'violet' : 'grey'}>{mine ? 'Your side' : 'Klepka'}</StatusTag>
        {info ? (
          <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold', duePillClass(info))}>
            <CalendarClock className="h-3.5 w-3.5" />
            {info.text}
          </span>
        ) : (
          <span className="text-xs text-grey">No target date yet</span>
        )}
        {item.submitted_at && (
          <span className="text-xs text-grey">Submitted {formatDate(item.submitted_at)}</span>
        )}
        {docs.length > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-grey">
            <Paperclip className="h-3.5 w-3.5" />
            {docs.length}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {mine && (
            <>
              <input
                ref={fileInput}
                type="file"
                className="hidden"
                onChange={(event) => {
                  const picked = event.target.files?.[0];
                  if (picked) void upload(picked);
                }}
              />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-grey transition-colors hover:bg-portal-tint/60 disabled:opacity-50"
                aria-label="Attach file"
                title="Attach file"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
              </button>
            </>
          )}
          {mine && !locked && !open && (
            <PortalButton onClick={() => submit('submitted')} disabled={busy}>
              <CheckCircle2 className="h-4 w-4" /> Done
            </PortalButton>
          )}
          {mine && !locked && (
            <PortalButton variant={open ? 'ghost' : 'secondary'} onClick={() => setOpen((value) => !value)}>
              {open ? 'Cancel' : 'Update'}
            </PortalButton>
          )}
          {locked && (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-grey transition-colors hover:bg-portal-tint/60"
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} />
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <>
          {item.description && <p className="mt-1.5 text-sm text-grey">{item.description}</p>}

          {item.client_note && !open && (
            <div className="mt-2 rounded-lg border border-border-color bg-off-white px-3 py-2 text-sm">
              <span className="text-xs font-semibold uppercase tracking-wide text-grey">Your note</span>
              <p className="mt-0.5 whitespace-pre-line">{item.client_note}</p>
            </div>
          )}

          {item.review_note && (
            <div className="mt-2 rounded-lg bg-portal-tint px-3 py-2 text-sm text-violet">
              <span className="text-xs font-semibold uppercase tracking-wide">Klepka review</span>
              <p className="mt-0.5 whitespace-pre-line">{item.review_note}</p>
            </div>
          )}

          {/* Attached files — stored in the Discovery folder, visible to both sides. */}
          {docs.length > 0 && (
            <ul className="mt-2 space-y-1">
              {docs.map((doc) => (
                <li key={doc.id}>
                  <button
                    type="button"
                    onClick={() => viewDoc(doc)}
                    className="flex w-full items-center gap-2 rounded-lg border border-border-color bg-off-white px-3 py-1.5 text-left text-sm transition-colors hover:bg-portal-tint/60"
                  >
                    <Paperclip className="h-4 w-4 shrink-0 text-violet" />
                    <span className="min-w-0 flex-1 truncate">{doc.name}</span>
                    <Eye className="h-4 w-4 shrink-0 text-grey" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {open && mine && !locked && (
            <div className="mt-2 space-y-3 rounded-lg border border-border-color bg-off-white p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Target date" hint="When you expect to have this ready.">
                  <input
                    type="date"
                    className={inputClass}
                    value={due}
                    onChange={(event) => setDue(event.target.value)}
                  />
                </Field>
              </div>
              <Field label="Note" hint="Anything we should know — links, caveats, open questions.">
                <textarea
                  rows={3}
                  className={inputClass}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                <PortalButton onClick={() => submit('submitted')} disabled={busy}>
                  Submit for review
                </PortalButton>
                <PortalButton variant="secondary" onClick={() => submit('in_progress')} disabled={busy}>
                  Save as in progress
                </PortalButton>
              </div>
            </div>
          )}
        </>
      )}
    </li>
  );
};

export const PortalIntake: React.FC = () => {
  const { snapshot, reload } = usePortalData();
  const [viewerFile, setViewerFile] = React.useState<FileViewerFile | null>(null);
  const [selectedOppId, setSelectedOppId] = React.useState<string | null>(null);
  if (!snapshot) return null;

  const { documents, account, opportunities } = snapshot;
  // Intake is per-opportunity; with several deals the client picks which checklist to see.
  const selectedOpp = opportunities.find((opp) => opp.id === selectedOppId) ?? opportunities[0] ?? null;
  const intake = selectedOpp
    ? snapshot.intake.filter((item) => item.opportunity_id === selectedOpp.id)
    : snapshot.intake;

  const docsFor = (itemId: string) => documents.filter((doc) => doc.intake_item_id === itemId);
  const mine = intake.filter((item) => item.owner_side === 'client');
  const theirs = intake.filter((item) => item.owner_side === 'klepka');
  const approved = intake.filter((item) => item.status === 'approved').length;
  const waiting = mine.filter((item) => !SETTLED.includes(item.status)).length;

  const infos = intake.map(dueInfo);
  const overdue = infos.filter((info) => info?.overdue).length;
  const dueSoon = infos.filter((info) => info?.urgent && !info.overdue).length;
  const pct = intake.length > 0 ? Math.round((approved / intake.length) * 100) : 0;

  return (
    <div className="space-y-2">
      {opportunities.length > 1 && (
        <PortalCard title="Your opportunities" description="Pick a deal to see its information-gathering checklist.">
          <div className="flex flex-wrap gap-2">
            {opportunities.map((opp) => (
              <button
                key={opp.id}
                onClick={() => setSelectedOppId(opp.id)}
                className={cn(
                  'rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                  opp.id === selectedOpp?.id
                    ? 'border-violet bg-portal-tint text-violet'
                    : 'border-border-color hover:border-violet/50',
                )}
              >
                <div className="font-medium">{opp.name}</div>
                <div className="mt-0.5">
                  <StatusTag tone={toneFor(opp.stage)}>{STAGE_LABELS[opp.stage]}</StatusTag>
                </div>
              </button>
            ))}
          </div>
        </PortalCard>
      )}

      {/* Progress header — one glance tells the client where they stand. */}
      <div className="rounded-xl border border-border-color bg-card px-5 py-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-grey">Discovery progress</div>
            <div className="mt-1 text-2xl font-semibold">
              {approved}
              <span className="ml-1 text-lg font-normal text-grey">/ {intake.length} approved</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {overdue > 0 && <StatusTag tone="red">{overdue} overdue</StatusTag>}
            {dueSoon > 0 && <StatusTag tone="amber">{dueSoon} due soon</StatusTag>}
            {waiting > 0 && <StatusTag tone="violet">{waiting} waiting on you</StatusTag>}
            {waiting === 0 && overdue === 0 && intake.length > 0 && (
              <StatusTag tone="green">All caught up</StatusTag>
            )}
          </div>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-violet transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <PortalCard
        title="What we need from you"
        description="Submit each item for review — attach any supporting files right under it."
      >
        {mine.length === 0 ? (
          <EmptyState title="Nothing needed from you right now" />
        ) : (
          <ul className="space-y-1.5">
            {mine.map((item) => (
              <Item
                key={item.id}
                item={item}
                accountId={account.id}
                docs={docsFor(item.id)}
                onView={setViewerFile}
                onChanged={reload}
              />
            ))}
          </ul>
        )}
      </PortalCard>

      {theirs.length > 0 && (
        <PortalCard title="What we're working on" description="Our side of the discovery — visible so nothing looks stalled.">
          <ul className="space-y-1.5">
            {theirs.map((item) => (
              <Item
                key={item.id}
                item={item}
                accountId={account.id}
                docs={docsFor(item.id)}
                onView={setViewerFile}
                onChanged={reload}
              />
            ))}
          </ul>
        </PortalCard>
      )}

      <InfoNote>
        Once everything here is approved we move to scoping, and your proposal appears under
        <strong> Pipeline &amp; Offers</strong>.
      </InfoNote>

      <FileViewer file={viewerFile} onClose={() => setViewerFile(null)} />
    </div>
  );
};
