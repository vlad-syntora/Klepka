import React from 'react';
import { toast } from 'sonner';
import { CalendarPlus, Eye, FileText } from 'lucide-react';
import { usePortalData } from '@/app/hooks/use-portal-data';
import { BookCallButton } from '@/app/components/portal/BookCallButton';
import { FileViewer, type FileViewerFile } from '@/app/components/portal/FileViewer';
import { resolveFileView } from '@/app/lib/file-view';
import { getDocumentUrl, respondToOffer } from '@/app/lib/portal-api';
import { formatDate, formatMoney, formatOfferTotal, offerTotals } from '@/app/lib/portal-format';
import {
  OFFER_BILLING_LABELS,
  OFFER_STATUS_LABELS,
  OPPORTUNITY_STAGES,
  STAGE_LABELS,
  type Offer,
  type PortalDocument,
} from '@/app/lib/portal-types';
import {
  Cell,
  EmptyState,
  Field,
  InfoNote,
  PortalButton,
  PortalCard,
  PortalTable,
  Row,
  StageTracker,
  StatusTag,
  inputClass,
  toneFor,
} from '@/app/components/portal/PortalUi';
import { cn } from '@/app/components/ui/utils';

const STAGES = OPPORTUNITY_STAGES.map((key) => ({ key, label: STAGE_LABELS[key] }));

const OfferDetail: React.FC<{ offer: Offer; documents: PortalDocument[]; onResponded: () => Promise<void> }> = ({
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

const OpportunityBlock: React.FC<{
  opportunity: { id: string; name: string; stage: string } | null;
  offers: Offer[];
  documents: PortalDocument[];
  onReload: () => Promise<void>;
}> = ({ opportunity, offers, documents, onReload }) => {
  const currentStage = opportunity?.stage ?? 'discovery';
  const currentOffer =
    offers.find((offer) => ['sent', 'changes_requested', 'accepted'].includes(offer.status)) ?? offers[0];
  const history = offers.filter((offer) => offer.id !== currentOffer?.id);

  return (
    <div className="space-y-5">
      <PortalCard title="Sales stage" description={opportunity?.name}>
        {currentStage === 'closed_lost' ? (
          <EmptyState title="This opportunity is closed." />
        ) : (
          <div className="px-2 pt-2 pb-1">
            <StageTracker stages={STAGES} current={currentStage} />
          </div>
        )}
      </PortalCard>

      {currentOffer ? (
        <OfferDetail offer={currentOffer} documents={documents} onResponded={onReload} />
      ) : (
        <PortalCard title="Offers">
          <EmptyState
            title="No offer yet"
            description="Your Klepka team will publish a proposal here as soon as scoping is done."
          />
        </PortalCard>
      )}

      {history.length > 0 && (
        <PortalCard title="Offer history">
          <PortalTable head={['Version', 'Date', 'Change', 'Total', 'Status']}>
            {history.map((offer) => (
              <Row key={offer.id}>
                <Cell className="font-medium">v{offer.version}</Cell>
                <Cell className="whitespace-nowrap text-grey">{formatDate(offer.sent_at ?? offer.created_at)}</Cell>
                <Cell className="text-grey">{offer.change_note ?? '—'}</Cell>
                <Cell className="whitespace-nowrap">{formatOfferTotal(offer.items, offer.currency)}</Cell>
                <Cell>
                  <StatusTag tone={toneFor(offer.status)}>{OFFER_STATUS_LABELS[offer.status]}</StatusTag>
                </Cell>
              </Row>
            ))}
          </PortalTable>
        </PortalCard>
      )}
    </div>
  );
};

export const PortalPipeline: React.FC = () => {
  const { snapshot, reload } = usePortalData();
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  if (!snapshot) return null;

  const { opportunities, offers, documents } = snapshot;
  // With several opportunities the client picks one from a list; with one (or a legacy account that
  // has offers but no opportunity) its detail shows directly.
  const selected = opportunities.find((opp) => opp.id === selectedId) ?? opportunities[0] ?? null;
  const oppOffers = selected ? offers.filter((offer) => offer.opportunity_id === selected.id) : offers;

  return (
    <div className="space-y-5">
      {opportunities.length > 1 && (
        <PortalCard title="Your opportunities" description="Pick a deal to see its stage, offers and documents.">
          <div className="flex flex-wrap gap-2">
            {opportunities.map((opp) => (
              <button
                key={opp.id}
                onClick={() => setSelectedId(opp.id)}
                className={cn(
                  'rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                  opp.id === selected?.id
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

      <OpportunityBlock opportunity={selected} offers={oppOffers} documents={documents} onReload={reload} />
    </div>
  );
};
