import React from 'react';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, Download, Paperclip, Plus, Send, Trash2, Upload, UserPlus } from 'lucide-react';
import { useAsync } from '@/app/hooks/use-async';
import {
  adminCreateOfferVersion,
  adminDeleteDocument,
  adminDeleteOpportunity,
  adminListCandidates,
  adminListDocuments,
  adminListOffers,
  adminListOpportunities,
  adminSendOffer,
  adminUploadDocument,
  adminUpsertOpportunity,
  driveProvisionOpportunity,
  DriveNotConfiguredError,
  type OfferItemInput,
} from '@/app/lib/portal-admin-api';
import { WorkspaceCandidates } from '@/app/components/admin/portal/WorkspaceCandidates';
import { WorkspaceIntake } from '@/app/components/admin/portal/WorkspaceIntake';
import { getDocumentUrl } from '@/app/lib/portal-api';
import { formatDate, formatMoney, formatOfferTotal, offerTotals, prettyName } from '@/app/lib/portal-format';
import {
  DOC_TYPES,
  DOC_TYPE_LABELS,
  OFFER_BILLING_LABELS,
  OFFER_STATUS_LABELS,
  OPPORTUNITY_STAGES,
  STAGE_LABELS,
  type DocType,
  type OfferBillingType,
  type Opportunity,
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
  StageTracker,
  StatusTag,
  inputClass,
  toneFor,
} from '@/app/components/portal/PortalUi';
import { cn } from '@/app/components/ui/utils';

const STAGES = OPPORTUNITY_STAGES.map((key) => ({ key, label: STAGE_LABELS[key] }));
const EMPTY_ITEM: OfferItemInput = {
  name: '',
  detail: '',
  amount: 0,
  billing_type: 'time_materials',
  overtime_rate: null,
  monthly_hours: null,
};

export const WorkspacePipeline: React.FC<{ account: PortalAccount; onChange: () => Promise<void> }> = ({
  account,
  onChange,
}) => {
  const opportunities = useAsync(() => adminListOpportunities(account.id), [account.id]);
  const offers = useAsync(() => adminListOffers(account.id), [account.id]);
  const documents = useAsync(() => adminListDocuments(account.id), [account.id]);

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [expandedOfferId, setExpandedOfferId] = React.useState<string | null>(null);

  // Offer builder state
  const [showBuilder, setShowBuilder] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [summary, setSummary] = React.useState('');
  const [expiresOn, setExpiresOn] = React.useState('');
  const [changeNote, setChangeNote] = React.useState('');
  const [items, setItems] = React.useState<OfferItemInput[]>([{ ...EMPTY_ITEM }]);
  const [busy, setBusy] = React.useState(false);

  // Document uploader state (scoped to the selected opportunity)
  const [docName, setDocName] = React.useState('');
  const [docType, setDocType] = React.useState<DocType>('proposal');
  const [docFile, setDocFile] = React.useState<File | null>(null);
  const [docBusy, setDocBusy] = React.useState(false);

  // Per-offer document attach (hidden file input, reused across rows)
  const offerFileInputRef = React.useRef<HTMLInputElement>(null);
  const attachTargetOfferId = React.useRef<string | null>(null);
  const [attachingOfferId, setAttachingOfferId] = React.useState<string | null>(null);

  const opps = opportunities.data ?? [];
  const selected: Opportunity | null = opps.find((entry) => entry.id === selectedId) ?? opps[0] ?? null;
  // Candidates are staffed per opportunity, so their list follows the selected one.
  const candidates = useAsync(
    () => (selected ? adminListCandidates(selected.id) : Promise.resolve([])),
    [selected?.id],
  );
  // An offer has two totals in different units: fixed-price lines sum to a monthly figure, T&M
  // lines sum to a combined hourly rate. They are kept apart (never added together).
  const builderTotals = offerTotals(items);

  const oppOffers = (offers.data ?? []).filter((offer) => offer.opportunity_id === selected?.id);
  const oppDocs = (documents.data ?? []).filter((doc) => doc.opportunity_id === selected?.id);
  const offerVersionById = new Map(oppOffers.map((offer) => [offer.id, offer.version]));
  const confirmedCandidates = (candidates.data ?? []).filter((candidate) => candidate.status === 'confirmed');

  // A confirmed candidate becomes an offer line: their role as the name, their rate as the amount.
  const candidateLine = (candidate: (typeof confirmedCandidates)[number]): OfferItemInput => {
    const name = prettyName(candidate.user?.full_name ?? 'Team member');
    const role = candidate.title ?? candidate.user?.title ?? null;
    return {
      name: role ? `${name} — ${role}` : name,
      detail: '',
      // A staffed person is billed hourly, so they come in as a time & materials line at their
      // rate — which for a T&M line lives in `amount`.
      amount: candidate.hourly_rate ?? 0,
      billing_type: 'time_materials',
      overtime_rate: null,
      monthly_hours: null,
    };
  };

  const setStage = async (stage: Opportunity['stage']) => {
    if (!selected) return;
    try {
      await adminUpsertOpportunity({
        id: selected.id,
        account_id: account.id,
        name: selected.name,
        stage,
        amount: selected.amount,
        close_date: selected.close_date,
      });
      toast.success(
        stage === 'closed_won'
          ? 'Marked Closed Won — a project was created automatically.'
          : 'Stage updated — the client sees the new stage now.',
      );
      await opportunities.reload();
      await onChange();
    } catch (cause) {
      toast.error('Could not change the stage', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  const addOpportunity = async () => {
    const name = window.prompt('Name this opportunity', `${account.name} — Salesforce engagement`)?.trim();
    if (!name) return;
    try {
      const id = await adminUpsertOpportunity({
        account_id: account.id,
        name,
        stage: 'discovery',
        amount: null,
        close_date: null,
      });
      // Build its Drive folder tree (Discovery / Proposal / Contract / Invoice / Delivery /
      // Candidates). Best-effort: a missing Drive config must not fail creating the opportunity.
      try {
        await driveProvisionOpportunity(account.id, id);
      } catch (cause) {
        if (!(cause instanceof DriveNotConfiguredError)) {
          console.warn('Opportunity Drive provisioning failed:', cause);
        }
      }
      setSelectedId(id);
      await opportunities.reload();
      await onChange();
    } catch (cause) {
      toast.error('Could not create the opportunity', {
        description: cause instanceof Error ? cause.message : undefined,
      });
    }
  };

  const removeOpportunity = async () => {
    if (!selected) return;
    if (
      !window.confirm(
        `Delete "${selected.name}"? Its offers and documents stay in the account but are unlinked from this opportunity. This can't be undone.`,
      )
    )
      return;
    try {
      await adminDeleteOpportunity(selected.id);
      toast.success('Opportunity deleted.');
      setSelectedId(null); // fall back to the newest remaining opportunity
      await opportunities.reload();
      await offers.reload();
      await documents.reload();
      await onChange();
    } catch (cause) {
      toast.error('Could not delete the opportunity', {
        description: cause instanceof Error ? cause.message : undefined,
      });
    }
  };

  const toggleBuilder = () => {
    setShowBuilder((open) => {
      const next = !open;
      // Opening a fresh builder pre-fills the lines from confirmed candidates.
      if (next && confirmedCandidates.length > 0) {
        setItems((current) =>
          current.some((item) => item.name.trim().length > 0)
            ? current
            : confirmedCandidates.map(candidateLine),
        );
      }
      return next;
    });
  };

  const addCandidateLine = (candidate: (typeof confirmedCandidates)[number]) => {
    setItems((current) => {
      const seeded = current.filter((item) => item.name.trim().length > 0);
      return [...seeded, candidateLine(candidate)];
    });
  };

  const patchItem = (index: number, patch: Partial<OfferItemInput>) =>
    setItems((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const submitOffer = async (send: boolean) => {
    if (!selected) return;
    const cleanItems = items.filter((item) => item.name.trim().length > 0);
    if (!title.trim() || cleanItems.length === 0) {
      toast.error('Add a title and at least one line item.');
      return;
    }
    setBusy(true);
    try {
      await adminCreateOfferVersion({
        account_id: account.id,
        opportunity_id: selected.id,
        title: title.trim(),
        summary: summary.trim(),
        expires_on: expiresOn || null,
        change_note: changeNote.trim() || null,
        items: cleanItems.map((item) => {
          const isFixed = item.billing_type === 'fixed_price';
          return {
            name: item.name,
            detail: item.detail,
            billing_type: item.billing_type,
            // Fixed price: the monthly sum. T&M: the quoted hourly rate. Both live in `amount`.
            amount: Number(item.amount) || 0,
            overtime_rate:
              item.overtime_rate != null && !Number.isNaN(Number(item.overtime_rate))
                ? Number(item.overtime_rate)
                : null,
            monthly_hours:
              isFixed && item.monthly_hours && Number(item.monthly_hours) > 0 ? Number(item.monthly_hours) : null,
          };
        }),
        send,
      });
      toast.success(send ? 'Offer sent to the client.' : 'Draft saved.');
      setShowBuilder(false);
      setTitle('');
      setSummary('');
      setChangeNote('');
      setItems([{ ...EMPTY_ITEM }]);
      await offers.reload();
    } catch (cause) {
      toast.error('Could not save the offer', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const send = async (offerId: string, label: string) => {
    try {
      await adminSendOffer(offerId, account.id, label);
      toast.success('Offer sent.');
      await offers.reload();
    } catch (cause) {
      toast.error('Could not send', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  const pickOfferDoc = (offerId: string) => {
    attachTargetOfferId.current = offerId;
    offerFileInputRef.current?.click();
  };

  const attachOfferDoc = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = ''; // allow re-picking the same file later
    const offerId = attachTargetOfferId.current;
    if (!file || !offerId || !selected) return;
    setAttachingOfferId(offerId);
    try {
      await adminUploadDocument({
        account_id: account.id,
        name: file.name,
        doc_type: 'proposal',
        status: 'sent',
        file,
        // Link to both the offer and its opportunity so it shows under either.
        opportunity_id: selected.id,
        related_offer_id: offerId,
      });
      toast.success('Document attached to the offer.');
      await documents.reload();
    } catch (cause) {
      toast.error('Could not attach', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setAttachingOfferId(null);
    }
  };

  const uploadDoc = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    if (!docName.trim() && !docFile) {
      toast.error('Give the document a name or pick a file.');
      return;
    }
    setDocBusy(true);
    try {
      await adminUploadDocument({
        account_id: account.id,
        name: docName.trim() || docFile?.name || 'Document',
        doc_type: docType,
        status: 'sent',
        file: docFile,
        opportunity_id: selected.id,
      });
      toast.success('Document added to this opportunity.');
      setDocName('');
      setDocFile(null);
      await documents.reload();
    } catch (cause) {
      toast.error('Could not upload', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setDocBusy(false);
    }
  };

  const openDoc = async (filePath: string | null) => {
    if (!filePath) return;
    try {
      window.open(await getDocumentUrl(filePath), '_blank', 'noopener');
    } catch (cause) {
      toast.error('Could not open', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  const removeDoc = async (id: string, name: string) => {
    if (!window.confirm(`Remove "${name}"?`)) return;
    try {
      await adminDeleteDocument(id);
      await documents.reload();
    } catch (cause) {
      toast.error('Could not remove', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  if (opportunities.loading || offers.loading || documents.loading) return <PortalSpinner />;
  if (opportunities.error) return <ErrorNote>{opportunities.error}</ErrorNote>;
  if (offers.error) return <ErrorNote>{offers.error}</ErrorNote>;

  return (
    <div className="space-y-5">
      <PortalCard
        title="Opportunities"
        description="Each opportunity carries its own offers and documents; winning one spins up a project."
        action={
          <PortalButton onClick={addOpportunity}>
            <Plus className="h-4 w-4" /> Add opportunity
          </PortalButton>
        }
      >
        {opps.length === 0 ? (
          <EmptyState title="No opportunities yet" description="Add one to start tracking a deal in the portal." />
        ) : opps.length === 1 ? (
          <p className="text-sm text-grey">
            One opportunity — <span className="font-medium text-foreground">{opps[0].name}</span>. Add another to run
            several deals in parallel.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {opps.map((opp) => (
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
                <div className="mt-0.5 flex items-center gap-2 text-xs text-grey">
                  <StatusTag tone={toneFor(opp.stage)}>{STAGE_LABELS[opp.stage]}</StatusTag>
                  {opp.amount != null && <span>{formatMoney(opp.amount)}</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </PortalCard>

      {selected && (
        <>
          <PortalCard
            title="Stage"
            description={selected.name}
            action={
              <div className="flex items-center gap-2">
                <select
                  className={`${inputClass} w-auto py-1.5 text-xs`}
                  value={selected.stage}
                  onChange={(event) => setStage(event.target.value as Opportunity['stage'])}
                >
                  {[...OPPORTUNITY_STAGES, 'closed_lost'].map((stage) => (
                    <option key={stage} value={stage}>
                      {STAGE_LABELS[stage]}
                    </option>
                  ))}
                </select>
                <PortalButton variant="ghost" onClick={removeOpportunity} aria-label="Delete opportunity">
                  <Trash2 className="h-4 w-4" />
                </PortalButton>
              </div>
            }
          >
            <div className="px-2 pt-2 pb-1">
              <StageTracker stages={STAGES} current={selected.stage} />
            </div>
          </PortalCard>

          <WorkspaceIntake account={account} opportunity={selected} onOpportunityChange={opportunities.reload} />

          <WorkspaceCandidates account={account} opportunity={selected} />

          <PortalCard
            title="Offers"
            description="Revisions create a new version for this opportunity; the previous one is superseded."
            action={
              <PortalButton onClick={toggleBuilder}>
                <Plus className="h-4 w-4" /> New offer version
              </PortalButton>
            }
          >
            {showBuilder && (
              <div className="mb-5 space-y-3 rounded-lg border border-border-color bg-off-white p-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Offer title">
                    <input className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} />
                  </Field>
                  <Field label="Valid through">
                    <input
                      type="date"
                      className={inputClass}
                      value={expiresOn}
                      onChange={(event) => setExpiresOn(event.target.value)}
                    />
                  </Field>
                  <Field label="What changed" hint="Shown in the client's offer history.">
                    <input
                      className={inputClass}
                      value={changeNote}
                      onChange={(event) => setChangeNote(event.target.value)}
                    />
                  </Field>
                </div>
                <Field label="Summary">
                  <textarea
                    rows={2}
                    className={inputClass}
                    value={summary}
                    onChange={(event) => setSummary(event.target.value)}
                  />
                </Field>

                <div className="space-y-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-grey">Line items</span>
                  {items.map((item, index) => {
                    const isFixed = item.billing_type === 'fixed_price';
                    const monthlyHoursNum = Number(item.monthly_hours) || 0;
                    const amountNum = Number(item.amount) || 0;
                    // Effective hourly rate for a fixed-price line: monthly sum spread over hours.
                    // Derived the same way it is shown on saved offers, so the preview matches.
                    const lineRate = isFixed && monthlyHoursNum > 0 ? amountNum / monthlyHoursNum : null;
                    return (
                      <div key={index} className="space-y-2 rounded-lg border border-border-color p-3">
                        <div className="grid gap-2 sm:grid-cols-[1fr_1.5fr_40px]">
                          <input
                            className={inputClass}
                            placeholder="Name"
                            value={item.name}
                            onChange={(event) => patchItem(index, { name: event.target.value })}
                          />
                          <input
                            className={inputClass}
                            placeholder="Detail"
                            value={item.detail}
                            onChange={(event) => patchItem(index, { detail: event.target.value })}
                          />
                          <PortalButton
                            variant="ghost"
                            type="button"
                            onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
                            aria-label="Remove line item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </PortalButton>
                        </div>
                        <div className="grid items-start gap-2 sm:grid-cols-2 lg:grid-cols-4">
                          <Field label="Billing">
                            <select
                              className={inputClass}
                              value={item.billing_type}
                              onChange={(event) => {
                                const nextType = event.target.value as OfferBillingType;
                                // `amount` means the monthly sum for fixed price but the hourly
                                // rate for T&M, so reset it (and the fixed-only hours) on switch to
                                // avoid carrying a stale figure across billing types.
                                patchItem(index, { billing_type: nextType, amount: 0, monthly_hours: null });
                              }}
                            >
                              {(Object.keys(OFFER_BILLING_LABELS) as OfferBillingType[]).map((key) => (
                                <option key={key} value={key}>
                                  {OFFER_BILLING_LABELS[key]}
                                </option>
                              ))}
                            </select>
                          </Field>
                          {isFixed ? (
                            <>
                              <Field label="Fixed sum / month">
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  className={inputClass}
                                  value={item.amount}
                                  onChange={(event) => patchItem(index, { amount: Number(event.target.value) })}
                                />
                              </Field>
                              <Field label="Hours / month">
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  className={inputClass}
                                  value={item.monthly_hours ?? ''}
                                  onChange={(event) =>
                                    patchItem(index, {
                                      monthly_hours: event.target.value === '' ? null : Number(event.target.value),
                                    })
                                  }
                                />
                              </Field>
                            </>
                          ) : (
                            <Field label="Hourly rate">
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                className={inputClass}
                                value={item.amount || ''}
                                onChange={(event) => patchItem(index, { amount: Number(event.target.value) })}
                              />
                            </Field>
                          )}
                          <Field label="Overtime rate" hint="Hourly rate beyond the agreed scope.">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              className={inputClass}
                              value={item.overtime_rate ?? ''}
                              onChange={(event) =>
                                patchItem(index, {
                                  overtime_rate: event.target.value === '' ? null : Number(event.target.value),
                                })
                              }
                            />
                          </Field>
                        </div>
                        {isFixed && (
                          <div className="text-xs text-grey">
                            Effective hourly rate:{' '}
                            <span className="font-semibold text-violet">
                              {lineRate != null ? `${formatMoney(lineRate)}/h` : '—'}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <PortalButton
                    variant="ghost"
                    type="button"
                    onClick={() => setItems((current) => [...current, { ...EMPTY_ITEM }])}
                  >
                    <Plus className="h-4 w-4" /> Add line item
                  </PortalButton>

                  {confirmedCandidates.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 border-t border-border-color pt-2">
                      <span className="text-xs font-medium text-grey">Add confirmed candidate:</span>
                      {confirmedCandidates.map((candidate) => (
                        <button
                          key={candidate.id}
                          type="button"
                          onClick={() => addCandidateLine(candidate)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border-color px-2.5 py-1 text-xs font-medium text-violet transition-colors hover:bg-portal-tint"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          {prettyName(candidate.user?.full_name ?? 'Team member')}
                          {candidate.hourly_rate != null && (
                            <span className="text-grey">· {formatMoney(candidate.hourly_rate)}/h</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 border-t border-border-color pt-3">
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm font-semibold">
                    {builderTotals.hasFixed && <span>Fixed: {formatMoney(builderTotals.fixed)}/mo</span>}
                    {builderTotals.hasHourly && <span>Hourly: {formatMoney(builderTotals.hourly)}/h</span>}
                    {!builderTotals.hasFixed && !builderTotals.hasHourly && <span>Total: {formatMoney(0)}</span>}
                  </span>
                  <div className="ml-auto flex gap-2">
                    <PortalButton variant="secondary" disabled={busy} onClick={() => submitOffer(false)}>
                      Save draft
                    </PortalButton>
                    <PortalButton disabled={busy} onClick={() => submitOffer(true)}>
                      <Send className="h-4 w-4" /> Send to client
                    </PortalButton>
                  </div>
                </div>
              </div>
            )}

            {oppOffers.length === 0 ? (
              <EmptyState title="No offers yet" />
            ) : (
              <PortalTable head={['', 'Version', 'Title', 'Total', 'Status', 'Sent', 'Client note', '']}>
                {oppOffers.map((offer) => {
                  const expanded = expandedOfferId === offer.id;
                  const offerDocs = (documents.data ?? []).filter((doc) => doc.related_offer_id === offer.id);
                  return (
                    <React.Fragment key={offer.id}>
                      <Row>
                        <Cell>
                          <button
                            type="button"
                            onClick={() => setExpandedOfferId(expanded ? null : offer.id)}
                            aria-label={expanded ? 'Hide details' : 'Show details'}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-grey transition-colors hover:bg-portal-tint hover:text-violet"
                          >
                            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        </Cell>
                        <Cell className="font-medium">v{offer.version}</Cell>
                        <Cell>{offer.title}</Cell>
                        <Cell className="whitespace-nowrap">{formatOfferTotal(offer.items, offer.currency)}</Cell>
                        <Cell>
                          <StatusTag tone={toneFor(offer.status)}>{OFFER_STATUS_LABELS[offer.status]}</StatusTag>
                        </Cell>
                        <Cell className="whitespace-nowrap text-grey">{formatDate(offer.sent_at)}</Cell>
                        <Cell className="max-w-xs text-grey">{offer.client_note ?? '—'}</Cell>
                        <Cell className="text-right">
                          <div className="flex justify-end gap-1">
                            <PortalButton
                              variant="ghost"
                              onClick={() => pickOfferDoc(offer.id)}
                              disabled={attachingOfferId === offer.id}
                              aria-label="Attach document to this offer"
                              title="Attach document"
                            >
                              <Paperclip className="h-4 w-4" />
                            </PortalButton>
                            {offer.status === 'draft' && (
                              <PortalButton onClick={() => send(offer.id, `${offer.title} (v${offer.version})`)}>
                                <Send className="h-4 w-4" /> Send
                              </PortalButton>
                            )}
                          </div>
                        </Cell>
                      </Row>
                      {expanded && (
                        <Row className="bg-off-white">
                          <Cell />
                          <Cell colSpan={7}>
                            <div className="space-y-4 py-1">
                              {offer.summary && <p className="text-sm text-grey">{offer.summary}</p>}

                              <div>
                                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-grey">
                                  Line items
                                </div>
                                {offer.items.length === 0 ? (
                                  <p className="text-sm text-grey">No line items.</p>
                                ) : (
                                  <table className="w-full text-sm">
                                    <tbody>
                                      {[...offer.items]
                                        .sort((a, b) => a.position - b.position)
                                        .map((item) => {
                                          const isFixed = item.billing_type === 'fixed_price';
                                          // Effective hourly rate for a fixed-price line, derived
                                          // from its monthly sum and hours.
                                          const fixedRate =
                                            isFixed && item.monthly_hours && item.monthly_hours > 0
                                              ? item.amount / item.monthly_hours
                                              : null;
                                          return (
                                            <tr key={item.id} className="border-b border-border-color/60 last:border-0">
                                              <td className="py-1.5 pr-3 font-medium">{item.name}</td>
                                              <td className="py-1.5 pr-3 text-grey">
                                                {item.detail}
                                                <div className="text-xs">
                                                  {OFFER_BILLING_LABELS[item.billing_type]}
                                                  {isFixed && item.monthly_hours != null && (
                                                    <> · {item.monthly_hours}h/month</>
                                                  )}
                                                  {fixedRate != null && (
                                                    <> · {formatMoney(fixedRate, offer.currency)}/h</>
                                                  )}
                                                  {item.overtime_rate != null && (
                                                    <> · OT {formatMoney(item.overtime_rate, offer.currency)}/h</>
                                                  )}
                                                </div>
                                              </td>
                                              <td className="whitespace-nowrap py-1.5 text-right font-medium">
                                                {isFixed ? (
                                                  <>
                                                    {formatMoney(item.amount, offer.currency)}
                                                    <span className="text-grey">/mo</span>
                                                  </>
                                                ) : (
                                                  <>
                                                    {formatMoney(item.amount, offer.currency)}
                                                    <span className="text-grey">/h</span>
                                                  </>
                                                )}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      {(() => {
                                        const totals = offerTotals(offer.items);
                                        return (
                                          <>
                                            {totals.hasFixed && (
                                              <tr className="border-t border-border-color">
                                                <td className="py-1.5 pr-3 font-semibold" colSpan={2}>
                                                  Total (fixed price)
                                                </td>
                                                <td className="whitespace-nowrap py-1.5 text-right font-semibold text-violet">
                                                  {formatMoney(totals.fixed, offer.currency)}
                                                  <span className="text-grey">/mo</span>
                                                </td>
                                              </tr>
                                            )}
                                            {totals.hasHourly && (
                                              <tr className="border-t border-border-color">
                                                <td className="py-1.5 pr-3 font-semibold" colSpan={2}>
                                                  Total (hourly)
                                                </td>
                                                <td className="whitespace-nowrap py-1.5 text-right font-semibold text-violet">
                                                  {formatMoney(totals.hourly, offer.currency)}
                                                  <span className="text-grey">/h</span>
                                                </td>
                                              </tr>
                                            )}
                                          </>
                                        );
                                      })()}
                                    </tbody>
                                  </table>
                                )}
                              </div>

                              <div>
                                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-grey">
                                  Attached documents
                                </div>
                                {offerDocs.length === 0 ? (
                                  <p className="text-sm text-grey">No documents attached to this offer yet.</p>
                                ) : (
                                  <ul className="space-y-1">
                                    {offerDocs.map((doc) => (
                                      <li key={doc.id} className="flex items-center justify-between gap-2 text-sm">
                                        <span className="flex min-w-0 items-center gap-2">
                                          <Paperclip className="h-3.5 w-3.5 shrink-0 text-grey" />
                                          <span className="truncate">{doc.name}</span>
                                        </span>
                                        <div className="flex shrink-0 gap-1">
                                          {doc.file_url && (
                                            <PortalButton
                                              variant="ghost"
                                              onClick={() => openDoc(doc.file_url)}
                                              aria-label="Download"
                                            >
                                              <Download className="h-4 w-4" />
                                            </PortalButton>
                                          )}
                                          <PortalButton
                                            variant="ghost"
                                            onClick={() => removeDoc(doc.id, doc.name)}
                                            aria-label="Remove"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </PortalButton>
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </div>
                          </Cell>
                        </Row>
                      )}
                    </React.Fragment>
                  );
                })}
              </PortalTable>
            )}

            <input ref={offerFileInputRef} type="file" className="hidden" onChange={attachOfferDoc} />
          </PortalCard>

          <PortalCard
            title="Contracts & Documents"
            description="Attached to this opportunity. On Closed Won they follow the deal into the project."
          >
            <form onSubmit={uploadDoc} className="mb-4 grid gap-3 rounded-lg border border-border-color bg-off-white p-4 sm:grid-cols-[2fr_1fr_1.5fr_auto]">
              <Field label="Name">
                <input className={inputClass} value={docName} onChange={(event) => setDocName(event.target.value)} />
              </Field>
              <Field label="Type">
                <select className={inputClass} value={docType} onChange={(event) => setDocType(event.target.value as DocType)}>
                  {DOC_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {DOC_TYPE_LABELS[value]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="File">
                <input
                  type="file"
                  className={`${inputClass} py-1.5`}
                  onChange={(event) => setDocFile(event.target.files?.[0] ?? null)}
                />
              </Field>
              <div className="flex items-end">
                <PortalButton type="submit" disabled={docBusy}>
                  <Upload className="h-4 w-4" /> Add
                </PortalButton>
              </div>
            </form>

            {oppDocs.length === 0 ? (
              <EmptyState title="No documents on this opportunity yet" />
            ) : (
              <PortalTable head={['Name', 'Type', 'Version', 'Updated', '']}>
                {oppDocs.map((doc) => (
                  <Row key={doc.id}>
                    <Cell className="font-medium">
                      <span className="flex items-center gap-2">
                        {doc.name}
                        {doc.related_offer_id && offerVersionById.has(doc.related_offer_id) && (
                          <StatusTag tone="violet">Offer v{offerVersionById.get(doc.related_offer_id)}</StatusTag>
                        )}
                      </span>
                    </Cell>
                    <Cell className="text-grey">{DOC_TYPE_LABELS[doc.doc_type]}</Cell>
                    <Cell className="text-grey">v{doc.version}</Cell>
                    <Cell className="whitespace-nowrap text-grey">{formatDate(doc.updated_at)}</Cell>
                    <Cell className="text-right">
                      <div className="flex justify-end gap-1">
                        {doc.file_url && (
                          <PortalButton variant="ghost" onClick={() => openDoc(doc.file_url)} aria-label="Download">
                            <Download className="h-4 w-4" />
                          </PortalButton>
                        )}
                        <PortalButton variant="ghost" onClick={() => removeDoc(doc.id, doc.name)} aria-label="Remove">
                          <Trash2 className="h-4 w-4" />
                        </PortalButton>
                      </div>
                    </Cell>
                  </Row>
                ))}
              </PortalTable>
            )}
          </PortalCard>
        </>
      )}
    </div>
  );
};
