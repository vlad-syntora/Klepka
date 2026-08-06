import React from 'react';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { useAsync } from '@/app/hooks/use-async';
import {
  adminDeleteInvoice,
  adminListInvoices,
  adminListProjects,
  adminUpsertInvoice,
} from '@/app/lib/portal-admin-api';
import { formatDate, formatMoney } from '@/app/lib/portal-format';
import {
  INVOICE_STATUSES,
  INVOICE_STATUS_LABELS,
  type Invoice,
  type PortalAccount,
} from '@/app/lib/portal-types';
import {
  Cell,
  EmptyState,
  ErrorNote,
  Field,
  PortalButton,
  PortalCard,
  PortalSpinner,
  PortalTable,
  Row,
  StatTile,
  inputClass,
} from '@/app/components/portal/PortalUi';

export const WorkspacePayments: React.FC<{ account: PortalAccount }> = ({ account }) => {
  const invoices = useAsync(() => adminListInvoices(account.id), [account.id]);
  const projects = useAsync(() => adminListProjects(account.id), [account.id]);
  const [projectId, setProjectId] = React.useState<string | null>(null);
  const [showForm, setShowForm] = React.useState(false);
  const [description, setDescription] = React.useState('');
  const [number, setNumber] = React.useState('');
  const [amount, setAmount] = React.useState(0);
  const [dueDate, setDueDate] = React.useState('');
  const [dueLabel, setDueLabel] = React.useState('');
  const [status, setStatus] = React.useState<Invoice['status']>('not_issued');
  const [busy, setBusy] = React.useState(false);

  const projectList = projects.data ?? [];
  const activeProjectId = projectId ?? projectList[0]?.id ?? null;

  // Payments live under a project — scope everything to the chosen one.
  const rows = (invoices.data ?? []).filter((invoice) => invoice.project_id === activeProjectId);
  const currency = rows[0]?.currency ?? 'USD';
  const contracted = rows.reduce((sum, invoice) => sum + invoice.amount, 0);
  const paid = rows.filter((invoice) => invoice.status === 'paid').reduce((sum, invoice) => sum + invoice.amount, 0);
  const outstanding = contracted - paid;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeProjectId) {
      toast.error('Pick a project first.');
      return;
    }
    setBusy(true);
    try {
      await adminUpsertInvoice({
        account_id: account.id,
        project_id: activeProjectId,
        milestone_id: null,
        number: number.trim() || null,
        description: description.trim(),
        amount: Number(amount) || 0,
        due_date: dueDate || null,
        due_label: dueLabel.trim() || null,
        status,
        position: rows.length,
      });
      toast.success('Payment line added.');
      setDescription('');
      setNumber('');
      setAmount(0);
      setDueDate('');
      setDueLabel('');
      setShowForm(false);
      await invoices.reload();
    } catch (cause) {
      toast.error('Could not save', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (invoice: Invoice, next: Invoice['status']) => {
    try {
      await adminUpsertInvoice({
        id: invoice.id,
        account_id: account.id,
        project_id: invoice.project_id,
        milestone_id: invoice.milestone_id,
        number: invoice.number,
        description: invoice.description,
        amount: invoice.amount,
        due_date: invoice.due_date,
        due_label: invoice.due_label,
        status: next,
        position: invoice.position,
      });
      await invoices.reload();
    } catch (cause) {
      toast.error('Could not update', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this payment line?')) return;
    try {
      await adminDeleteInvoice(id);
      await invoices.reload();
    } catch (cause) {
      toast.error('Could not delete', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  if (invoices.loading || projects.loading) return <PortalSpinner />;
  if (invoices.error) return <ErrorNote>{invoices.error}</ErrorNote>;

  if (projectList.length === 0) {
    return (
      <EmptyState
        title="No project yet"
        description="Payments live under a project. Win an opportunity (or add a project) first, then bill against it here."
      />
    );
  }

  return (
    <div className="space-y-2">
      <PortalCard title="Project" description="Payments are billed against a project.">
        <select
          className={`${inputClass} sm:w-96`}
          value={activeProjectId ?? ''}
          onChange={(event) => setProjectId(event.target.value)}
        >
          {projectList.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </select>
      </PortalCard>

      <div className="grid gap-2 sm:grid-cols-3">
        <StatTile label="Contracted" value={formatMoney(contracted, currency)} />
        <StatTile label="Paid" value={formatMoney(paid, currency)} tone="green" />
        <StatTile label="Outstanding" value={formatMoney(outstanding, currency)} tone={outstanding > 0 ? 'amber' : undefined} />
      </div>

      <PortalCard
        title="Payment schedule"
        description="Deposit, milestone-based or recurring retainer lines."
        action={
          <PortalButton onClick={() => setShowForm((open) => !open)}>
            <Plus className="h-4 w-4" /> Add line
          </PortalButton>
        }
      >
        {showForm && (
          <form onSubmit={submit} className="mb-4 grid gap-3 rounded-lg border border-border-color bg-off-white p-4 sm:grid-cols-6">
            <Field label="Description" className="sm:col-span-2">
              <input
                className={inputClass}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Deposit (upon signing)"
                required
              />
            </Field>
            <Field label="Invoice #">
              <input className={inputClass} value={number} onChange={(event) => setNumber(event.target.value)} />
            </Field>
            <Field label="Amount">
              <input
                type="number"
                min={0}
                step="0.01"
                className={inputClass}
                value={amount}
                onChange={(event) => setAmount(Number(event.target.value))}
              />
            </Field>
            <Field label="Due date">
              <input type="date" className={inputClass} value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </Field>
            <Field label="Status">
              <select
                className={inputClass}
                value={status}
                onChange={(event) => setStatus(event.target.value as Invoice['status'])}
              >
                {INVOICE_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {INVOICE_STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Due label" hint="Used when there's no fixed date, e.g. “Upon contract execution”." className="sm:col-span-4">
              <input className={inputClass} value={dueLabel} onChange={(event) => setDueLabel(event.target.value)} />
            </Field>
            <div className="flex items-end gap-2 sm:col-span-2">
              <PortalButton type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Add'}
              </PortalButton>
              <PortalButton variant="ghost" type="button" onClick={() => setShowForm(false)}>
                Cancel
              </PortalButton>
            </div>
          </form>
        )}

        {rows.length === 0 ? (
          <EmptyState title="No payment schedule yet" />
        ) : (
          <PortalTable head={['Invoice', 'Description', 'Amount', 'Due', 'Status', '']}>
            {rows.map((invoice) => (
              <Row key={invoice.id}>
                <Cell className="whitespace-nowrap font-medium">{invoice.number ?? '—'}</Cell>
                <Cell className="text-grey">{invoice.description}</Cell>
                <Cell className="whitespace-nowrap">{formatMoney(invoice.amount, invoice.currency)}</Cell>
                <Cell className="whitespace-nowrap text-grey">
                  {invoice.due_date ? formatDate(invoice.due_date) : invoice.due_label ?? '—'}
                </Cell>
                <Cell>
                  <select
                    className={`${inputClass} w-auto py-1 text-xs`}
                    value={invoice.status}
                    onChange={(event) => changeStatus(invoice, event.target.value as Invoice['status'])}
                  >
                    {INVOICE_STATUSES.map((value) => (
                      <option key={value} value={value}>
                        {INVOICE_STATUS_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </Cell>
                <Cell className="text-right">
                  <PortalButton variant="ghost" onClick={() => remove(invoice.id)} aria-label="Delete line">
                    <Trash2 className="h-4 w-4" />
                  </PortalButton>
                </Cell>
              </Row>
            ))}
          </PortalTable>
        )}
      </PortalCard>
    </div>
  );
};
