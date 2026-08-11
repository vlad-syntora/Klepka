import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ReceiptText } from 'lucide-react';
import { formatMoney } from '@/app/lib/portal-format';
import type { BillingInvoice } from '@/app/lib/portal-types';
import { billingTotalsByCurrency } from '@/app/components/portal/BillingInvoiceList';
import { PortalButton } from '@/app/components/portal/PortalUi';

/**
 * A slim dashboard banner that appears only when the client has one or more invoices awaiting their
 * confirmation ('sent'). It sums their amount and links straight to the Payments page where the
 * client approves them. Renders nothing when there's nothing to approve, so it self-hides on the
 * dashboard once every invoice is confirmed.
 */
export const PendingInvoiceWidget: React.FC<{ invoices: BillingInvoice[] }> = ({ invoices }) => {
  const pending = invoices.filter((invoice) => invoice.status === 'sent');
  if (pending.length === 0) return null;

  // Break the total out per currency (a project bills one currency, but the client may have several).
  const totals = billingTotalsByCurrency(pending);
  const amount = totals.map((total) => formatMoney(total.amount, total.currency)).join(' · ');

  return (
    <section className="rounded-xl border border-violet/30 bg-portal-tint px-5 py-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet/10 text-violet">
            <ReceiptText className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground">
              {pending.length} invoice{pending.length === 1 ? '' : 's'} awaiting your approval
            </div>
            <div className="text-xs text-grey">{amount} — review and confirm to complete billing.</div>
          </div>
        </div>
        <Link to="/portal/payments" className="shrink-0">
          <PortalButton>
            Review invoices <ArrowRight className="h-4 w-4" />
          </PortalButton>
        </Link>
      </div>
    </section>
  );
};
