import React from 'react';
import { Check, ChevronDown, ChevronRight, Eye, Paperclip, RotateCcw, Trash2 } from 'lucide-react';
import { formatDate, formatMoney, formatMonth, prettyName } from '@/app/lib/portal-format';
import { getDocumentUrl } from '@/app/lib/portal-api';
import { resolveFileView } from '@/app/lib/file-view';
import {
  BILLING_INVOICE_STATUS_LABELS,
  type BillingInvoice,
  type BillingInvoiceStatus,
  type TimeEntry,
} from '@/app/lib/portal-types';
import type { FileViewerFile } from './FileViewer';
import {
  Cell,
  ErrorNote,
  PortalButton,
  PortalSpinner,
  PortalTable,
  Row,
  SortHeader,
  StatusTag,
  useTableSort,
  type Tone,
} from './PortalUi';

/**
 * Resolve an invoice's attached file into the shape the in-portal FileViewer needs, or null when
 * there's no viewable file. Drive links pass straight through getDocumentUrl; a stored path is signed.
 */
export async function resolveInvoiceFileView(invoice: BillingInvoice): Promise<FileViewerFile | null> {
  const doc = invoice.document;
  const link = doc?.file_url || doc?.drive_web_link;
  if (!doc || !link) return null;
  const resolved = await getDocumentUrl(link);
  return { title: doc.name, ...resolveFileView(resolved, doc.drive_file_id) };
}

// open = accruing (neutral); approved = internal sign-off (amber); sent = issued, awaiting the client
// (violet); client_approved = client confirmed (green); paid = settled (green).
export const BILLING_STATUS_TONE: Record<BillingInvoiceStatus, Tone> = {
  open: 'grey',
  approved: 'amber',
  sent: 'violet',
  client_approved: 'green',
  paid: 'green',
};

// Does an invoice have a viewable attached file? (Drive link or a stored file path.)
function invoiceHasFile(invoice: BillingInvoice): boolean {
  return Boolean(invoice.document && (invoice.document.file_url || invoice.document.drive_web_link));
}

// A billing invoice can only carry one currency (per project), so its totals sum straight across.
export function billingTotalsByCurrency(
  invoices: BillingInvoice[],
): { currency: string; hours: number; amount: number }[] {
  const map = new Map<string, { currency: string; hours: number; amount: number }>();
  for (const invoice of invoices) {
    const entry = map.get(invoice.currency) ?? { currency: invoice.currency, hours: 0, amount: 0 };
    entry.hours += invoice.total_hours;
    entry.amount += invoice.total_amount;
    map.set(invoice.currency, entry);
  }
  return [...map.values()];
}

type LoadEntries = (projectId: string, period: string) => Promise<TimeEntry[]>;

// One invoice row that expands to reveal (1) the per-reporter summary that makes up the amount, and
// (2) the individual worklogs behind it. Logs load lazily on first expand so the month view stays
// cheap. Status/delete actions appear only when their handlers are given (admin); the client omits them.
const BillingInvoiceRow: React.FC<{
  invoice: BillingInvoice;
  showPeriod?: boolean;
  showAccount?: boolean;
  loadEntries: LoadEntries;
  onStatus?: (invoice: BillingInvoice, status: BillingInvoiceStatus) => void;
  onDelete?: (invoice: BillingInvoice) => void;
  /** Admin: attach (or replace) the issued invoice file. */
  onAttach?: (invoice: BillingInvoice, file: File) => void;
  /** Client: confirm (approve=true) or revoke (approve=false) a sent invoice. */
  onClientApprove?: (invoice: BillingInvoice, approve: boolean) => void;
  /** Open the attached invoice file. */
  onViewDocument?: (invoice: BillingInvoice) => void;
}> = ({ invoice, showPeriod, showAccount, loadEntries, onStatus, onDelete, onAttach, onClientApprove, onViewDocument }) => {
  const [expanded, setExpanded] = React.useState(false);
  const [entries, setEntries] = React.useState<TimeEntry[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileInput = React.useRef<HTMLInputElement>(null);

  const showActions = Boolean(onStatus || onDelete || onAttach || onClientApprove || onViewDocument);
  // Columns: Project, [Period], Hours, Amount, Status, [actions]. The expanded detail row spans them.
  const colSpan = 4 + (showPeriod ? 1 : 0) + (showActions ? 1 : 0);
  const hasFile = invoiceHasFile(invoice);

  const onFilePicked = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow re-picking the same file
    if (file && onAttach) onAttach(invoice, file);
  };

  const toggle = async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && entries === null && !loading) {
      setLoading(true);
      setError(null);
      try {
        setEntries(await loadEntries(invoice.project_id, invoice.period));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not load logs.');
      } finally {
        setLoading(false);
      }
    }
  };

  const lines = invoice.lines ?? [];

  return (
    <>
      <Row>
        <Cell className="font-medium">
          <button type="button" onClick={toggle} className="flex items-center gap-2 text-left" aria-expanded={expanded}>
            {expanded ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-grey" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-grey" />
            )}
            <span>
              {invoice.project?.name ?? '—'}
              {showAccount && invoice.account?.name && (
                <span className="block text-xs text-grey">{invoice.account.name}</span>
              )}
            </span>
          </button>
        </Cell>
        {showPeriod && <Cell className="whitespace-nowrap text-grey">{formatMonth(invoice.period)}</Cell>}
        <Cell className="whitespace-nowrap text-grey">{invoice.total_hours} h</Cell>
        <Cell className="whitespace-nowrap font-semibold">{formatMoney(invoice.total_amount, invoice.currency)}</Cell>
        <Cell>
          <StatusTag tone={BILLING_STATUS_TONE[invoice.status]}>
            {BILLING_INVOICE_STATUS_LABELS[invoice.status]}
          </StatusTag>
        </Cell>
        {showActions && (
          <Cell className="text-right">
            <div className="flex flex-wrap justify-end gap-1">
              {/* View the attached invoice file (admin or client). */}
              {onViewDocument && hasFile && (
                <PortalButton variant="ghost" onClick={() => onViewDocument(invoice)}>
                  <Eye className="h-4 w-4" /> Invoice
                </PortalButton>
              )}

              {/* Admin: attach or replace the issued invoice file. */}
              {onAttach && (
                <>
                  <input
                    ref={fileInput}
                    type="file"
                    className="hidden"
                    onChange={onFilePicked}
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,image/*,application/pdf"
                  />
                  <PortalButton variant="ghost" onClick={() => fileInput.current?.click()}>
                    <Paperclip className="h-4 w-4" /> {hasFile ? 'Replace' : 'Attach'}
                  </PortalButton>
                </>
              )}

              {/* Admin lifecycle: open → approved → sent → paid, with a way back while not paid. The
                  client contributes the sent → client_approved step in between. */}
              {onStatus && invoice.status === 'open' && (
                <PortalButton variant="secondary" onClick={() => onStatus(invoice, 'approved')}>
                  <Check className="h-4 w-4" /> Approve
                </PortalButton>
              )}
              {onStatus && invoice.status === 'approved' && (
                <>
                  <PortalButton onClick={() => onStatus(invoice, 'sent')}>Mark sent</PortalButton>
                  <PortalButton variant="ghost" onClick={() => onStatus(invoice, 'open')} aria-label="Reopen">
                    <RotateCcw className="h-4 w-4" />
                  </PortalButton>
                </>
              )}
              {onStatus && (invoice.status === 'sent' || invoice.status === 'client_approved') && (
                <>
                  <PortalButton onClick={() => onStatus(invoice, 'paid')}>Mark paid</PortalButton>
                  <PortalButton
                    variant="ghost"
                    onClick={() => onStatus(invoice, invoice.status === 'client_approved' ? 'sent' : 'approved')}
                    aria-label="Reopen"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </PortalButton>
                </>
              )}
              {onStatus && invoice.status === 'paid' && (
                <PortalButton variant="ghost" onClick={() => onStatus(invoice, 'sent')}>
                  Reopen
                </PortalButton>
              )}

              {/* Client: confirm a sent invoice, or revoke while it isn't paid yet. */}
              {onClientApprove && invoice.status === 'sent' && (
                <PortalButton onClick={() => onClientApprove(invoice, true)}>
                  <Check className="h-4 w-4" /> Approve invoice
                </PortalButton>
              )}
              {onClientApprove && invoice.status === 'client_approved' && (
                <PortalButton variant="ghost" onClick={() => onClientApprove(invoice, false)}>
                  Revoke approval
                </PortalButton>
              )}

              {onDelete && (
                <PortalButton variant="ghost" onClick={() => onDelete(invoice)} aria-label="Delete invoice">
                  <Trash2 className="h-4 w-4" />
                </PortalButton>
              )}
            </div>
          </Cell>
        )}
      </Row>
      {expanded && (
        <Row className="hover:bg-transparent">
          <Cell colSpan={colSpan} className="bg-portal-tint/40 py-3">
            <div className="space-y-4">
              {/* Summary: reporter hours + amount — the figures a client invoice file is built from. */}
              <div className="overflow-x-auto">
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-grey">
                  Summary by reporter
                </div>
                {lines.length === 0 ? (
                  <p className="text-xs text-grey">No billable hours in this invoice yet.</p>
                ) : (
                  <table className="w-full min-w-[420px] text-xs">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wide text-grey">
                        <th className="py-1.5 pr-3 font-semibold">Reporter</th>
                        <th className="py-1.5 pr-3 text-right font-semibold">Hours</th>
                        <th className="py-1.5 pr-3 text-right font-semibold">Rate</th>
                        <th className="py-1.5 text-right font-semibold">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line) => (
                        <tr key={line.id} className="border-t border-border-color/60">
                          <td className="py-1.5 pr-3">
                            {line.reporter ? prettyName(line.reporter.full_name) : '—'}
                          </td>
                          <td className="whitespace-nowrap py-1.5 pr-3 text-right">{line.hours} h</td>
                          <td className="whitespace-nowrap py-1.5 pr-3 text-right text-grey">
                            {line.rate != null ? formatMoney(line.rate, invoice.currency) : '—'}
                          </td>
                          <td className="whitespace-nowrap py-1.5 text-right font-medium">
                            {formatMoney(line.amount, invoice.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-border-color">
                        <td className="py-1.5 pr-3 font-semibold">Total</td>
                        <td className="whitespace-nowrap py-1.5 pr-3 text-right font-semibold">
                          {invoice.total_hours} h
                        </td>
                        <td />
                        <td className="whitespace-nowrap py-1.5 text-right font-semibold">
                          {formatMoney(invoice.total_amount, invoice.currency)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>

              {/* Detail: every log the invoice counts (client-facing — reporter only, never the employee). */}
              <div>
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-grey">Logs</div>
                {loading ? (
                  <PortalSpinner label="Loading logs…" />
                ) : error ? (
                  <ErrorNote>{error}</ErrorNote>
                ) : !entries || entries.length === 0 ? (
                  <p className="text-xs text-grey">No approved billable logs in this month.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] text-xs">
                      <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wide text-grey">
                          <th className="py-1.5 pr-3 font-semibold">Date</th>
                          <th className="py-1.5 pr-3 font-semibold">Reporter</th>
                          <th className="py-1.5 pr-3 font-semibold">Work</th>
                          <th className="py-1.5 text-right font-semibold">Hours</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((entry) => (
                          <tr key={entry.id} className="border-t border-border-color/60">
                            <td className="whitespace-nowrap py-1.5 pr-3 text-grey">{formatDate(entry.entry_date)}</td>
                            <td className="py-1.5 pr-3">
                              {entry.reporter ? prettyName(entry.reporter.full_name) : '—'}
                            </td>
                            <td className="py-1.5 pr-3">{entry.description}</td>
                            <td className="whitespace-nowrap py-1.5 text-right font-medium">{entry.hours ?? 0} h</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </Cell>
        </Row>
      )}
    </>
  );
};

/**
 * The billing-invoice table shared by the admin Invoices page and the client Payments page. Each row
 * expands to a per-reporter summary plus the worklogs behind it. Pass `showPeriod` for a month column
 * (multi-month views), `showAccount` to label each project's account (admin cross-account view),
 * `onStatus` to enable the admin open → approved → sent actions, and `onDelete` for the admin trash.
 */
export const BillingInvoiceTable: React.FC<{
  invoices: BillingInvoice[];
  showPeriod?: boolean;
  showAccount?: boolean;
  loadEntries: LoadEntries;
  onStatus?: (invoice: BillingInvoice, status: BillingInvoiceStatus) => void;
  onDelete?: (invoice: BillingInvoice) => void;
  onAttach?: (invoice: BillingInvoice, file: File) => void;
  onClientApprove?: (invoice: BillingInvoice, approve: boolean) => void;
  onViewDocument?: (invoice: BillingInvoice) => void;
}> = ({ invoices, showPeriod, showAccount, loadEntries, onStatus, onDelete, onAttach, onClientApprove, onViewDocument }) => {
  const showActions = Boolean(onStatus || onDelete || onAttach || onClientApprove || onViewDocument);
  const { sorted, sort, toggle } = useTableSort(invoices, {
    project: (invoice) => invoice.project?.name ?? '',
    period: (invoice) => invoice.period,
    hours: (invoice) => invoice.total_hours,
    amount: (invoice) => invoice.total_amount,
    status: (invoice) => invoice.status,
  });
  const head = [
    <SortHeader key="project" label="Project" sortKey="project" sort={sort} onSort={toggle} />,
    ...(showPeriod
      ? [<SortHeader key="period" label="Period" sortKey="period" sort={sort} onSort={toggle} />]
      : []),
    <SortHeader key="hours" label="Hours" sortKey="hours" sort={sort} onSort={toggle} />,
    <SortHeader key="amount" label="Amount" sortKey="amount" sort={sort} onSort={toggle} />,
    <SortHeader key="status" label="Status" sortKey="status" sort={sort} onSort={toggle} />,
    ...(showActions ? [''] : []),
  ];
  return (
    <PortalTable head={head}>
      {sorted.map((invoice) => (
        <BillingInvoiceRow
          key={invoice.id}
          invoice={invoice}
          showPeriod={showPeriod}
          showAccount={showAccount}
          loadEntries={loadEntries}
          onStatus={onStatus}
          onDelete={onDelete}
          onAttach={onAttach}
          onClientApprove={onClientApprove}
          onViewDocument={onViewDocument}
        />
      ))}
    </PortalTable>
  );
};
