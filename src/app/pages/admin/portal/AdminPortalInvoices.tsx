import React from 'react';
import { toast } from 'sonner';
import { ChevronDown, Check, Search } from 'lucide-react';
import { useAsync } from '@/app/hooks/use-async';
import { usePortalUser } from '@/app/hooks/use-portal-user';
import {
  adminAttachBillingInvoiceDocument,
  adminDeleteBillingInvoice,
  adminGetFinanceSettings,
  adminListAllBillingInvoices,
  adminListBillingInvoiceEntries,
  adminListBillingInvoices,
  adminPayBillingInvoice,
  adminSetBillingInvoiceStatus,
  salaryPeriod,
  type PaymentInput,
} from '@/app/lib/portal-admin-api';
import { formatMoney, formatMonth, prettyName } from '@/app/lib/portal-format';
import { PayDialog } from '@/app/components/portal/PayDialog';
import {
  BILLING_INVOICE_STATUSES,
  BILLING_INVOICE_STATUS_LABELS,
  type BillingInvoice,
  type BillingInvoiceStatus,
} from '@/app/lib/portal-types';
import {
  BillingInvoiceTable,
  billingTotalsByCurrency,
  resolveInvoiceFileView,
} from '@/app/components/portal/BillingInvoiceList';
import { FileViewer, type FileViewerFile } from '@/app/components/portal/FileViewer';
import { cn } from '@/app/components/ui/utils';
import {
  EmptyState,
  ErrorNote,
  InfoNote,
  PortalCard,
  PortalSpinner,
  StatTile,
  inputClass,
} from '@/app/components/portal/PortalUi';

// The month picker uses the native YYYY-MM value; invoices key on the first-of-month date.
function currentMonthValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

type Scope = 'month' | 'all';
type StatusOption = { value: BillingInvoiceStatus | 'all'; label: string };

// A compact, themed status picklist (a native <select> renders an un-stylable OS popover).
const StatusFilterMenu: React.FC<{
  value: BillingInvoiceStatus | 'all';
  options: StatusOption[];
  onChange: (value: BillingInvoiceStatus | 'all') => void;
}> = ({ value, options, onChange }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const current = options.find((option) => option.value === value) ?? options[0];

  React.useEffect(() => {
    if (!open) return;
    const onDocClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-border-color bg-card px-2.5 text-xs text-foreground transition-colors hover:border-violet"
      >
        <span className="whitespace-nowrap">{current.label}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-grey transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute left-0 z-20 mt-1 min-w-full overflow-hidden rounded-lg border border-border-color bg-card py-1 text-xs shadow-lg"
        >
          {options.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center justify-between gap-3 whitespace-nowrap px-3 py-1.5 text-left transition-colors hover:bg-off-white',
                  option.value === value ? 'font-medium text-violet' : 'text-foreground',
                )}
              >
                {option.label}
                {option.value === value && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const AdminPortalInvoices: React.FC = () => {
  const { user } = usePortalUser();
  const isAdmin = user?.role === 'portal_admin';

  const [month, setMonth] = React.useState(currentMonthValue());
  const [scope, setScope] = React.useState<Scope>('month');
  const [statusFilter, setStatusFilter] = React.useState<BillingInvoiceStatus | 'all'>('all');
  const [query, setQuery] = React.useState('');
  const [viewerFile, setViewerFile] = React.useState<FileViewerFile | null>(null);

  // Base currency for the "mark paid" popup's FX conversion (migration 0056).
  const settings = useAsync(() => adminGetFinanceSettings(), []);
  const baseCurrency = settings.data?.base_currency ?? 'USD';
  // The invoice being marked paid, if the pay popup is open.
  const [payTarget, setPayTarget] = React.useState<BillingInvoice | null>(null);
  const [paying, setPaying] = React.useState(false);

  const statusOptions: StatusOption[] = [
    { value: 'all', label: 'All statuses' },
    ...BILLING_INVOICE_STATUSES.map((status) => ({ value: status, label: BILLING_INVOICE_STATUS_LABELS[status] })),
  ];

  const period = salaryPeriod(`${month}-01T00:00:00`);
  const invoices = useAsync(
    () => (scope === 'all' ? adminListAllBillingInvoices() : adminListBillingInvoices(period)),
    [scope, period],
  );

  // Client-side filters over the loaded set (project/account name + status).
  const needle = query.trim().toLowerCase();
  const rows = (invoices.data ?? []).filter((invoice) => {
    if (statusFilter !== 'all' && invoice.status !== statusFilter) return false;
    if (needle) {
      const haystack = `${invoice.project?.name ?? ''} ${invoice.account?.name ?? ''}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
  const totals = billingTotalsByCurrency(rows);

  const setStatus = async (invoice: BillingInvoice, status: BillingInvoiceStatus) => {
    // Marking paid captures the actual amount + FX in a popup, then records it as income (0056).
    if (status === 'paid') {
      setPayTarget(invoice);
      return;
    }
    try {
      await adminSetBillingInvoiceStatus(invoice.id, status);
      await invoices.reload();
    } catch (cause) {
      toast.error('Could not update status', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  const confirmPay = async (payment: PaymentInput) => {
    if (!payTarget) return;
    setPaying(true);
    try {
      await adminPayBillingInvoice(payTarget.id, payment);
      toast.success('Invoice marked paid and recorded as income.');
      setPayTarget(null);
      await invoices.reload();
    } catch (cause) {
      toast.error('Could not record the payment', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setPaying(false);
    }
  };

  const attach = async (invoice: BillingInvoice, file: File) => {
    const name = `Invoice — ${invoice.project?.name ?? 'Project'} · ${formatMonth(invoice.period)}`;
    try {
      await adminAttachBillingInvoiceDocument(invoice, file, name);
      toast.success('Invoice file attached — the client can view it.');
      await invoices.reload();
    } catch (cause) {
      toast.error('Could not attach the file', { description: cause instanceof Error ? cause.message : undefined });
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

  const remove = async (invoice: BillingInvoice) => {
    const label = `${invoice.project?.name ?? 'this project'} — ${prettyName(invoice.account?.name ?? '')}`.trim();
    if (!window.confirm(`Delete the invoice for ${label}? It will be recreated from logs unless it was sent.`)) return;
    try {
      await adminDeleteBillingInvoice(invoice.id);
      toast.success('Invoice deleted.');
      await invoices.reload();
    } catch (cause) {
      toast.error('Could not delete the invoice', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  if (!isAdmin) {
    return <ErrorNote>Invoices are restricted to portal administrators.</ErrorNote>;
  }

  return (
    <div className="space-y-3">
      <PortalCard
        title="Invoices"
        description="Monthly client billing per project, from approved billable hours by reporter — valued at each reporter's project billing rate."
        action={
          <input
            type="month"
            className={`${inputClass} w-auto py-1.5 text-xs`}
            value={month}
            onChange={(event) => setMonth(event.target.value || currentMonthValue())}
          />
        }
      >
        {/* Filters on a single compact row: scope, status, project/account search. */}
        <div className="mb-3 flex flex-wrap items-stretch gap-1.5">
          <div className="flex h-8 shrink-0 overflow-hidden rounded-lg border border-border-color text-xs font-medium">
            {(['month', 'all'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setScope(value)}
                className={cn(
                  'px-2.5 transition-colors',
                  scope === value ? 'bg-violet text-white' : 'text-grey hover:text-violet',
                )}
              >
                {value === 'month' ? 'This month' : 'All months'}
              </button>
            ))}
          </div>
          <StatusFilterMenu value={statusFilter} options={statusOptions} onChange={setStatusFilter} />
          <div className="relative h-8 shrink-0">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-grey" />
            <input
              type="search"
              placeholder="Search project…"
              className={`${inputClass} h-8 w-40 py-0 pl-7 pr-2.5 text-xs`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>

        {totals.length > 0 && (
          <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label={scope === 'all' ? 'Invoices' : 'Projects'} value={rows.length} />
            {totals.map((entry) => (
              <StatTile
                key={entry.currency}
                label={`Billed (${entry.currency})`}
                value={formatMoney(entry.amount, entry.currency)}
                hint={`${entry.hours} h`}
                tone="violet"
              />
            ))}
          </div>
        )}

        {invoices.loading ? (
          <PortalSpinner label="Loading invoices…" />
        ) : invoices.error ? (
          <ErrorNote>{invoices.error}</ErrorNote>
        ) : rows.length === 0 ? (
          <EmptyState
            title={invoices.data && invoices.data.length > 0 ? 'No invoices match these filters' : 'No invoices for this month yet'}
            description={
              invoices.data && invoices.data.length > 0
                ? 'Adjust the status filter or search to see more.'
                : 'An invoice appears automatically once a project has approved billable hours in the month.'
            }
          />
        ) : (
          <BillingInvoiceTable
            invoices={rows}
            showPeriod={scope === 'all'}
            showAccount
            loadEntries={adminListBillingInvoiceEntries}
            onStatus={setStatus}
            onDelete={remove}
            onAttach={attach}
            onViewDocument={viewDocument}
          />
        )}

        <div className="mt-4">
          <InfoNote>
            An invoice counts only <strong>approved, billable</strong> logs, credited to the client-facing
            <strong> reporter</strong> (not the internal employee), valued by <strong>billing hours</strong> at that
            reporter&rsquo;s project rate. <strong>Expand a row</strong> for the per-reporter summary and every log
            behind it. It recomputes as logs change until you mark it <strong>Sent</strong> — that freezes it and makes
            it visible to the client.
          </InfoNote>
        </div>
      </PortalCard>

      <FileViewer file={viewerFile} onClose={() => setViewerFile(null)} />

      <PayDialog
        open={payTarget !== null}
        onClose={() => setPayTarget(null)}
        title="Mark invoice paid"
        kind="income"
        baseCurrency={baseCurrency}
        computedAmount={payTarget?.total_amount ?? 0}
        defaultCurrency={payTarget?.currency ?? baseCurrency}
        busy={paying}
        onSubmit={confirmPay}
      />
    </div>
  );
};
