import React from 'react';
import { OfferDetail } from '@/app/components/portal/OfferDetail';
import { EmptyState, PortalCard } from '@/app/components/portal/PortalUi';
import type { Offer, Opportunity, PortalDocument } from '@/app/lib/portal-types';

/**
 * Dashboard widget shown while an offer is awaiting the client's response (status 'sent'). It renders
 * the very same offer card as Pipeline & Offers (OfferDetail — line items, totals, accept / request
 * changes), with the owning opportunity's name above each.
 */
export const PendingOfferWidget: React.FC<{
  offers: Offer[];
  opportunities: Opportunity[];
  documents: PortalDocument[];
  onReload: () => Promise<void>;
}> = ({ offers, opportunities, documents, onReload }) => {
  const pending = offers.filter((offer) => offer.status === 'sent');

  if (pending.length === 0) {
    return (
      <PortalCard title="Offer awaiting your review">
        <EmptyState title="Nothing awaiting your response" />
      </PortalCard>
    );
  }

  const opportunityName = (id: string | null) =>
    id ? (opportunities.find((opp) => opp.id === id)?.name ?? null) : null;

  return (
    <div className="space-y-2">
      {pending.map((offer) => {
        const name = opportunityName(offer.opportunity_id);
        return (
          <div key={offer.id} className="space-y-1">
            {name && <h2 className="px-1 text-sm font-semibold text-violet">{name}</h2>}
            <OfferDetail offer={offer} documents={documents} onResponded={onReload} />
          </div>
        );
      })}
    </div>
  );
};
