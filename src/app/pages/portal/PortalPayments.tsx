import React from 'react';
import { toast } from 'sonner';
import { useAsync } from '@/app/hooks/use-async';
import {
  clientApproveBillingInvoice,
  listMyBillingInvoiceEntries,
  listMyBillingInvoices,
} from '@/app/lib/portal-api';
import {
  BillingInvoiceTable,
  resolveInvoiceFileView,
} from '@/app/components/portal/BillingInvoiceList';
import { FileViewer, type FileViewerFile } from '@/app/components/portal/FileViewer';
import type { BillingInvoice } from '@/app/lib/portal-types';
import { EmptyState, ErrorNote, InfoNote, PortalCard, PortalSpinner } from '@/app/components/portal/PortalUi';

// The time-and-materials billing invoices (0048): approved billable hours by reporter, valued at
// each reporter's project rate. RLS returns only this client's own account and only issued invoices
// (sent / client_approved / paid), so there is no account filter here. The client can confirm a
// 'sent' invoice (→ Approved by client); an admin then marks it Paid.
export const PortalPayments: React.FC = () => {
  const invoices = useAsync(() => listMyBillingInvoices(), []);
  const [viewerFile, setViewerFile] = React.useState<FileViewerFile | null>(null);

  const approve = async (invoice: BillingInvoice, approve: boolean) => {
    try {
      await clientApproveBillingInvoice(invoice.id, approve);
      toast.success(approve ? 'Invoice approved — thank you.' : 'Approval revoked.');
      await invoices.reload();
    } catch (cause) {
      toast.error('Could not update the invoice', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  const viewDocument = async (invoice: BillingInvoice) => {
    try {
      const file = await resolveInvoiceFileView(invoice);
      if (file) setViewerFile(file);
      else toast.error('This invoice has no file attached yet.');
    } catch (cause) {
      toast.error('Could not open the file', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  return (
    <div className="space-y-2">
      <PortalCard
        title="Billing"
        description="Each issued invoice, with the hours by team member and the work behind it. Approve an invoice to confirm it, then we'll mark it paid once payment clears."
      >
        {invoices.loading ? (
          <PortalSpinner label="Loading invoices…" />
        ) : invoices.error ? (
          <ErrorNote>{invoices.error}</ErrorNote>
        ) : !invoices.data || invoices.data.length === 0 ? (
          <EmptyState
            title="No invoices yet"
            description="An invoice appears here once your team's approved hours for a month are issued."
          />
        ) : (
          <BillingInvoiceTable
            invoices={invoices.data}
            showPeriod
            loadEntries={listMyBillingInvoiceEntries}
            onClientApprove={approve}
            onViewDocument={viewDocument}
          />
        )}
      </PortalCard>

      <InfoNote>
        Payments are processed outside the portal for now — each issued invoice includes payment instructions. Talk to
        your Klepka contact to set up autopay for a recurring retainer.
      </InfoNote>

      <FileViewer file={viewerFile} onClose={() => setViewerFile(null)} />
    </div>
  );
};
