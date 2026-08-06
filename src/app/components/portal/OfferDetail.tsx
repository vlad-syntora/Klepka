import React from 'react';
import { toast } from 'sonner';
import { CalendarPlus, Eye, FileText } from 'lucide-react';
import { BookCallButton } from '@/app/components/portal/BookCallButton';
import { HoursBudget } from '@/app/components/portal/HoursBudget';
import { FileViewer, type FileViewerFile } from '@/app/components/portal/FileViewer';
import { resolveFileView } from '@/app/lib/file-view';
import { getDocumentUrl, respondToOffer } from '@/app/lib/portal-api';
import { formatDate, formatMoney, formatOfferTotal, offerTotals } from '@/app/lib/portal-format';
import {
  OFFER_BILLING_LABELS,
  OFFER_STATUS_LABELS,
  type Offer,
  type PortalDocument,
} from '@/app/lib/portal-types';
import {
  Cell,
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

/**
 * The client-facing offer card: summary, hours budget, line items with totals, attached documents,
 * and accept / request-changes actions. Shared by the Pipeline & Offers page and the dashboard's
 * "Offer awaiting your review" widget so the two render an offer identically.
 */
export const OfferDetail: React.FC<{ offer: Offer; documents: PortalDocument[]; onResponded: () => Promise<void> }> = ({
  offer,
  documents,
  onResponded,
}) => {
  const [changeMode, setChangeMode] = React.useState(false);
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [viewerFile, setViewerFile] = React.useState<FileViewerFile | null>(null);
  const open = offer.status === 'sent' || offer.status === 'changes_requested';
  const offerDocs = documents.filter((doc) => doc.related_offer_id === offer.id);

  const viewDoc = async (doc: PortalDocument) => {
    if (!doc.file_url) return;
    try {
      const resolved = await getDocumentUrl(doc.file_url);
      setViewerFile({ title: doc.name, ...resolveFileView(resolved, doc.drive_file_id) });
    } catch (cause) {
      toast.error('Could not open the document', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  const respond = async (decision: 'accepted' | 'changes_requested') => {
    if (decision === 'changes_requested' && note.trim().length === 0) {
      toast.error('Tell us what you would like changed.');
      return;
    }
    setBusy(true);
    try {
      await respondToOffer(offer.id, decision, note.trim() || undefined);
      toast.success(decision === 'accepted' ? 'Offer accepted — your Klepka team is notified.' : 'Change request sent.');
      setChangeMode(false);
      setNote('');
      await onResponded();
    } catch (cause) {
      toast.error('Could not send your response', {
        description: cause instanceof Error ? cause.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const viewPdf = async () => {
    if (!offer.pdf_url) return;
    try {
      const resolved = await getDocumentUrl(offer.pdf_url);
      setViewerFile({ title: `${offer.title} — v${offer.version}`, ...resolveFileView(resolved) });
    } catch (cause) {
      toast.error('Could not open the PDF', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  return (
    <PortalCard
      title={`${offer.title} — v${offer.version}`}
      action={<StatusTag tone={toneFor(offer.status)}>{OFFER_STATUS_LABELS[offer.status]}</StatusTag>}
      description={[
        offer.sent_at ? `Sent ${formatDate(offer.sent_at)}` : null,
        offer.expires_on ? `Valid through ${formatDate(offer.expires_on)}` : null,
        `Total ${formatOfferTotal(offer.items, offer.currency)}`,
      ]
        .filter(Boolean)
        .join(' · ')}
    >
      {offer.summary && <p className="mb-4 text-sm text-grey">{offer.summary}</p>}

      <HoursBudget bank={offer.bank_hours} notify={offer.notify_hours} className="mb-4" />

      {offer.items.length > 0 && (
        <PortalTable head={['Line item', 'Detail', 'Amount']}>
          {[...offer.items]
            .sort((a, b) => a.position - b.position)
            .map((item) => {
              const isFixed = item.billing_type === 'fixed_price';
              // Effective hourly rate for a fixed-price line, derived from its monthly sum and hours.
              const fixedRate =
                isFixed && item.monthly_hours && item.monthly_hours > 0 ? item.amount / item.monthly_hours : null;
              return (
                <Row key={item.id}>
                  <Cell className="font-medium">{item.name}</Cell>
                  <Cell className="text-grey">
                    {item.detail}
                    <div className="text-xs">
                      {OFFER_BILLING_LABELS[item.billing_type]}
                      {isFixed && item.monthly_hours != null && <> · {item.monthly_hours}h/month</>}
                      {fixedRate != null && <> · {formatMoney(fixedRate, offer.currency)}/h</>}
                      {item.overtime_rate != null && <> · OT {formatMoney(item.overtime_rate, offer.currency)}/h</>}
                    </div>
                  </Cell>
                  <Cell className="whitespace-nowrap font-medium">
                    {formatMoney(item.amount, offer.currency)}
                    <span className="text-grey">{isFixed ? '/mo' : '/h'}</span>
                  </Cell>
                </Row>
              );
            })}
          {(() => {
            const totals = offerTotals(offer.items);
            return (
              <>
                {totals.hasFixed && (
                  <Row className="bg-portal-tint/50">
                    <Cell className="font-semibold">Total (fixed price)</Cell>
                    <Cell />
                    <Cell className="whitespace-nowrap font-semibold text-violet">
                      {formatMoney(totals.fixed, offer.currency)}
                      <span className="text-grey">/mo</span>
                    </Cell>
                  </Row>
                )}
                {totals.hasHourly && (
                  <Row className="bg-portal-tint/50">
                    <Cell className="font-semibold">Total (hourly)</Cell>
                    <Cell />
                    <Cell className="whitespace-nowrap font-semibold text-violet">
                      {formatMoney(totals.hourly, offer.currency)}
                      <span className="text-grey">/h</span>
                    </Cell>
                  </Row>
                )}
              </>
            );
          })()}
        </PortalTable>
      )}

      {offer.client_note && (
        <div className="mt-4 rounded-lg border border-border-color bg-off-white px-4 py-3 text-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-grey">Your note</div>
          <p className="mt-1 whitespace-pre-line">{offer.client_note}</p>
        </div>
      )}

      {offerDocs.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-grey">Documents</div>
          <ul className="divide-y divide-border-color rounded-lg border border-border-color">
            {offerDocs.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-grey" />
                  <span className="truncate font-medium">{doc.name}</span>
                </span>
                {doc.file_url && (
                  <PortalButton variant="ghost" onClick={() => viewDoc(doc)}>
                    <Eye className="h-4 w-4" /> View
                  </PortalButton>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {changeMode && (
        <div className="mt-4 space-y-3 rounded-lg border border-border-color bg-off-white p-4">
          <Field label="What should change?" hint="Reference specific line items so we can revise precisely.">
            <textarea
              rows={3}
              className={inputClass}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="e.g. Please split Data Migration into two phases…"
            />
          </Field>
          <div className="flex gap-2">
            <PortalButton onClick={() => respond('changes_requested')} disabled={busy}>
              Send change request
            </PortalButton>
            <PortalButton variant="ghost" onClick={() => setChangeMode(false)} disabled={busy}>
              Cancel
            </PortalButton>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {open && !changeMode && (
          <>
            <PortalButton onClick={() => respond('accepted')} disabled={busy}>
              Accept offer
            </PortalButton>
            <PortalButton variant="secondary" onClick={() => setChangeMode(true)} disabled={busy}>
              Request changes
            </PortalButton>
          </>
        )}
        {offer.pdf_url && (
          <PortalButton variant="secondary" onClick={viewPdf}>
            <Eye className="h-4 w-4" /> View PDF
          </PortalButton>
        )}
        <BookCallButton variant="ghost">
          <CalendarPlus className="h-4 w-4" /> Book a call about this
        </BookCallButton>
      </div>

      {offer.status === 'accepted' && (
        <div className="mt-4">
          <InfoNote>
            Accepted on {formatDate(offer.responded_at)}. We’ll share your contract once it’s ready to sign.
          </InfoNote>
        </div>
      )}

      <FileViewer file={viewerFile} onClose={() => setViewerFile(null)} />
    </PortalCard>
  );
};
