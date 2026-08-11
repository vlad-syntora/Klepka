import React from 'react';
import { toast } from 'sonner';
import { Check, ChevronDown, ChevronRight, Download, Paperclip, Pencil, Plus, Send, Trash2, Upload, UserPlus } from 'lucide-react';
import { useAsync } from '@/app/hooks/use-async';
import {
  adminCreateOfferVersion,
  adminDeleteDocument,
  adminDeleteOpportunity,
  adminListCandidates,
  adminListDocuments,
  adminListInternalUsers,
  adminListOffers,
  adminListOpportunities,
  adminSendOffer,
  adminSetOfferStatus,
  adminUploadDocument,
  adminUpsertOpportunity,
  driveProvisionOpportunity,
  DriveNotConfiguredError,
  type OfferItemInput,
} from '@/app/lib/portal-admin-api';
import { WorkspaceCandidates } from '@/app/components/admin/portal/WorkspaceCandidates';
import { EntityProductsCard } from '@/app/components/portal/EntityProductsCard';
import { WorkspaceIntake } from '@/app/components/admin/portal/WorkspaceIntake';
import { getDocumentUrl } from '@/app/lib/portal-api';
import { formatDate, formatMoney, formatOfferTotal, offerTotals, prettyName } from '@/app/lib/portal-format';
import {
  DOC_TYPES,
  DOC_TYPE_LABELS,
  OFFER_BILLING_LABELS,
  OFFER_STATUS_LABELS,
  OPPORTUNITY_STAGES,
  PROJECT_TYPES,
  PROJECT_TYPE_LABELS,
  STAGE_LABELS,
  type DocType,
  type OfferBillingType,
  type Opportunity,
  type PortalAccount,
  type ProjectType,
} from '@/app/lib/portal-types';
import {
  Cell,
  EmptyState,
  ErrorNote,
  Field,
  PortalButton,
  PortalCard,
  PortalModal,
  PortalSpinner,
  PortalTable,
  Row,
  StageTracker,
  StatusTag,
  inputClass,
  toneFor,
} from '@/app/components/portal/PortalUi';

const STAGES = OPPORTUNITY_STAGES.map((key) => ({ key, label: STAGE_LABELS[key] }));

/** Deal settings for the selected opportunity: project type + hours budget (migrations 0034/0035). */
const OpportunityHoursCard: React.FC<{
  account: PortalAccount;
  opportunity: Opportunity;
  // Reports the persisted values so the parent can patch its cache in place — deliberately no
  // reload, so saving never flashes the whole pipeline back to a spinner.
  onSaved: (values: {
    bank_hours: number | null;
    notify_hours: number | null;
    project_type: ProjectType | null;
  }) => void;
}> = ({ account, opportunity, onSaved }) => {
  const [bank, setBank] = React.useState('');
  const [notify, setNotify] = React.useState('');
  const [projectType, setProjectType] = React.useState<ProjectType | ''>('');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setBank(opportunity.bank_hours != null ? String(opportunity.bank_hours) : '');
    setNotify(opportunity.notify_hours != null ? String(opportunity.notify_hours) : '');
    setProjectType(opportunity.project_type ?? '');
  }, [opportunity.id, opportunity.bank_hours, opportunity.notify_hours, opportunity.project_type]);

  const save = async () => {
    const bankValue = bank.trim() === '' ? null : Number(bank);
    const notifyValue = notify.trim() === '' ? null : Number(notify);
    const typeValue = projectType === '' ? null : projectType;
    setBusy(true);
    try {
      await adminUpsertOpportunity({
        id: opportunity.id,
        account_id: account.id,
        name: opportunity.name,
        stage: opportunity.stage,
        amount: opportunity.amount,
        close_date: opportunity.close_date,
        bank_hours: bankValue,
        notify_hours: notifyValue,
        project_type: typeValue,
      });
      toast.success('Deal settings saved — they carry onto new offers and the project.');
      onSaved({ bank_hours: bankValue, notify_hours: notifyValue, project_type: typeValue });
    } catch (cause) {
      toast.error('Could not save the deal settings', {
        description: cause instanceof Error ? cause.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <PortalCard
      title="Deal settings"
      description="Project type and an hours budget for this deal. They carry onto new offers and its project; a blank hours field stays hidden from the client."
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
        <Field label="Project type">
          <select
            className={inputClass}
            value={projectType}
            onChange={(event) => setProjectType(event.target.value as ProjectType | '')}
          >
            <option value="">Not set</option>
            {PROJECT_TYPES.map((type) => (
              <option key={type} value={type}>
                {PROJECT_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Bank of hours">
          <input
            type="number"
            min={0}
            step="0.25"
            className={inputClass}
            value={bank}
            onChange={(event) => setBank(event.target.value)}
          />
        </Field>
        <Field label="Notify customer at (h)">
          <input
            type="number"
            min={0}
            step="0.25"
            className={inputClass}
            value={notify}
            onChange={(event) => setNotify(event.target.value)}
          />
        </Field>
        <PortalButton onClick={save} disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </PortalButton>
      </div>
    </PortalCard>
  );
};

const EMPTY_ITEM: OfferItemInput = {
  name: '',
  detail: '',
  amount: 0,
  billing_type: 'time_materials',
  overtime_rate: null,
  monthly_hours: null,
  employee_id: null,
  pay_rate: null,
};

export const WorkspacePipeline: React.FC<{ account: PortalAccount; onChange: () => Promise<void> }> = ({
  account,
  onChange,
}) => {
  const opportunities = useAsync(() => adminListOpportunities(account.id), [account.id]);
  const offers = useAsync(() => adminListOffers(account.id), [account.id]);
  const documents = useAsync(() => adminListDocuments(account.id), [account.id]);
  // Internal staff, used to suggest employee names on offer line items.
  const staff = useAsync(() => adminListInternalUsers(), []);

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [expandedOfferId, setExpandedOfferId] = React.useState<string | null>(null);

  // Add / rename opportunity modal
  const [oppModal, setOppModal] = React.useState<null | { mode: 'create' | 'rename' }>(null);
  const [oppName, setOppName] = React.useState('');
  const [oppBusy, setOppBusy] = React.useState(false);

  // Offer builder state
  const [showBuilder, setShowBuilder] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [summary, setSummary] = React.useState('');
  const [expiresOn, setExpiresOn] = React.useState('');
  const [changeNote, setChangeNote] = React.useState('');
  // Hours budget for this offer version, prefilled from the opportunity when the builder opens.
  const [offerBank, setOfferBank] = React.useState('');
  const [offerNotify, setOfferNotify] = React.useState('');
  const [items, setItems] = React.useState<OfferItemInput[]>([{ ...EMPTY_ITEM }]);
  // A document attached while building the offer, uploaded once the offer is created.
  const [offerDoc, setOfferDoc] = React.useState<File | null>(null);
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
    // A confirmed candidate is a real internal user, so link the line to them and seed the cost rate
    // from their default (finance, 0044).
    const employee = staff.data?.find((person) => person.id === candidate.user?.id) ?? null;
    return {
      name: role ? `${name} — ${role}` : name,
      detail: '',
      // A staffed person is billed hourly, so they come in as a time & materials line at their
      // rate — which for a T&M line lives in `amount`.
      amount: candidate.hourly_rate ?? 0,
      billing_type: 'time_materials',
      overtime_rate: null,
      monthly_hours: null,
      employee_id: employee?.id ?? candidate.user?.id ?? null,
      pay_rate: employee?.pay_rate ?? null,
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

  const openCreateOpp = () => {
    setOppName(`${account.name} — Salesforce engagement`);
    setOppModal({ mode: 'create' });
  };

  const openRenameOpp = () => {
    if (!selected) return;
    setOppName(selected.name);
    setOppModal({ mode: 'rename' });
  };

  const submitOpp = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = oppName.trim();
    if (!name) {
      toast.error('Give the opportunity a name.');
      return;
    }
    setOppBusy(true);
    try {
      if (oppModal?.mode === 'rename' && selected) {
        await adminUpsertOpportunity({
          id: selected.id,
          account_id: account.id,
          name,
          stage: selected.stage,
          amount: selected.amount,
          close_date: selected.close_date,
        });
        toast.success('Opportunity renamed.');
      } else {
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
      }
      setOppModal(null);
      await opportunities.reload();
      await onChange();
    } catch (cause) {
      toast.error('Could not save the opportunity', {
        description: cause instanceof Error ? cause.message : undefined,
      });
    } finally {
      setOppBusy(false);
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
      if (next) {
        // Opening a fresh builder pre-fills the lines from confirmed candidates…
        if (confirmedCandidates.length > 0) {
          setItems((current) =>
            current.some((item) => item.name.trim().length > 0)
              ? current
              : confirmedCandidates.map(candidateLine),
          );
        }
        // …and the hours budget from the opportunity (still editable per version).
        setOfferBank(selected?.bank_hours != null ? String(selected.bank_hours) : '');
        setOfferNotify(selected?.notify_hours != null ? String(selected.notify_hours) : '');
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
      const offerId = await adminCreateOfferVersion({
        account_id: account.id,
        opportunity_id: selected.id,
        title: title.trim(),
        summary: summary.trim(),
        expires_on: expiresOn || null,
        change_note: changeNote.trim() || null,
        bank_hours: offerBank.trim() === '' ? null : Number(offerBank),
        notify_hours: offerNotify.trim() === '' ? null : Number(offerNotify),
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
            employee_id: item.employee_id ?? null,
            pay_rate:
              item.pay_rate != null && !Number.isNaN(Number(item.pay_rate)) ? Number(item.pay_rate) : null,
          };
        }),
        send,
      });

      // Attach the document picked in the builder, linked to this offer and its opportunity.
      // Best-effort: the offer already saved, so a failed upload shouldn't lose it.
      if (offerDoc) {
        try {
          await adminUploadDocument({
            account_id: account.id,
            name: offerDoc.name,
            doc_type: 'proposal',
            status: 'sent',
            file: offerDoc,
            opportunity_id: selected.id,
            related_offer_id: offerId,
          });
          await documents.reload();
        } catch (cause) {
          toast.warning('Offer saved, but the document could not be attached.', {
            description: cause instanceof Error ? cause.message : undefined,
          });
        }
      }

      toast.success(send ? 'Offer sent to the client.' : 'Draft saved.');
      setShowBuilder(false);
      setTitle('');
      setSummary('');
      setChangeNote('');
      setOfferBank('');
      setOfferNotify('');
      setItems([{ ...EMPTY_ITEM }]);
      setOfferDoc(null);
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

  // Staff-side accept — sign an offer off on the client's behalf (e.g. after a verbal yes).
  const approve = async (offerId: string, label: string) => {
    if (!window.confirm(`Mark "${label}" as accepted on the client's behalf?`)) return;
    try {
      await adminSetOfferStatus(offerId, account.id, 'accepted', label);
      toast.success('Offer marked as accepted.');
      await offers.reload();
    } catch (cause) {
      toast.error('Could not approve', { description: cause instanceof Error ? cause.message : undefined });
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
    <div className="space-y-2">
      <PortalModal
        open={oppModal !== null}
        onClose={() => setOppModal(null)}
        title={oppModal?.mode === 'rename' ? 'Rename opportunity' : 'Add opportunity'}
        description="Each opportunity carries its own offers and documents; winning one spins up a project."
      >
        <form onSubmit={submitOpp} className="space-y-3">
          <Field label="Opportunity name">
            <input
              autoFocus
              className={inputClass}
              value={oppName}
              onChange={(event) => setOppName(event.target.value)}
            />
          </Field>
          <div className="flex gap-2">
            <PortalButton type="submit" disabled={oppBusy}>
              {oppBusy ? 'Saving…' : oppModal?.mode === 'rename' ? 'Save name' : 'Add opportunity'}
            </PortalButton>
            <PortalButton type="button" variant="ghost" onClick={() => setOppModal(null)}>
              Cancel
            </PortalButton>
          </div>
        </form>
      </PortalModal>

      {/* Header-only selector bar, one row: Section name · picklist (centered) · New button —
          no body, not collapsible. */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border-color bg-card px-5 py-3 shadow-sm">
        <h2 className="shrink-0 text-[15px] font-semibold text-violet">Opportunities</h2>
        <div className="flex flex-1 justify-center">
          {opps.length > 1 && (
            <select
              className={`${inputClass} w-auto max-w-full py-1.5 text-xs`}
              value={selected?.id ?? ''}
              onChange={(event) => setSelectedId(event.target.value)}
              aria-label="Choose opportunity"
            >
              {opps.map((opp) => (
                <option key={opp.id} value={opp.id}>
                  {opp.name} · {STAGE_LABELS[opp.stage]}
                  {opp.amount != null ? ` · ${formatMoney(opp.amount)}` : ''}
                </option>
              ))}
            </select>
          )}
        </div>
        <PortalButton className="shrink-0" onClick={openCreateOpp}>
          <Plus className="h-4 w-4" /> Add opportunity
        </PortalButton>
      </div>

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
                <PortalButton variant="ghost" onClick={openRenameOpp} aria-label="Rename opportunity">
                  <Pencil className="h-4 w-4" />
                </PortalButton>
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

          <OpportunityHoursCard
            account={account}
            opportunity={selected}
            onSaved={(values) =>
              opportunities.mutate((previous) =>
                previous
                  ? previous.map((opp) => (opp.id === selected.id ? { ...opp, ...values } : opp))
                  : previous,
              )
            }
          />

          <EntityProductsCard
            entity="opportunity"
            id={selected.id}
            description="Products in scope for this opportunity. Clients can edit these too."
          />

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
            <PortalModal
              open={showBuilder}
              onClose={() => setShowBuilder(false)}
              title="New offer version"
              description="Revisions create a new version for this opportunity; the previous one is superseded."
              className="max-w-3xl"
            >
              <div className="space-y-3">
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

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Bank of hours" hint="Carried onto the project when this deal is won.">
                    <input
                      type="number"
                      min={0}
                      step="0.25"
                      className={inputClass}
                      value={offerBank}
                      onChange={(event) => setOfferBank(event.target.value)}
                    />
                  </Field>
                  <Field label="Notify customer at (h)">
                    <input
                      type="number"
                      min={0}
                      step="0.25"
                      className={inputClass}
                      value={offerNotify}
                      onChange={(event) => setOfferNotify(event.target.value)}
                    />
                  </Field>
                </div>

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
                          {/* Name is the internal employee this line staffs — the picklist sets the
                              client-facing name, links the employee (seeds project member + salary)
                              and prefills the cost rate, all from one control. */}
                          <select
                            className={inputClass}
                            value={item.employee_id ?? ''}
                            onChange={(event) => {
                              const empId = event.target.value || null;
                              const employee = (staff.data ?? []).find((person) => person.id === empId);
                              patchItem(index, {
                                employee_id: empId,
                                name: employee ? prettyName(employee.full_name) : '',
                                pay_rate: employee?.pay_rate != null ? employee.pay_rate : item.pay_rate,
                              });
                            }}
                          >
                            <option value="">Select employee…</option>
                            {(staff.data ?? []).map((person) => (
                              <option key={person.id} value={person.id}>
                                {prettyName(person.full_name)}
                              </option>
                            ))}
                          </select>
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
                        {/* Internal cost (finance, 0044) — the employee is chosen in the Name picklist
                            above; this is just its hourly cost, defaulted from the employee. */}
                        <div className="grid items-start gap-2 border-t border-border-color pt-2 sm:grid-cols-2">
                          <Field label="Pay rate (cost)" hint="Internal hourly cost. Defaults from the selected employee; editable.">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              className={inputClass}
                              value={item.pay_rate ?? ''}
                              onChange={(event) =>
                                patchItem(index, {
                                  pay_rate: event.target.value === '' ? null : Number(event.target.value),
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

                <Field label="Attach document" hint="Optional — attached to this offer once it's saved.">
                  <input
                    type="file"
                    className={`${inputClass} py-1.5`}
                    onChange={(event) => setOfferDoc(event.target.files?.[0] ?? null)}
                  />
                </Field>

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
            </PortalModal>

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
                            {(offer.status === 'sent' || offer.status === 'changes_requested') && (
                              <PortalButton
                                variant="secondary"
                                onClick={() => approve(offer.id, `${offer.title} (v${offer.version})`)}
                              >
                                <Check className="h-4 w-4" /> Approve
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
