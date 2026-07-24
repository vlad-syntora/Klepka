import React from 'react';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { usePortalData } from '@/app/hooks/use-portal-data';
import { getDocumentUrl } from '@/app/lib/portal-api';
import { formatDate, formatMoney } from '@/app/lib/portal-format';
import { INVOICE_STATUS_LABELS } from '@/app/lib/portal-types';
import {
  Cell,
  EmptyState,
  InfoNote,
  PortalButton,
  PortalCard,
  PortalTable,
  Row,
  StatTile,
  StatusTag,
  toneFor,
} from '@/app/components/portal/PortalUi';

export const PortalPayments: React.FC = () => {
  const { snapshot } = usePortalData();
  if (!snapshot) return null;

  const { invoices, projects } = snapshot;
  const currency = invoices[0]?.currency ?? 'USD';
  const contracted = invoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const paid = invoices.filter((invoice) => invoice.status === 'paid').reduce((sum, invoice) => sum + invoice.amount, 0);
  const outstanding = invoices
    .filter((invoice) => ['due', 'overdue', 'upcoming'].includes(invoice.status))
    .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''));
  const next = outstanding[0];
  const hasOverdue = invoices.some((invoice) => invoice.status === 'overdue');

  // Payments live under a project — group the schedule so each project shows its own lines.
  const projectName = (id: string | null) => projects.find((entry) => entry.project.id === id)?.project.name;
  const groups = projects
    .map((entry) => ({
      key: entry.project.id,
      title: entry.project.name,
      rows: invoices.filter((invoice) => invoice.project_id === entry.project.id),
    }))
    .filter((group) => group.rows.length > 0);
  const looseRows = invoices.filter((invoice) => !invoice.project_id || !projectName(invoice.project_id));
  if (looseRows.length > 0) groups.push({ key: 'unassigned', title: 'Other', rows: looseRows });

  const openInvoice = async (path: string | null) => {
    if (!path) return;
    try {
      window.open(await getDocumentUrl(path), '_blank', 'noopener');
    } catch (cause) {
      toast.error('Could not open the invoice', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Total contracted" value={formatMoney(contracted, currency)} />
        <StatTile label="Paid to date" value={formatMoney(paid, currency)} tone="green" />
        <StatTile
          label="Next payment due"
          value={next ? formatMoney(next.amount, next.currency) : '—'}
          tone={hasOverdue ? 'red' : undefined}
          hint={next ? (next.due_date ? formatDate(next.due_date) : next.due_label ?? undefined) : 'Nothing outstanding'}
        />
      </div>

      {groups.length === 0 ? (
        <PortalCard title="Payment schedule" description="Tied to your signed offer and project milestones.">
          <EmptyState
            title="No payment schedule yet"
            description="Invoices activate automatically once the contract is signed."
          />
        </PortalCard>
      ) : (
        groups.map((group) => (
          <PortalCard key={group.key} title={group.title} description="Payment schedule for this project.">
            <PortalTable head={['Invoice', 'Description', 'Amount', 'Due', 'Status', '']}>
              {group.rows.map((invoice) => (
                <Row key={invoice.id}>
                  <Cell className="whitespace-nowrap font-medium">{invoice.number ?? '—'}</Cell>
                  <Cell className="text-grey">{invoice.description}</Cell>
                  <Cell className="whitespace-nowrap font-medium">{formatMoney(invoice.amount, invoice.currency)}</Cell>
                  <Cell className="whitespace-nowrap text-grey">
                    {invoice.due_date ? formatDate(invoice.due_date) : invoice.due_label ?? '—'}
                  </Cell>
                  <Cell>
                    <StatusTag tone={toneFor(invoice.status)}>{INVOICE_STATUS_LABELS[invoice.status]}</StatusTag>
                  </Cell>
                  <Cell className="text-right">
                    {invoice.invoice_url ? (
                      <PortalButton variant="ghost" onClick={() => openInvoice(invoice.invoice_url)}>
                        <Download className="h-4 w-4" /> PDF
                      </PortalButton>
                    ) : (
                      <span className="text-xs text-grey">—</span>
                    )}
                  </Cell>
                </Row>
              ))}
            </PortalTable>
          </PortalCard>
        ))
      )}

      <InfoNote>
        Payments are processed outside the portal for now — each issued invoice includes payment instructions. Talk to
        your Klepka contact to set up autopay for a recurring retainer.
      </InfoNote>
    </div>
  );
};
