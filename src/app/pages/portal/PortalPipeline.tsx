import React from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { CalendarPlus, Download } from 'lucide-react';
import { usePortalData } from '@/app/hooks/use-portal-data';
import { getDocumentUrl, respondToOffer } from '@/app/lib/portal-api';
import { formatDate, formatMoney } from '@/app/lib/portal-format';
import {
  OFFER_STATUS_LABELS,
  OPPORTUNITY_STAGES,
  STAGE_LABELS,
  type Offer,
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

const STAGES = OPPORTUNITY_STAGES.map((key) => ({ key, label: STAGE_LABELS[key] }));

const OfferDetail: React.FC<{ offer: Offer; onResponded: () => Promise<void> }> = ({ offer, onResponded }) => {
  const [changeMode, setChangeMode] = React.useState(false);
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const open = offer.status === 'sent' || offer.status === 'changes_requested';

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

  const openPdf = async () => {
    if (!offer.pdf_url) return;
    try {
      window.open(await getDocumentUrl(offer.pdf_url), '_blank', 'noopener');
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
        `Total ${formatMoney(offer.total, offer.currency)}`,
      ]
        .filter(Boolean)
        .join(' · ')}
    >
      {offer.summary && <p className="mb-4 text-sm text-grey">{offer.summary}</p>}

      {offer.items.length > 0 && (
        <PortalTable head={['Line item', 'Detail', 'Amount']}>
          {[...offer.items]
            .sort((a, b) => a.position - b.position)
            .map((item) => (
              <Row key={item.id}>
                <Cell className="font-medium">{item.name}</Cell>
                <Cell className="text-grey">{item.detail}</Cell>
                <Cell className="whitespace-nowrap font-medium">{formatMoney(item.amount, offer.currency)}</Cell>
              </Row>
            ))}
          <Row className="bg-portal-tint/50">
            <Cell className="font-semibold">Total</Cell>
            <Cell />
            <Cell className="whitespace-nowrap font-semibold text-violet">
              {formatMoney(offer.total, offer.currency)}
            </Cell>
          </Row>
        </PortalTable>
      )}

      {offer.client_note && (
        <div className="mt-4 rounded-lg border border-border-color bg-off-white px-4 py-3 text-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-grey">Your note</div>
          <p className="mt-1 whitespace-pre-line">{offer.client_note}</p>
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
          <PortalButton variant="secondary" onClick={openPdf}>
            <Download className="h-4 w-4" /> Download PDF
          </PortalButton>
        )}
        <Link to="/portal/calls">
          <PortalButton variant="ghost">
            <CalendarPlus className="h-4 w-4" /> Book a call about this
          </PortalButton>
        </Link>
      </div>

      {offer.status === 'accepted' && (
        <div className="mt-4">
          <InfoNote>
            Accepted on {formatDate(offer.responded_at)}. Your contract appears under Contracts &amp; Documents once
            it’s ready to sign.
          </InfoNote>
        </div>
      )}
    </PortalCard>
  );
};

const OpportunityBlock: React.FC<{
  opportunity: { id: string; name: string; stage: string } | null;
  offers: Offer[];
  onReload: () => Promise<void>;
}> = ({ opportunity, offers, onReload }) => {
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
        <OfferDetail offer={currentOffer} onResponded={onReload} />
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
                <Cell className="whitespace-nowrap">{formatMoney(offer.total, offer.currency)}</Cell>
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
  if (!snapshot) return null;

  const { opportunities, offers } = snapshot;
  // Fall back to a single unnamed block so legacy accounts with offers but no opportunity still render.
  const blocks = opportunities.length > 0 ? opportunities : [null];

  return (
    <div className="space-y-8">
      {blocks.map((opp) => {
        const oppOffers = opp ? offers.filter((offer) => offer.opportunity_id === opp.id) : offers;
        return (
          <section key={opp?.id ?? 'none'} className="space-y-5">
            {opportunities.length > 1 && opp && (
              <div className="flex items-center gap-2 border-b border-border-color pb-2">
                <h2 className="text-sm font-semibold">{opp.name}</h2>
                <StatusTag tone={toneFor(opp.stage)}>{STAGE_LABELS[opp.stage]}</StatusTag>
              </div>
            )}
            <OpportunityBlock opportunity={opp} offers={oppOffers} onReload={reload} />
          </section>
        );
      })}
    </div>
  );
};
