import React from 'react';
import { toast } from 'sonner';
import { Check, Download, GripVertical, Pencil, Plus, Trash2, Upload, UserPlus } from 'lucide-react';
import { useAsync } from '@/app/hooks/use-async';
import { usePortalUser } from '@/app/hooks/use-portal-user';
import {
  adminAddProjectTeamMember,
  adminApproveTimeEntries,
  adminCreateProjectFromOpportunity,
  adminDeleteDocument,
  adminDeleteProject,
  adminDeleteTimeEntry,
  adminListDocuments,
  adminListTimeEntries,
  adminDeleteMilestone,
  adminReorderMilestones,
  adminListInternalUsers,
  adminListMilestones,
  adminListOffers,
  adminListOpportunities,
  adminListProjectTeam,
  adminListProjects,
  adminRemoveProjectTeamMember,
  adminSetProjectTeamPublic,
  adminUpdateProject,
  adminUpdateProjectTeamMember,
  adminUpdateTimeEntry,
  adminUploadDocument,
  adminUpsertMilestone,
} from '@/app/lib/portal-admin-api';
import { getDocumentUrl, listEntityProducts } from '@/app/lib/portal-api';
import { EntityProductsCard } from '@/app/components/portal/EntityProductsCard';
import { HoursBudget } from '@/app/components/portal/HoursBudget';
import { LogHoursButton } from '@/app/components/portal/LogHoursButton';
import { formatDate, formatMoney, prettyName } from '@/app/lib/portal-format';
import {
  DOC_TYPES,
  DOC_TYPE_LABELS,
  HEALTH_LABELS,
  MILESTONE_STATUSES,
  MILESTONE_STATUS_LABELS,
  OFFER_BILLING_LABELS,
  PROJECT_TYPES,
  PROJECT_TYPE_LABELS,
  projectUsesMilestones,
  type DocType,
  type Health,
  type Milestone,
  type OfferBillingType,
  type PortalAccount,
  type Project,
  type ProjectTeamMember,
  type ProjectType,
  type TimeEntry,
} from '@/app/lib/portal-types';
import {
  Cell,
  EmptyState,
  ErrorNote,
  Field,
  IconDateButton,
  InfoNote,
  PortalButton,
  PortalCard,
  PortalModal,
  PortalSpinner,
  PortalTable,
  Row,
  SortHeader,
  StatusTag,
  inputClass,
  toneFor,
  useTableSort,
} from '@/app/components/portal/PortalUi';

const PROJECT_ROLES = ['Delivery Lead', 'Solution Architect', 'Consultant', 'Developer', 'QA', 'Project Manager'];

// Gives a Row-1 card a fixed height with its body scrolling — PortalCard's root is a <section>
// with a <header> + a body <div>. Applied to Products, Project documents and Hours so the three
// columns are the same size no matter how much content each holds (a collapsed card, which drops
// its body <div>, falls back to its natural height via the :has(>div) guard).
const FIXED_PANEL =
  '[&>section:has(>div)]:flex [&>section:has(>div)]:h-[18rem] [&>section:has(>div)]:flex-col ' +
  '[&>section>div]:min-h-0 [&>section>div]:flex-1 [&>section>div]:overflow-y-auto';

// The billing an offer line item carries onto its project team member (migration 0036); admin-only.
type TeamBilling = {
  billing_type: OfferBillingType | null;
  rate: number | null;
  overtime_rate: number | null;
  monthly_hours: number | null;
};

const CreateProjectPanel: React.FC<{
  account: PortalAccount;
  onCreated: () => Promise<void>;
  onCancel?: () => void;
}> = ({ account, onCreated, onCancel }) => {
  const opportunities = useAsync(() => adminListOpportunities(account.id), [account.id]);
  const offers = useAsync(() => adminListOffers(account.id), [account.id]);
  const staff = useAsync(() => adminListInternalUsers(), []);

  const [name, setName] = React.useState(`${account.name} — Salesforce implementation`);
  const [summary, setSummary] = React.useState('');
  const [targetDate, setTargetDate] = React.useState('');
  const [leadId, setLeadId] = React.useState('');
  const [opportunityId, setOpportunityId] = React.useState('');
  const [bankHours, setBankHours] = React.useState('');
  const [notifyHours, setNotifyHours] = React.useState('');
  const [projectType, setProjectType] = React.useState<ProjectType | ''>('');
  const [milestones, setMilestones] = React.useState<{ name: string; description: string; due_date: string }[]>([]);
  // Roster rows seeded from the accepted offer's line items (text-only, no linked user). Each carries
  // the seeding line's billing (migration 0036) so the team member mirrors the offer/opportunity.
  const [team, setTeam] = React.useState<
    ({ display_name: string; project_role: string; employee_id: string | null; pay_rate: number | null } & TeamBilling)[]
  >([]);
  // Products copied from the linked opportunity.
  const [productIds, setProductIds] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);

  // Default the link to the first opportunity once they load.
  React.useEffect(() => {
    if (!opportunityId && opportunities.data?.[0]) setOpportunityId(opportunities.data[0].id);
  }, [opportunities.data, opportunityId]);

  // Prefill the hours budget + project type from the linked opportunity (0034/0035); still editable.
  const linkedOpp = (opportunities.data ?? []).find((opp) => opp.id === opportunityId) ?? null;
  React.useEffect(() => {
    setBankHours(linkedOpp?.bank_hours != null ? String(linkedOpp.bank_hours) : '');
    setNotifyHours(linkedOpp?.notify_hours != null ? String(linkedOpp.notify_hours) : '');
    setProjectType(linkedOpp?.project_type ?? '');
  }, [linkedOpp?.id, linkedOpp?.bank_hours, linkedOpp?.notify_hours, linkedOpp?.project_type]);

  // Copy the linked opportunity's tagged products onto the new project.
  React.useEffect(() => {
    if (!opportunityId) {
      setProductIds([]);
      return;
    }
    let cancelled = false;
    listEntityProducts('opportunity', opportunityId)
      .then((products) => {
        if (!cancelled) setProductIds(products.map((product) => product.id));
      })
      .catch(() => {
        if (!cancelled) setProductIds([]);
      });
    return () => {
      cancelled = true;
    };
  }, [opportunityId]);

  const acceptedOffer = (offers.data ?? []).find((offer) => offer.status === 'accepted');

  // Pre-fill milestones AND the team roster from the accepted offer's line items (design doc §11.3.3;
  // team-from-offer per the confirmed decision — text-only rows, editable below).
  React.useEffect(() => {
    if (acceptedOffer && milestones.length === 0 && team.length === 0) {
      const sorted = [...acceptedOffer.items].sort((a, b) => a.position - b.position);
      setMilestones(sorted.map((item) => ({ name: item.name, description: item.detail, due_date: '' })));
      setTeam(
        sorted.map((item) => ({
          display_name: item.name,
          project_role: item.detail || 'Team member',
          billing_type: item.billing_type ?? null,
          rate: item.amount ?? null,
          overtime_rate: item.overtime_rate ?? null,
          monthly_hours: item.monthly_hours ?? null,
          // Finance (0044): carry the offer line's employee link + cost rate onto the roster row.
          employee_id: item.employee_id ?? null,
          pay_rate: item.pay_rate ?? null,
        })),
      );
    }
  }, [acceptedOffer, milestones.length, team.length]);

  const create = async (publish: boolean) => {
    if (!name.trim()) {
      toast.error('Give the project a name.');
      return;
    }
    setBusy(true);
    try {
      await adminCreateProjectFromOpportunity({
        account_id: account.id,
        opportunity_id: opportunityId || null,
        name: name.trim(),
        summary: summary.trim(),
        target_date: targetDate || null,
        bank_hours: bankHours.trim() === '' ? null : Number(bankHours),
        notify_hours: notifyHours.trim() === '' ? null : Number(notifyHours),
        project_type: projectType === '' ? null : projectType,
        milestones: milestones
          .filter((milestone) => milestone.name.trim().length > 0)
          .map((milestone) => ({ ...milestone, due_date: milestone.due_date || null })),
        team: team.filter((member) => member.display_name.trim().length > 0),
        product_ids: productIds,
        delivery_lead_id: leadId || null,
        publish,
      });
      toast.success(publish ? 'Project published — the client’s tracker is live.' : 'Project saved as a draft.');
      await onCreated();
    } catch (cause) {
      toast.error('Could not create the project', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <PortalCard title="Create project from opportunity" description="Scope is pre-filled from the accepted offer.">
      {!acceptedOffer && (
        <div className="mb-4">
          <InfoNote>
            No accepted offer on this account yet. You can still create the project manually, but milestones won’t be
            pre-filled.
          </InfoNote>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Project name" className="sm:col-span-2">
          <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Target go-live">
          <input
            type="date"
            className={inputClass}
            value={targetDate}
            onChange={(event) => setTargetDate(event.target.value)}
          />
        </Field>
        <Field label="Linked opportunity">
          <select className={inputClass} value={opportunityId} onChange={(event) => setOpportunityId(event.target.value)}>
            <option value="">None</option>
            {(opportunities.data ?? []).map((opp) => (
              <option key={opp.id} value={opp.id}>
                {opp.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Summary" className="sm:col-span-2">
          <input className={inputClass} value={summary} onChange={(event) => setSummary(event.target.value)} />
        </Field>
        <Field label="Delivery lead">
          <select className={inputClass} value={leadId} onChange={(event) => setLeadId(event.target.value)}>
            <option value="">Assign later</option>
            {(staff.data ?? [])
              .filter((person) => person.role === 'delivery_lead' || person.role === 'portal_admin')
              .map((person) => (
                <option key={person.id} value={person.id}>
                  {prettyName(person.full_name)}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Project type" hint="Prefilled from the linked opportunity. Support hides milestones.">
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
        <Field label="Bank of hours" hint="Prefilled from the linked opportunity.">
          <input
            type="number"
            min={0}
            step="0.25"
            className={inputClass}
            value={bankHours}
            onChange={(event) => setBankHours(event.target.value)}
          />
        </Field>
        <Field label="Notify customer at (h)">
          <input
            type="number"
            min={0}
            step="0.25"
            className={inputClass}
            value={notifyHours}
            onChange={(event) => setNotifyHours(event.target.value)}
          />
        </Field>
      </div>

      <div className="mt-4 space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-grey">Milestones</span>
        {milestones.map((milestone, index) => (
          <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1.5fr_160px_40px]">
            <input
              className={inputClass}
              placeholder="Milestone"
              value={milestone.name}
              onChange={(event) =>
                setMilestones((current) =>
                  current.map((row, i) => (i === index ? { ...row, name: event.target.value } : row)),
                )
              }
            />
            <input
              className={inputClass}
              placeholder="Description"
              value={milestone.description}
              onChange={(event) =>
                setMilestones((current) =>
                  current.map((row, i) => (i === index ? { ...row, description: event.target.value } : row)),
                )
              }
            />
            <input
              type="date"
              className={inputClass}
              value={milestone.due_date}
              onChange={(event) =>
                setMilestones((current) =>
                  current.map((row, i) => (i === index ? { ...row, due_date: event.target.value } : row)),
                )
              }
            />
            <PortalButton
              variant="ghost"
              onClick={() => setMilestones((current) => current.filter((_, i) => i !== index))}
              aria-label="Remove milestone"
            >
              <Trash2 className="h-4 w-4" />
            </PortalButton>
          </div>
        ))}
        <PortalButton
          variant="ghost"
          onClick={() => setMilestones((current) => [...current, { name: '', description: '', due_date: '' }])}
        >
          <Plus className="h-4 w-4" /> Add milestone
        </PortalButton>
      </div>

      <div className="mt-4 space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-grey">Project team</span>
        <p className="text-xs text-grey">
          Seeded from the accepted offer’s line items. Each also copies that line’s billing (rate &amp; type), editable
          on the project team once created. These show on the client’s roster.
        </p>
        {team.map((member, index) => (
          <div key={index} className="grid gap-2 sm:grid-cols-[1.5fr_1fr_40px]">
            <select
              className={inputClass}
              value={member.employee_id ?? ''}
              onChange={(event) =>
                setTeam((current) =>
                  current.map((row, i) => {
                    if (i !== index) return row;
                    const picked = (staff.data ?? []).find((person) => person.id === event.target.value);
                    return picked
                      ? {
                          ...row,
                          employee_id: picked.id,
                          display_name: prettyName(picked.full_name),
                          // Finance (0044): seed the cost rate from the staffer's default when picked.
                          pay_rate: picked.pay_rate ?? row.pay_rate,
                        }
                      : { ...row, employee_id: null };
                  }),
                )
              }
            >
              <option value="">
                {member.display_name.trim() ? `${member.display_name} — select staff…` : 'Select staff…'}
              </option>
              {(staff.data ?? [])
                .filter(
                  (person) =>
                    person.id === member.employee_id ||
                    !team.some((row) => row.employee_id === person.id),
                )
                .map((person) => (
                  <option key={person.id} value={person.id}>
                    {prettyName(person.full_name)}
                    {person.title ? ` — ${person.title}` : ''}
                  </option>
                ))}
            </select>
            <input
              className={inputClass}
              placeholder="Role on project"
              value={member.project_role}
              onChange={(event) =>
                setTeam((current) =>
                  current.map((row, i) => (i === index ? { ...row, project_role: event.target.value } : row)),
                )
              }
            />
            <PortalButton
              variant="ghost"
              onClick={() => setTeam((current) => current.filter((_, i) => i !== index))}
              aria-label="Remove team member"
            >
              <Trash2 className="h-4 w-4" />
            </PortalButton>
          </div>
        ))}
        <PortalButton
          variant="ghost"
          onClick={() =>
            setTeam((current) => [
              ...current,
              {
                display_name: '',
                project_role: 'Team member',
                billing_type: null,
                rate: null,
                overtime_rate: null,
                monthly_hours: null,
                employee_id: null,
                pay_rate: null,
              },
            ])
          }
        >
          <Plus className="h-4 w-4" /> Add team member
        </PortalButton>
      </div>

      {productIds.length > 0 && (
        <div className="mt-4">
          <InfoNote>
            {productIds.length} product{productIds.length === 1 ? '' : 's'} from the linked opportunity will be copied
            onto this project.
          </InfoNote>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <PortalButton disabled={busy} onClick={() => create(true)}>
          Publish to client
        </PortalButton>
        <PortalButton variant="secondary" disabled={busy} onClick={() => create(false)}>
          Save as draft
        </PortalButton>
        {onCancel && (
          <PortalButton variant="ghost" type="button" onClick={onCancel}>
            Cancel
          </PortalButton>
        )}
      </div>
    </PortalCard>
  );
};

// Documents attached to one project (related_project_id). Includes those linked in from the
// won opportunity plus anything uploaded straight here.
const ProjectDocumentsPanel: React.FC<{ account: PortalAccount; project: Project }> = ({ account, project }) => {
  const documents = useAsync(() => adminListDocuments(account.id), [account.id]);
  const [addOpen, setAddOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [docType, setDocType] = React.useState<DocType>('deliverable');
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);

  const rows = (documents.data ?? []).filter((doc) => doc.related_project_id === project.id);

  const upload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() && !file) {
      toast.error('Give the document a name or pick a file.');
      return;
    }
    setBusy(true);
    try {
      await adminUploadDocument({
        account_id: account.id,
        name: name.trim() || file?.name || 'Document',
        doc_type: docType,
        status: 'sent',
        file,
        related_project_id: project.id,
        // Land the file in the linked opportunity's own Drive folder tree (its Delivery/Contracts/…
        // subfolder by doc type) rather than the account root — so project files sit with the deal.
        opportunity_id: project.opportunity_id,
      });
      toast.success('Document added to this project.');
      setName('');
      setDocType('deliverable');
      setFile(null);
      setAddOpen(false);
      await documents.reload();
    } catch (cause) {
      toast.error('Could not upload', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const open = async (filePath: string | null) => {
    if (!filePath) return;
    try {
      window.open(await getDocumentUrl(filePath), '_blank', 'noopener');
    } catch (cause) {
      toast.error('Could not open', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  const remove = async (id: string, label: string) => {
    if (!window.confirm(`Remove "${label}"?`)) return;
    await adminDeleteDocument(id);
    await documents.reload();
  };

  return (
    <>
      {/* The modal lives outside PortalCard so "Add document" still works while the card is
          collapsed (a collapsed card drops its body, and the modal with it). */}
      <PortalModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add document"
        description="Upload a file or record a document tied to this project."
      >
        <form onSubmit={upload} className="space-y-3">
          <Field label="Name">
            <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} />
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
            <input type="file" className={`${inputClass} py-1.5`} onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </Field>
          <div className="flex gap-2 pt-1">
            <PortalButton type="submit" disabled={busy}>
              <Upload className="h-4 w-4" /> {busy ? 'Adding…' : 'Add document'}
            </PortalButton>
            <PortalButton variant="ghost" type="button" onClick={() => setAddOpen(false)}>
              Cancel
            </PortalButton>
          </div>
        </form>
      </PortalModal>

      <PortalCard
        title="Project documents"
        description="Deliverables and contracts tied to this project."
        keepActionWhenCollapsed
        action={
          <PortalButton onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add document
          </PortalButton>
        }
      >
      {rows.length === 0 ? (
        <EmptyState title="No documents on this project yet" />
      ) : (
        <PortalTable head={['Name', 'Type', 'Version', 'Updated', '']}>
          {rows.map((doc) => (
            <Row key={doc.id}>
              <Cell className="font-medium">{doc.name}</Cell>
              <Cell className="text-grey">{DOC_TYPE_LABELS[doc.doc_type]}</Cell>
              <Cell className="text-grey">v{doc.version}</Cell>
              <Cell className="whitespace-nowrap text-grey">{formatDate(doc.updated_at)}</Cell>
              <Cell className="text-right">
                <div className="flex justify-end gap-1">
                  {doc.file_url && (
                    <PortalButton variant="ghost" onClick={() => open(doc.file_url)} aria-label="Download">
                      <Download className="h-4 w-4" />
                    </PortalButton>
                  )}
                  <PortalButton variant="ghost" onClick={() => remove(doc.id, doc.name)} aria-label="Remove">
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
  );
};

const MilestonePanel: React.FC<{ project: Project }> = ({ project }) => {
  const milestones = useAsync(() => adminListMilestones(project.id), [project.id]);
  const [name, setName] = React.useState('');
  const [startDate, setStartDate] = React.useState('');
  const [dueDate, setDueDate] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [dragId, setDragId] = React.useState<string | null>(null);

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await adminUpsertMilestone({
        project_id: project.id,
        name: name.trim(),
        description: '',
        start_date: startDate || null,
        due_date: dueDate || null,
        status: 'not_started',
        percent_complete: 0,
        position: (milestones.data ?? []).length,
      });
      setName('');
      setStartDate('');
      setDueDate('');
      await milestones.reload();
    } catch (cause) {
      toast.error('Could not add', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  // Optimistic: patch the row in place and save in the background — no full reload, so the panel
  // doesn't flash or lose scroll/focus while the client edits. Revert to the server on failure.
  const update = async (milestone: Milestone, patch: Partial<Milestone>) => {
    const next = { ...milestone, ...patch };
    milestones.mutate((prev) => (prev ? prev.map((entry) => (entry.id === milestone.id ? next : entry)) : prev));
    try {
      await adminUpsertMilestone({
        id: next.id,
        project_id: next.project_id,
        name: next.name,
        description: next.description,
        start_date: next.start_date,
        due_date: next.due_date,
        status: next.status,
        percent_complete: next.percent_complete,
        position: next.position,
      });
    } catch (cause) {
      toast.error('Could not update', { description: cause instanceof Error ? cause.message : undefined });
      await milestones.reload();
    }
  };

  // Drag-and-drop reordering. Hovering a row while dragging reorders the list locally (rewriting each
  // milestone's position to its new index); dropping persists the order in one call.
  const reorder = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    milestones.mutate((prev) => {
      if (!prev) return prev;
      const from = prev.findIndex((entry) => entry.id === draggedId);
      const to = prev.findIndex((entry) => entry.id === targetId);
      if (from === -1 || to === -1 || from === to) return prev;
      const nextList = [...prev];
      const [moved] = nextList.splice(from, 1);
      nextList.splice(to, 0, moved);
      return nextList.map((entry, index) => ({ ...entry, position: index }));
    });
  };

  const persistOrder = async () => {
    if (!dragId) return;
    setDragId(null);
    try {
      await adminReorderMilestones((milestones.data ?? []).map((entry) => entry.id));
    } catch (cause) {
      toast.error('Could not save order', { description: cause instanceof Error ? cause.message : undefined });
      await milestones.reload();
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this milestone?')) return;
    await adminDeleteMilestone(id);
    await milestones.reload();
  };

  if (milestones.loading) return <PortalSpinner />;

  return (
    <PortalCard title="Milestones" description="Setting a milestone to “Complete” asks the client to approve it.">
      {/* New milestone at the top; the existing list follows below. */}
      <form onSubmit={add} className="mb-4 flex flex-wrap items-end gap-2">
        <Field label="New milestone" className="min-w-52 flex-1">
          <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Start">
          <input type="date" className={inputClass} value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        </Field>
        <Field label="Due">
          <input type="date" className={inputClass} value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </Field>
        <PortalButton type="submit" disabled={busy}>
          <Plus className="h-4 w-4" /> Add
        </PortalButton>
      </form>

      {(milestones.data ?? []).length === 0 ? (
        <EmptyState title="No milestones yet" />
      ) : (
        <PortalTable head={['', 'Milestone', 'Start', 'Due', 'Status', 'Progress', '']}>
          {(milestones.data ?? []).map((milestone) => (
            <Row
              key={milestone.id}
              className={dragId === milestone.id ? 'opacity-50' : undefined}
              onDragOver={(event) => {
                if (dragId && dragId !== milestone.id) {
                  event.preventDefault();
                  reorder(dragId, milestone.id);
                }
              }}
              onDrop={persistOrder}
              onDragEnd={persistOrder}
            >
              <Cell className="w-8 pr-0">
                <span
                  draggable
                  onDragStart={() => setDragId(milestone.id)}
                  className="flex w-6 cursor-grab touch-none justify-center text-grey active:cursor-grabbing"
                  aria-label="Drag to reorder milestone"
                  title="Drag to reorder"
                >
                  <GripVertical className="h-4 w-4" />
                </span>
              </Cell>
              <Cell>
                <input
                  key={`name-${milestone.id}-${milestone.name}`}
                  className={`${inputClass} py-1 font-medium`}
                  defaultValue={milestone.name}
                  onBlur={(event) => {
                    const next = event.target.value.trim();
                    if (next && next !== milestone.name) update(milestone, { name: next });
                  }}
                />
                <input
                  key={`desc-${milestone.id}-${milestone.description}`}
                  className={`${inputClass} mt-1 py-1 text-xs`}
                  placeholder="Description"
                  defaultValue={milestone.description}
                  onBlur={(event) => {
                    const next = event.target.value;
                    if (next !== milestone.description) update(milestone, { description: next });
                  }}
                />
              </Cell>
              <Cell className="whitespace-nowrap">
                <input
                  key={`start-${milestone.id}-${milestone.start_date ?? ''}`}
                  type="date"
                  className={`${inputClass} py-1 text-xs`}
                  defaultValue={milestone.start_date ?? ''}
                  onBlur={(event) => {
                    const next = event.target.value || null;
                    if (next !== (milestone.start_date ?? null)) update(milestone, { start_date: next });
                  }}
                />
              </Cell>
              <Cell className="whitespace-nowrap">
                <input
                  key={`due-${milestone.id}-${milestone.due_date ?? ''}`}
                  type="date"
                  className={`${inputClass} py-1 text-xs`}
                  defaultValue={milestone.due_date ?? ''}
                  onBlur={(event) => {
                    const next = event.target.value || null;
                    if (next !== (milestone.due_date ?? null)) update(milestone, { due_date: next });
                  }}
                />
              </Cell>
              <Cell>
                <select
                  className={`${inputClass} w-auto py-1 text-xs`}
                  value={milestone.status}
                  disabled={milestone.status === 'approved'}
                  onChange={(event) => update(milestone, { status: event.target.value as Milestone['status'] })}
                >
                  {MILESTONE_STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {MILESTONE_STATUS_LABELS[value]}
                    </option>
                  ))}
                </select>
              </Cell>
              <Cell className="whitespace-nowrap">
                <input
                  type="number"
                  min={0}
                  max={100}
                  className={`${inputClass} w-20 py-1 text-xs`}
                  value={milestone.percent_complete}
                  onChange={(event) => update(milestone, { percent_complete: Number(event.target.value) })}
                />
              </Cell>
              <Cell className="text-right">
                <PortalButton variant="ghost" onClick={() => remove(milestone.id)} aria-label="Delete milestone">
                  <Trash2 className="h-4 w-4" />
                </PortalButton>
              </Cell>
            </Row>
          ))}
        </PortalTable>
      )}
    </PortalCard>
  );
};

// Inline editor for a team member's billing — the fields carried from the offer line (0036). Admin
// only; the client roster never shows these. Mirrors the offer line item's billing fields exactly:
// the meaning of `rate` differs by type (a monthly sum for fixed price, an hourly rate for T&M) and
// `monthly_hours` only applies to fixed price, so the visible fields switch on the billing type.
const TeamBillingCell: React.FC<{
  member: ProjectTeamMember;
  onChange: (patch: Partial<TeamBilling>) => void;
}> = ({ member, onChange }) => {
  const isFixed = member.billing_type === 'fixed_price';

  const numberField = (key: 'rate' | 'overtime_rate' | 'monthly_hours', label: string) => (
    <Field label={label} key={`${key}-${member.id}-${member[key] ?? ''}`}>
      <input
        type="number"
        min={0}
        step="0.01"
        className={`${inputClass} py-1 text-xs`}
        defaultValue={member[key] ?? ''}
        onBlur={(event) => {
          const raw = event.target.value.trim();
          const next = raw === '' ? null : Number(raw);
          if (next !== (member[key] ?? null)) onChange({ [key]: next } as Partial<TeamBilling>);
        }}
      />
    </Field>
  );

  return (
    <div className="grid min-w-[220px] items-start gap-2 sm:grid-cols-2">
      <Field label="Billing">
        <select
          className={`${inputClass} py-1 text-xs`}
          value={member.billing_type ?? ''}
          onChange={(event) => {
            const next = (event.target.value || null) as OfferBillingType | null;
            // `rate` means a monthly sum for fixed price but an hourly rate for T&M, so reset it (and
            // the fixed-only monthly hours) on a type switch — exactly as the offer line item does.
            onChange({ billing_type: next, rate: null, monthly_hours: null });
          }}
        >
          <option value="">No billing</option>
          {(Object.keys(OFFER_BILLING_LABELS) as OfferBillingType[]).map((key) => (
            <option key={key} value={key}>
              {OFFER_BILLING_LABELS[key]}
            </option>
          ))}
        </select>
      </Field>
      {member.billing_type == null ? null : isFixed ? (
        <>
          {numberField('rate', 'Fixed sum / month')}
          {numberField('monthly_hours', 'Hours / month')}
          {numberField('overtime_rate', 'Overtime rate')}
          {/* Effective hourly rate for a fixed-price member: monthly sum spread over the hours —
              derived exactly like the offer line item's. */}
          <div className="text-xs text-grey sm:col-span-2">
            Effective hourly rate:{' '}
            <span className="font-semibold text-violet">
              {member.rate != null && member.monthly_hours != null && member.monthly_hours > 0
                ? `${formatMoney(member.rate / member.monthly_hours)}/h`
                : '—'}
            </span>
          </div>
        </>
      ) : (
        <>
          {numberField('rate', 'Hourly rate')}
          {numberField('overtime_rate', 'Overtime rate')}
        </>
      )}
    </div>
  );
};

const TeamPanel: React.FC<{ project: Project; canEdit?: boolean }> = ({ project, canEdit = true }) => {
  const team = useAsync(() => adminListProjectTeam(project.id), [project.id]);
  const staff = useAsync(() => adminListInternalUsers(), []);
  const [userId, setUserId] = React.useState('');
  const [projectRole, setProjectRole] = React.useState(PROJECT_ROLES[2]);
  const [isPublic, setIsPublic] = React.useState(true);
  const [busy, setBusy] = React.useState(false);

  const updateMember = async (id: string, patch: Partial<TeamBilling & { pay_rate: number | null }>) => {
    try {
      await adminUpdateProjectTeamMember(id, patch);
      await team.reload();
    } catch (cause) {
      toast.error('Could not update', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!userId) return;
    setBusy(true);
    try {
      // Seed the cost rate from the selected staff member's default pay_rate (finance, 0044).
      const selected = (staff.data ?? []).find((person) => person.id === userId);
      await adminAddProjectTeamMember({
        project_id: project.id,
        user_id: userId,
        project_role: projectRole,
        is_public: isPublic,
        pay_rate: selected?.pay_rate ?? null,
      });
      toast.success('Added — they now appear on the client’s roster and feedback dropdown.');
      setUserId('');
      await team.reload();
    } catch (cause) {
      toast.error('Could not add', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const togglePublic = async (id: string, next: boolean) => {
    try {
      await adminSetProjectTeamPublic(id, next);
      await team.reload();
    } catch (cause) {
      toast.error('Could not update', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Remove from this project? Past feedback about them is kept.')) return;
    await adminRemoveProjectTeamMember(id);
    await team.reload();
  };

  const active = (team.data ?? []).filter((member) => member.active);

  return (
    <PortalCard
      title="Project team"
      description="This list drives the client’s Team Feedback “About” dropdown."
    >
      {active.length === 0 ? (
        <EmptyState title="Nobody staffed yet" />
      ) : (
        // Billing is a finance field, hidden from the Implementer role; so are the manage actions.
        <PortalTable
          head={[
            'Name',
            'Role on project',
            ...(canEdit ? ['Billing', 'Pay rate'] : []),
            'Since',
            'Public',
            ...(canEdit ? [''] : []),
          ]}
        >
          {active.map((member) => (
            <Row key={member.id}>
              <Cell className="font-medium">
                {member.user ? prettyName(member.user.full_name) : member.display_name || '—'}
              </Cell>
              <Cell className="text-grey">{member.project_role}</Cell>
              {canEdit && (
                <Cell>
                  <TeamBillingCell member={member} onChange={(patch) => updateMember(member.id, patch)} />
                </Cell>
              )}
              {canEdit && (
                <Cell>
                  {/* Internal cost rate (finance, 0044) — what salary reads. Only meaningful for a
                      member linked to a real employee; text-only roster rows log no hours. */}
                  <Field label={member.user ? 'Cost / h' : 'Cost / h (no employee)'} key={`pay-${member.id}-${member.pay_rate ?? ''}`}>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className={`${inputClass} w-24 py-1 text-xs`}
                      defaultValue={member.pay_rate ?? ''}
                      onBlur={(event) => {
                        const raw = event.target.value.trim();
                        const next = raw === '' ? null : Number(raw);
                        if (next !== (member.pay_rate ?? null)) updateMember(member.id, { pay_rate: next });
                      }}
                    />
                  </Field>
                </Cell>
              )}
              <Cell className="whitespace-nowrap text-grey">{formatDate(member.assigned_at)}</Cell>
              <Cell>
                {canEdit ? (
                  <label className="flex items-center gap-2 text-xs text-grey" title="Show this person to the client">
                    <input
                      type="checkbox"
                      checked={member.is_public ?? true}
                      onChange={(event) => togglePublic(member.id, event.target.checked)}
                      className="h-4 w-4 accent-[color:var(--violet)]"
                    />
                    {(member.is_public ?? true) ? 'Shown' : 'Hidden'}
                  </label>
                ) : (
                  <span className="text-xs text-grey">{(member.is_public ?? true) ? 'Shown' : 'Hidden'}</span>
                )}
              </Cell>
              {canEdit && (
                <Cell className="text-right">
                  <PortalButton variant="ghost" onClick={() => remove(member.id)} aria-label="Remove">
                    <Trash2 className="h-4 w-4" />
                  </PortalButton>
                </Cell>
              )}
            </Row>
          ))}
        </PortalTable>
      )}

      {canEdit && (
      <form onSubmit={add} className="mt-4 flex flex-wrap items-end gap-2">
        <Field label="Team member" className="min-w-48 flex-1">
          <select className={inputClass} value={userId} onChange={(event) => setUserId(event.target.value)}>
            <option value="">Select…</option>
            {(staff.data ?? [])
              .filter((person) => !active.some((member) => member.user_id === person.id))
              .map((person) => (
                <option key={person.id} value={person.id}>
                  {prettyName(person.full_name)}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Role on this project">
          <select className={inputClass} value={projectRole} onChange={(event) => setProjectRole(event.target.value)}>
            {PROJECT_ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </Field>
        <PortalButton type="submit" disabled={busy}>
          <UserPlus className="h-4 w-4" /> Add to project
        </PortalButton>
        <label className="flex w-full items-center gap-2 text-sm text-grey">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(event) => setIsPublic(event.target.checked)}
            className="h-4 w-4 accent-[color:var(--violet)]"
          />
          Public member — show on the client’s roster and allow feedback about them
        </label>
      </form>
      )}
    </PortalCard>
  );
};

// Popup to edit an existing worklog — the counterpart to the Log hours popup, for fixing a logged
// entry's date, milestone, hours or flags after the fact.
const EditTimeEntryModal: React.FC<{
  entry: TimeEntry;
  milestones: { id: string; name: string }[];
  staff: { id: string; full_name: string }[];
  /** Implementers can edit an unapproved entry but never toggle its approval — the field is read-only. */
  canApprove?: boolean;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}> = ({ entry, milestones, staff, canApprove = true, onClose, onSaved }) => {
  const [entryDate, setEntryDate] = React.useState(entry.entry_date);
  const [milestoneId, setMilestoneId] = React.useState(entry.milestone_id ?? '');
  // Client-facing reporter; falls back to the employee when the row predates reporters (0041).
  const [reporterId, setReporterId] = React.useState(entry.reporter_id ?? entry.user_id ?? '');
  const [description, setDescription] = React.useState(entry.description);
  const [hours, setHours] = React.useState(entry.hours != null ? String(entry.hours) : '');
  const [actual, setActual] = React.useState(entry.actual_hours != null ? String(entry.actual_hours) : '');
  const [approved, setApproved] = React.useState(entry.approved);
  const [busy, setBusy] = React.useState(false);

  const save = async () => {
    // Billing hours are optional now (blank = non-billable); validate the range only when present.
    const billing = hours.trim() === '' ? null : Number(hours);
    if (billing !== null && !(billing > 0)) {
      toast.error('Billing hours must be greater than 0.');
      return;
    }
    if (billing === null && actual.trim() === '') {
      toast.error('Enter actual or billing hours.');
      return;
    }
    setBusy(true);
    try {
      await adminUpdateTimeEntry(entry.id, {
        entry_date: entryDate,
        milestone_id: milestoneId || null,
        reporter_id: reporterId || null,
        description: description.trim(),
        hours: billing,
        actual_hours: actual.trim() === '' ? null : Number(actual),
        approved,
      });
      toast.success('Entry updated.');
      await onSaved();
      onClose();
    } catch (cause) {
      toast.error('Could not update', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <PortalModal open onClose={onClose} title="Edit time entry" description="Correct a logged worklog." className="max-w-lg">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Date">
            <input type="date" className={inputClass} value={entryDate} onChange={(event) => setEntryDate(event.target.value)} />
          </Field>
          <Field label="Milestone">
            <select className={inputClass} value={milestoneId} onChange={(event) => setMilestoneId(event.target.value)}>
              <option value="">No milestone</option>
              {milestones.map((milestone) => (
                <option key={milestone.id} value={milestone.id}>
                  {milestone.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Reporter" hint="Who the client sees credited — may differ from the employee who did the work.">
          <select className={inputClass} value={reporterId} onChange={(event) => setReporterId(event.target.value)}>
            {entry.user && !staff.some((person) => person.id === entry.user!.id) && (
              <option value={entry.user.id}>{prettyName(entry.user.full_name)}</option>
            )}
            {staff.map((person) => (
              <option key={person.id} value={person.id}>
                {prettyName(person.full_name)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Description">
          <input className={inputClass} value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Billing h" hint="Blank = non-billable (actual hours only).">
            <input type="number" min={0} max={24} step="0.25" className={inputClass} value={hours} onChange={(event) => setHours(event.target.value)} />
          </Field>
          <Field label="Actual h">
            <input type="number" min={0} max={24} step="0.25" className={inputClass} value={actual} onChange={(event) => setActual(event.target.value)} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-grey">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[color:var(--violet)]"
              checked={approved}
              disabled={!canApprove}
              onChange={(event) => setApproved(event.target.checked)}
            />
            Approved
          </label>
        </div>
        <div className="flex gap-2 pt-1">
          <PortalButton disabled={busy} onClick={save}>
            {busy ? 'Saving…' : 'Save'}
          </PortalButton>
          <PortalButton variant="ghost" type="button" onClick={onClose}>
            Cancel
          </PortalButton>
        </div>
      </div>
    </PortalModal>
  );
};

const TimePanel: React.FC<{ project: Project; canApprove?: boolean; isOwner?: boolean }> = ({
  project,
  canApprove = true,
  isOwner = false,
}) => {
  const entries = useAsync(() => adminListTimeEntries(project.id), [project.id]);
  const milestones = useAsync(() => adminListMilestones(project.id), [project.id]);
  // Staff list, so an entry's client-facing reporter can be reassigned in the edit popup.
  const staff = useAsync(() => adminListInternalUsers(), []);
  // Date-range filter for the list (item 7). Empty bounds mean "no limit".
  const [fromDate, setFromDate] = React.useState('');
  const [toDate, setToDate] = React.useState('');
  const [editing, setEditing] = React.useState<TimeEntry | null>(null);
  // Bulk-approve selection — the account owner only. Holds ids of unapproved entries ticked for approval.
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const milestoneOptions = (milestones.data ?? []).map((milestone) => ({ id: milestone.id, name: milestone.name }));
  const milestoneName = (id: string | null) => (milestones.data ?? []).find((m) => m.id === id)?.name ?? '—';

  const rows = entries.data ?? [];
  // ISO dates compare correctly as strings, so a lexicographic range check is enough.
  const filtered = rows.filter(
    (entry) => (!fromDate || entry.entry_date >= fromDate) && (!toDate || entry.entry_date <= toDate),
  );
  // Client-side column sorting, same idiom as the other list views (SortHeader + useTableSort).
  const { sorted, sort, toggle } = useTableSort(filtered, {
    date: (entry) => entry.entry_date,
    employee: (entry) => entry.user?.full_name ?? null,
    reporter: (entry) => (entry.reporter ?? entry.user)?.full_name ?? null,
    milestone: (entry) => milestoneName(entry.milestone_id),
    description: (entry) => entry.description || null,
    hours: (entry) => entry.hours,
  });
  const total = filtered.reduce((sum, entry) => sum + (entry.hours ?? 0), 0);
  // Client-visible hours = approved ones (0045: approval gates client visibility).
  const shown = filtered.filter((entry) => entry.approved).reduce((sum, entry) => sum + (entry.hours ?? 0), 0);

  // Monthly budget draw-down (bank of hours is a monthly limit). Unlike the client bar — which only
  // counts approved logs — the admin view draws down against *all* of this month's billing hours
  // (approved or not), so the team sees true consumption against the limit before sign-off. Built
  // from every logged entry (`rows`), independent of the date-range filter above; the local YYYY-MM
  // prefix keeps it in the viewer's timezone.
  // The hours budget is a billing field, hidden from the Implementer role (canApprove=false) — the
  // same gate the bank/notify inputs use on the project card.
  const hasBudget = canApprove && (project.bank_hours != null || project.notify_hours != null);
  const monthPrefix = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 7);
  const usedThisMonth = rows
    .filter((entry) => entry.entry_date.startsWith(monthPrefix))
    .reduce((sum, entry) => sum + (entry.hours ?? 0), 0);

  // Only unapproved, currently-visible entries can be ticked for approval.
  const selectableIds = filtered.filter((entry) => !entry.approved).map((entry) => entry.id);
  const selectedIds = selectableIds.filter((id) => selected.has(id));
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  const remove = async (id: string) => {
    if (!window.confirm('Delete this time entry?')) return;
    await adminDeleteTimeEntry(id);
    await entries.reload();
  };

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (selectableIds.every((id) => next.has(id))) selectableIds.forEach((id) => next.delete(id));
      else selectableIds.forEach((id) => next.add(id));
      return next;
    });

  const approveSelected = async () => {
    if (selectedIds.length === 0) return;
    try {
      await adminApproveTimeEntries(selectedIds);
      setSelected(new Set());
      await entries.reload();
      toast.success(`${selectedIds.length} ${selectedIds.length === 1 ? 'entry' : 'entries'} approved`);
    } catch (cause) {
      toast.error('Could not approve entries', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  if (entries.loading) return <PortalSpinner />;

  const sortable = (label: string, key: string) => (
    <SortHeader label={label} sortKey={key} sort={sort} onSort={toggle} />
  );
  const head: React.ReactNode[] = [
    ...(isOwner
      ? [
          <input
            key="__select"
            type="checkbox"
            aria-label="Select all unapproved entries"
            className="h-4 w-4 cursor-pointer accent-violet align-middle"
            checked={allSelected}
            disabled={selectableIds.length === 0}
            onChange={toggleAll}
          />,
        ]
      : []),
    sortable('Date', 'date'),
    sortable('Employee', 'employee'),
    sortable('Reporter', 'reporter'),
    sortable('Milestone', 'milestone'),
    sortable('Description', 'description'),
    sortable('Hours', 'hours'),
    '',
  ];

  return (
    <PortalCard
      title="Hours"
      description={`${total.toFixed(1)} h logged · ${shown.toFixed(1)} h client visible`}
      keepActionWhenCollapsed
      action={
        // Top row: two small calendar icons (from/to date) then the Log hours button. When a date
        // is set, the Clear link drops onto its own row beneath the icons. The range filters across
        // every logged entry, not just the ones on screen.
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5">
            <IconDateButton label="From date" value={fromDate} onChange={setFromDate} />
            <IconDateButton label="To date" value={toDate} onChange={setToDate} />
            <LogHoursButton
              project={{ id: project.id, name: project.name }}
              milestones={milestoneOptions}
              variant="secondary"
              onLogged={entries.reload}
            />
          </div>
          {(fromDate || toDate) && (
            <button
              type="button"
              onClick={() => {
                setFromDate('');
                setToDate('');
              }}
              className="px-1.5 py-0.5 text-xs font-medium text-violet hover:underline"
            >
              Clear dates
            </button>
          )}
        </div>
      }
    >
      {/* Monthly bank-of-hours draw-down — all of this month's billing hours vs the monthly limit.
          Shown above the log list, independent of the date-range filter, whenever a budget is set. */}
      {hasBudget && (
        <HoursBudget
          className="mb-4"
          bank={project.bank_hours}
          notify={project.notify_hours}
          used={usedThisMonth}
          label="This month"
        />
      )}

      {filtered.length === 0 ? (
        <EmptyState title={rows.length === 0 ? 'No hours logged yet' : 'No entries in this date range'} />
      ) : (
        <>
          {/* Bulk approve — account owner only; appears once at least one unapproved entry is ticked. */}
          {isOwner && selectedIds.length > 0 && (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-violet/30 bg-violet/5 px-3 py-2">
              <span className="text-sm font-medium text-violet">{selectedIds.length} selected</span>
              <div className="flex items-center gap-2">
                <PortalButton variant="secondary" onClick={approveSelected}>
                  <Check className="h-4 w-4" /> Approve
                </PortalButton>
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="px-1.5 py-1 text-xs font-medium text-violet hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
          <PortalTable dense head={head}>
            {sorted.map((entry) => {
              const reporter = entry.reporter ?? entry.user;
              // Flag when the client sees a different person than the one who did the work.
              const reassigned = entry.reporter_id != null && entry.reporter_id !== entry.user_id;
              return (
              <Row key={entry.id}>
                {isOwner && (
                  <Cell className="w-8 pr-0">
                    {!entry.approved && (
                      <input
                        type="checkbox"
                        aria-label="Select entry for approval"
                        className="h-4 w-4 cursor-pointer accent-violet align-middle"
                        checked={selected.has(entry.id)}
                        onChange={() => toggleOne(entry.id)}
                      />
                    )}
                  </Cell>
                )}
                <Cell className="whitespace-nowrap text-grey">{formatDate(entry.entry_date)}</Cell>
                <Cell className="whitespace-nowrap">{entry.user ? prettyName(entry.user.full_name) : '—'}</Cell>
                <Cell className="whitespace-nowrap">
                  {reporter ? prettyName(reporter.full_name) : '—'}
                  {reassigned && <StatusTag tone="violet" className="ml-2">Client-facing</StatusTag>}
                </Cell>
                <Cell className="text-grey">{milestoneName(entry.milestone_id)}</Cell>
                <Cell className="text-grey">
                  {entry.description || '—'}
                  {!entry.billable && <StatusTag tone="amber" className="ml-2">Non-billable</StatusTag>}
                  {entry.approved
                    ? <StatusTag tone="green" className="ml-2">Approved</StatusTag>
                    : <StatusTag tone="grey" className="ml-2">Not visible</StatusTag>}
                </Cell>
                <Cell className="whitespace-nowrap font-medium">
                  {entry.hours != null ? entry.hours.toFixed(2) : '—'}
                  {entry.actual_hours != null && entry.actual_hours !== entry.hours && (
                    <span className="font-normal text-grey"> · {entry.actual_hours.toFixed(2)} act</span>
                  )}
                </Cell>
                <Cell className="text-right">
                  {/* Without approve rights (Implementer), only unapproved entries can be edited/deleted. */}
                  {canApprove || !entry.approved ? (
                    <div className="flex justify-end gap-1">
                      <PortalButton variant="ghost" onClick={() => setEditing(entry)} aria-label="Edit entry">
                        <Pencil className="h-4 w-4" />
                      </PortalButton>
                      <PortalButton variant="ghost" onClick={() => remove(entry.id)} aria-label="Delete entry">
                        <Trash2 className="h-4 w-4" />
                      </PortalButton>
                    </div>
                  ) : (
                    <StatusTag tone="grey">Locked</StatusTag>
                  )}
                </Cell>
              </Row>
              );
            })}
          </PortalTable>
        </>
      )}

      {editing && (
        <EditTimeEntryModal
          entry={editing}
          milestones={milestoneOptions}
          staff={(staff.data ?? []).map((person) => ({ id: person.id, full_name: person.full_name }))}
          canApprove={canApprove}
          onClose={() => setEditing(null)}
          onSaved={entries.reload}
        />
      )}
    </PortalCard>
  );
};

export const WorkspaceProject: React.FC<{ account: PortalAccount; canEdit?: boolean }> = ({
  account,
  canEdit = true,
}) => {
  const { user } = usePortalUser();
  // Bulk worklog approval is limited to the account's owner (UX gate; RLS still enforces admin write).
  const isOwner = Boolean(user && account.owner_id && user.id === account.owner_id);
  const projects = useAsync(() => adminListProjects(account.id), [account.id]);
  const opportunities = useAsync(() => adminListOpportunities(account.id), [account.id]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [showCreate, setShowCreate] = React.useState(false);

  const list = projects.data ?? [];
  const project = list.find((entry) => entry.id === selectedId) ?? list[0];

  const patch = async (values: Parameters<typeof adminUpdateProject>[1], message: string) => {
    if (!project) return;
    try {
      await adminUpdateProject(project.id, values);
      toast.success(message);
      await projects.reload();
    } catch (cause) {
      toast.error('Update failed', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  const removeProject = async () => {
    if (!project) return;
    if (
      !window.confirm(
        `Delete "${project.name}"? This permanently removes its milestones, team, logged hours and billing invoices. This can't be undone.`,
      )
    )
      return;
    try {
      await adminDeleteProject(project.id);
      toast.success('Project deleted.');
      setSelectedId(null);
      await projects.reload();
    } catch (cause) {
      toast.error('Could not delete the project', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  if (projects.loading) return <PortalSpinner />;
  if (projects.error) return <ErrorNote>{projects.error}</ErrorNote>;
  // Creating a project is off-limits to the Implementer role — show a plain empty card, not the
  // header bar (which carries the Add-project action). Admins/managers fall through to the normal
  // layout below: with no projects it renders just the "Projects" header bar + "Add project"
  // button (create happens in the modal), mirroring the "no opportunity" pipeline view.
  if (list.length === 0 && !canEdit)
    return (
      <PortalCard title="Project">
        <EmptyState title="No project yet" description="A project appears here once one is created for this account." />
      </PortalCard>
    );

  return (
    <div className="space-y-2">
      {/* Header-only selector bar, one row: Section name · picklist (centered) · New button —
          no body, not collapsible. */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border-color bg-card px-5 py-3 shadow-sm">
        <h2 className="shrink-0 text-[15px] font-semibold text-violet">Projects</h2>
        <div className="flex flex-1 justify-center">
          {list.length > 1 && (
            <select
              className={`${inputClass} w-auto max-w-full py-1.5 text-xs`}
              value={project?.id ?? ''}
              onChange={(event) => setSelectedId(event.target.value)}
              aria-label="Choose project"
            >
              {list.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name} · {entry.published ? 'Live' : 'Draft'}
                </option>
              ))}
            </select>
          )}
        </div>
        {canEdit && (
          <PortalButton className="shrink-0" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> Add project
          </PortalButton>
        )}
      </div>

      <PortalModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create project"
        description="Scope, team and products are pre-filled from the accepted offer and linked opportunity."
        className="max-w-3xl"
      >
        <CreateProjectPanel
          account={account}
          onCreated={async () => {
            setSelectedId(null);
            setShowCreate(false);
            await projects.reload();
          }}
          onCancel={() => setShowCreate(false)}
        />
      </PortalModal>

      {project && (
        <>
      {/* Row 1: Project details (first), then Products and Project documents — three equal columns. */}
      <div className="grid items-start gap-2 lg:grid-cols-3">
      <div className={FIXED_PANEL}>
      <PortalCard
        title={project.name}
        description={project.summary || undefined}
        action={
          <>
            <StatusTag tone={project.published ? 'green' : 'grey'}>
              {project.published ? 'Live for client' : 'Draft'}
            </StatusTag>
            {canEdit && !project.published && (
              <PortalButton onClick={() => patch({ published: true, status: 'active' }, 'Published to the client.')}>
                Publish
              </PortalButton>
            )}
            {canEdit && (
              <PortalButton variant="ghost" onClick={removeProject} aria-label="Delete project" title="Delete project">
                <Trash2 className="h-4 w-4" />
              </PortalButton>
            )}
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Project name" className="sm:col-span-2">
            <input
              key={`name-${project.id}-${project.name}`}
              className={inputClass}
              defaultValue={project.name}
              disabled={!canEdit}
              onBlur={(event) => {
                const next = event.target.value.trim();
                if (next && next !== project.name) patch({ name: next }, 'Project renamed.');
              }}
            />
          </Field>
          <Field label="Project type">
            <select
              className={inputClass}
              value={project.project_type ?? ''}
              disabled={!canEdit}
              onChange={(event) =>
                patch(
                  { project_type: (event.target.value as ProjectType) || null },
                  'Project type updated.',
                )
              }
            >
              <option value="">Not set</option>
              {PROJECT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {PROJECT_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Linked opportunity">
            <select
              className={inputClass}
              value={project.opportunity_id ?? ''}
              disabled={!canEdit}
              onChange={(event) =>
                patch({ opportunity_id: event.target.value || null }, 'Linked opportunity updated.')
              }
            >
              <option value="">None</option>
              {(opportunities.data ?? []).map((opp) => (
                <option key={opp.id} value={opp.id}>
                  {opp.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Health">
            <select
              className={inputClass}
              value={project.health}
              disabled={!canEdit}
              onChange={(event) => patch({ health: event.target.value as Health }, 'Health updated.')}
            >
              {(Object.keys(HEALTH_LABELS) as Health[]).map((health) => (
                <option key={health} value={health}>
                  {HEALTH_LABELS[health]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select
              className={inputClass}
              value={project.status}
              disabled={!canEdit}
              onChange={(event) => patch({ status: event.target.value as Project['status'] }, 'Status updated.')}
            >
              {(['planned', 'active', 'on_hold', 'complete'] as const).map((value) => (
                <option key={value} value={value}>
                  {value.replace('_', ' ')}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Target go-live">
            <input
              type="date"
              className={inputClass}
              value={project.target_date ?? ''}
              disabled={!canEdit}
              onChange={(event) => patch({ target_date: event.target.value || null }, 'Target date updated.')}
            />
          </Field>
          {/* Billing fields (hours budget) are hidden entirely from the Implementer role. */}
          {canEdit && (
            <Field label="Bank of hours">
              <input
                key={`bank-${project.id}-${project.bank_hours ?? ''}`}
                type="number"
                min={0}
                step="0.25"
                className={inputClass}
                defaultValue={project.bank_hours ?? ''}
                onBlur={(event) => {
                  const raw = event.target.value.trim();
                  const next = raw === '' ? null : Number(raw);
                  if (next !== (project.bank_hours ?? null)) patch({ bank_hours: next }, 'Bank of hours updated.');
                }}
              />
            </Field>
          )}
          {canEdit && (
            <Field label="Notify customer at (h)">
              <input
                key={`notify-${project.id}-${project.notify_hours ?? ''}`}
                type="number"
                min={0}
                step="0.25"
                className={inputClass}
                defaultValue={project.notify_hours ?? ''}
                onBlur={(event) => {
                  const raw = event.target.value.trim();
                  const next = raw === '' ? null : Number(raw);
                  if (next !== (project.notify_hours ?? null)) patch({ notify_hours: next }, 'Notify mark updated.');
                }}
              />
            </Field>
          )}
        </div>
        <div className="mt-3 text-xs text-grey">
          Started {formatDate(project.start_date)} ·{' '}
          <StatusTag tone={toneFor(project.health)}>{HEALTH_LABELS[project.health]}</StatusTag>
        </div>
      </PortalCard>
      </div>
        <div className={FIXED_PANEL}>
          <EntityProductsCard
            entity="project"
            id={project.id}
            singleLine
            description="Products delivered in this project."
          />
        </div>
        <div className={FIXED_PANEL}>
          <ProjectDocumentsPanel account={account} project={project} />
        </div>
      </div>

      {/* Row 2: Hours spans the full width (3/3) so more logs fit in one scroll. */}
      <TimePanel project={project} canApprove={canEdit} isOwner={isOwner} />

      {/* Row 3: Project team spans the full width. */}
      <TeamPanel project={project} canEdit={canEdit} />

      {/* Row 4: Milestones span the full width — absent for Support projects, which have none. */}
      {projectUsesMilestones(project.project_type) && <MilestonePanel project={project} />}
        </>
      )}
    </div>
  );
};
