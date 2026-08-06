import React from 'react';
import { usePortalData } from '@/app/hooks/use-portal-data';
import { EntityProductsCard } from '@/app/components/portal/EntityProductsCard';
import { HoursBudget } from '@/app/components/portal/HoursBudget';
import { OfferDetail } from '@/app/components/portal/OfferDetail';
import { formatDate, formatOfferTotal } from '@/app/lib/portal-format';
import {
  OFFER_STATUS_LABELS,
  OPPORTUNITY_STAGES,
  STAGE_LABELS,
  type Offer,
  type PortalDocument,
} from '@/app/lib/portal-types';
import {
  Cell,
  EmptyState,
  PortalCard,
  PortalTable,
  Row,
  StageTracker,
  StatusTag,
  inputClass,
  toneFor,
} from '@/app/components/portal/PortalUi';

const STAGES = OPPORTUNITY_STAGES.map((key) => ({ key, label: STAGE_LABELS[key] }));

const OpportunityBlock: React.FC<{
  opportunity: { id: string; name: string; stage: string; bank_hours?: number | null; notify_hours?: number | null } | null;
  offers: Offer[];
  documents: PortalDocument[];
  onReload: () => Promise<void>;
  /** The opportunity switcher, rendered inside the Sales stage card header. */
  headerSelect?: React.ReactNode;
}> = ({ opportunity, offers, documents, onReload, headerSelect }) => {
  const currentStage = opportunity?.stage ?? 'discovery';
  const currentOffer =
    offers.find((offer) => ['sent', 'changes_requested', 'accepted'].includes(offer.status)) ?? offers[0];
  const history = offers.filter((offer) => offer.id !== currentOffer?.id);

  return (
    <div className="space-y-2">
      {/* Row 1: Sales stage (2/3) beside Products (1/3). */}
      <div className="grid items-start gap-2 lg:grid-cols-3">
        <PortalCard className="lg:col-span-2" title="Sales stage" description={opportunity?.name} action={headerSelect}>
          {currentStage === 'closed_lost' ? (
            <EmptyState title="This opportunity is closed." />
          ) : (
            <div className="px-2 pt-2 pb-1">
              <StageTracker stages={STAGES} current={currentStage} />
            </div>
          )}
        </PortalCard>

        {opportunity ? (
          <EntityProductsCard
            entity="opportunity"
            id={opportunity.id}
            title="Products"
            description="Products in scope for this opportunity."
          />
        ) : (
          <PortalCard title="Products">
            <EmptyState title="No products yet" />
          </PortalCard>
        )}
      </div>

      {/* Row 2: the current offer version (2/3) beside the offer history (1/3). */}
      <div className="grid items-start gap-2 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {currentOffer ? (
            <OfferDetail offer={currentOffer} documents={documents} onResponded={onReload} />
          ) : opportunity && (opportunity.bank_hours != null || opportunity.notify_hours != null) ? (
            <PortalCard title="Hours budget" description="The hours allocated to this engagement.">
              <HoursBudget bank={opportunity.bank_hours} notify={opportunity.notify_hours} />
            </PortalCard>
          ) : (
            <PortalCard title="Current offer">
              <EmptyState
                title="No offer yet"
                description="Your Klepka team will publish a proposal here as soon as scoping is done."
              />
            </PortalCard>
          )}
        </div>

        <PortalCard title="Offer history">
          {history.length === 0 ? (
            <EmptyState title="No earlier versions" />
          ) : (
            <PortalTable head={['Version', 'Date', 'Total', 'Status']}>
              {history.map((offer) => (
                <Row key={offer.id}>
                  <Cell className="font-medium">v{offer.version}</Cell>
                  <Cell className="whitespace-nowrap text-grey">{formatDate(offer.sent_at ?? offer.created_at)}</Cell>
                  <Cell className="whitespace-nowrap">{formatOfferTotal(offer.items, offer.currency)}</Cell>
                  <Cell>
                    <StatusTag tone={toneFor(offer.status)}>{OFFER_STATUS_LABELS[offer.status]}</StatusTag>
                  </Cell>
                </Row>
              ))}
            </PortalTable>
          )}
        </PortalCard>
      </div>
    </div>
  );
};

// Remember which opportunity the client was last viewing on this page, across reloads.
const PIPELINE_OPP_KEY = 'portal:pipeline-opp';

export const PortalPipeline: React.FC = () => {
  const { snapshot, reload } = usePortalData();
  const [selectedId, setSelectedId] = React.useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(PIPELINE_OPP_KEY);
  });

  const chooseOpp = (id: string) => {
    setSelectedId(id);
    try {
      window.localStorage.setItem(PIPELINE_OPP_KEY, id);
    } catch {
      /* storage unavailable (private mode / quota) — keep the choice in memory only */
    }
  };

  if (!snapshot) return null;

  const { opportunities, offers, documents } = snapshot;
  // With several opportunities the client picks one from a list; with one (or a legacy account that
  // has offers but no opportunity) its detail shows directly. Falls back to the first when the
  // remembered opportunity is gone.
  const selected = opportunities.find((opp) => opp.id === selectedId) ?? opportunities[0] ?? null;
  const oppOffers = selected ? offers.filter((offer) => offer.opportunity_id === selected.id) : offers;

  // The opportunity switcher, rendered inside the Sales stage card header.
  const headerSelect =
    opportunities.length > 1 ? (
      <select
        className={`${inputClass} w-auto max-w-full py-1 text-xs`}
        value={selected?.id ?? ''}
        onChange={(event) => chooseOpp(event.target.value)}
        aria-label="Choose opportunity"
      >
        {opportunities.map((opp) => (
          <option key={opp.id} value={opp.id}>
            {opp.name} · {STAGE_LABELS[opp.stage]}
          </option>
        ))}
      </select>
    ) : undefined;

  return (
    <div className="space-y-2">
      <OpportunityBlock
        opportunity={selected}
        offers={oppOffers}
        documents={documents}
        onReload={reload}
        headerSelect={headerSelect}
      />
    </div>
  );
};
