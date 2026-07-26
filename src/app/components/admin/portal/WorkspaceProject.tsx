import React from 'react';
import { toast } from 'sonner';
import { Download, Plus, Trash2, Upload, UserPlus } from 'lucide-react';
import { useAsync } from '@/app/hooks/use-async';
import {
  adminAddProjectTeamMember,
  adminCreateProjectFromOpportunity,
  adminCreateTimeEntry,
  adminDeleteDocument,
  adminDeleteTimeEntry,
  adminListDocuments,
  adminListTimeEntries,
  adminDeleteMilestone,
  adminListInternalUsers,
  adminListMilestones,
  adminListOffers,
  adminListOpportunities,
  adminListProjectTeam,
  adminListProjects,
  adminRemoveProjectTeamMember,
  adminSetProjectTeamPublic,
  adminUpdateProject,
  adminUploadDocument,
  adminUpsertMilestone,
} from '@/app/lib/portal-admin-api';
import { getDocumentUrl } from '@/app/lib/portal-api';
import { formatDate, prettyName } from '@/app/lib/portal-format';
import {
  DOC_TYPES,
  DOC_TYPE_LABELS,
  HEALTH_LABELS,
  MILESTONE_STATUSES,
  MILESTONE_STATUS_LABELS,
  type DocType,
  type Health,
  type Milestone,
  type PortalAccount,
  type Project,
} from '@/app/lib/portal-types';
import {
  Cell,
  EmptyState,
  ErrorNote,
  Field,
  InfoNote,
  PortalButton,
  PortalCard,
  PortalSpinner,
  PortalTable,
  Row,
  StatusTag,
  inputClass,
  toneFor,
} from '@/app/components/portal/PortalUi';
import { cn } from '@/app/components/ui/utils';

const PROJECT_ROLES = ['Delivery Lead', 'Solution Architect', 'Consultant', 'Developer', 'QA', 'Project Manager'];

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
  const [milestones, setMilestones] = React.useState<{ name: string; description: string; due_date: string }[]>([]);
  const [busy, setBusy] = React.useState(false);

  // Default the link to the first opportunity once they load.
  React.useEffect(() => {
    if (!opportunityId && opportunities.data?.[0]) setOpportunityId(opportunities.data[0].id);
  }, [opportunities.data, opportunityId]);

  const acceptedOffer = (offers.data ?? []).find((offer) => offer.status === 'accepted');

  // Pre-fill milestones from the accepted offer's line items (design doc §11.3.3).
  React.useEffect(() => {
    if (acceptedOffer && milestones.length === 0) {
      setMilestones(
        [...acceptedOffer.items]
          .sort((a, b) => a.position - b.position)
          .map((item) => ({ name: item.name, description: item.detail, due_date: '' })),
      );
    }
  }, [acceptedOffer, milestones.length]);

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
        milestones: milestones
          .filter((milestone) => milestone.name.trim().length > 0)
          .map((milestone) => ({ ...milestone, due_date: milestone.due_date || null })),
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
      });
      toast.success('Document added to this project.');
      setName('');
      setFile(null);
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
    <PortalCard title="Project documents" description="Deliverables and contracts tied to this project.">
      <form onSubmit={upload} className="mb-4 grid gap-3 rounded-lg border border-border-color bg-off-white p-4 sm:grid-cols-[2fr_1fr_1.5fr_auto]">
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
        <div className="flex items-end">
          <PortalButton type="submit" disabled={busy}>
            <Upload className="h-4 w-4" /> Add
          </PortalButton>
        </div>
      </form>

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
  );
};

const MilestonePanel: React.FC<{ project: Project }> = ({ project }) => {
  const milestones = useAsync(() => adminListMilestones(project.id), [project.id]);
  const [name, setName] = React.useState('');
  const [dueDate, setDueDate] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await adminUpsertMilestone({
        project_id: project.id,
        name: name.trim(),
        description: '',
        due_date: dueDate || null,
        status: 'not_started',
        percent_complete: 0,
        position: (milestones.data ?? []).length,
      });
      setName('');
      setDueDate('');
      await milestones.reload();
    } catch (cause) {
      toast.error('Could not add', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const update = async (milestone: Milestone, patch: Partial<Milestone>) => {
    try {
      await adminUpsertMilestone({
        id: milestone.id,
        project_id: milestone.project_id,
        name: patch.name ?? milestone.name,
        description: patch.description ?? milestone.description,
        due_date: patch.due_date ?? milestone.due_date,
        status: patch.status ?? milestone.status,
        percent_complete: patch.percent_complete ?? milestone.percent_complete,
        position: milestone.position,
      });
      await milestones.reload();
    } catch (cause) {
      toast.error('Could not update', { description: cause instanceof Error ? cause.message : undefined });
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
      {(milestones.data ?? []).length === 0 ? (
        <EmptyState title="No milestones yet" />
      ) : (
        <PortalTable head={['Milestone', 'Due', 'Status', 'Progress', '']}>
          {(milestones.data ?? []).map((milestone) => (
            <Row key={milestone.id}>
              <Cell>
                <div className="font-medium">{milestone.name}</div>
                {milestone.description && <div className="text-xs text-grey">{milestone.description}</div>}
              </Cell>
              <Cell className="whitespace-nowrap text-grey">{formatDate(milestone.due_date)}</Cell>
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

      <form onSubmit={add} className="mt-4 flex flex-wrap items-end gap-2">
        <Field label="New milestone" className="min-w-52 flex-1">
          <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Due">
          <input type="date" className={inputClass} value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </Field>
        <PortalButton type="submit" disabled={busy}>
          <Plus className="h-4 w-4" /> Add
        </PortalButton>
      </form>
    </PortalCard>
  );
};

const TeamPanel: React.FC<{ project: Project }> = ({ project }) => {
  const team = useAsync(() => adminListProjectTeam(project.id), [project.id]);
  const staff = useAsync(() => adminListInternalUsers(), []);
  const [userId, setUserId] = React.useState('');
  const [projectRole, setProjectRole] = React.useState(PROJECT_ROLES[2]);
  const [isPublic, setIsPublic] = React.useState(true);
  const [busy, setBusy] = React.useState(false);

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!userId) return;
    setBusy(true);
    try {
      await adminAddProjectTeamMember({ project_id: project.id, user_id: userId, project_role: projectRole, is_public: isPublic });
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
        <PortalTable head={['Name', 'Role on project', 'Since', 'Public', '']}>
          {active.map((member) => (
            <Row key={member.id}>
              <Cell className="font-medium">{member.user ? prettyName(member.user.full_name) : '—'}</Cell>
              <Cell className="text-grey">{member.project_role}</Cell>
              <Cell className="whitespace-nowrap text-grey">{formatDate(member.assigned_at)}</Cell>
              <Cell>
                <label className="flex items-center gap-2 text-xs text-grey" title="Show this person to the client">
                  <input
                    type="checkbox"
                    checked={member.is_public ?? true}
                    onChange={(event) => togglePublic(member.id, event.target.checked)}
                    className="h-4 w-4 accent-[color:var(--violet)]"
                  />
                  {(member.is_public ?? true) ? 'Shown' : 'Hidden'}
                </label>
              </Cell>
              <Cell className="text-right">
                <PortalButton variant="ghost" onClick={() => remove(member.id)}>
                  Remove
                </PortalButton>
              </Cell>
            </Row>
          ))}
        </PortalTable>
      )}

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
    </PortalCard>
  );
};

const TimePanel: React.FC<{ project: Project }> = ({ project }) => {
  const entries = useAsync(() => adminListTimeEntries(project.id), [project.id]);
  const milestones = useAsync(() => adminListMilestones(project.id), [project.id]);
  const staff = useAsync(() => adminListInternalUsers(), []);

  const [entryDate, setEntryDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [hours, setHours] = React.useState(1);
  const [userId, setUserId] = React.useState('');
  const [milestoneId, setMilestoneId] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [billable, setBillable] = React.useState(true);
  const [visible, setVisible] = React.useState(true);
  const [busy, setBusy] = React.useState(false);

  const rows = entries.data ?? [];
  const total = rows.reduce((sum, entry) => sum + entry.hours, 0);
  const shown = rows.filter((entry) => entry.visible_to_client).reduce((sum, entry) => sum + entry.hours, 0);

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await adminCreateTimeEntry({
        project_id: project.id,
        milestone_id: milestoneId || null,
        user_id: userId || null,
        entry_date: entryDate,
        hours: Number(hours),
        description: description.trim(),
        billable,
        visible_to_client: visible,
      });
      setDescription('');
      await entries.reload();
    } catch (cause) {
      toast.error('Could not log hours', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this time entry?')) return;
    await adminDeleteTimeEntry(id);
    await entries.reload();
  };

  if (entries.loading) return <PortalSpinner />;

  return (
    <PortalCard
      title="Hours"
      description={`${total.toFixed(1)} h logged · ${shown.toFixed(1)} h visible to the client`}
    >
      <form onSubmit={add} className="mb-4 grid gap-3 rounded-lg border border-border-color bg-off-white p-4 sm:grid-cols-6">
        <Field label="Date">
          <input type="date" className={inputClass} value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
        </Field>
        <Field label="Hours">
          <input
            type="number"
            min={0.25}
            max={24}
            step="0.25"
            className={inputClass}
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
          />
        </Field>
        <Field label="Who">
          <select className={inputClass} value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">Unattributed</option>
            {(staff.data ?? []).map((person) => (
              <option key={person.id} value={person.id}>
                {prettyName(person.full_name)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Milestone">
          <select className={inputClass} value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)}>
            <option value="">Unassigned</option>
            {(milestones.data ?? []).map((milestone) => (
              <option key={milestone.id} value={milestone.id}>
                {milestone.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Description" className="sm:col-span-2">
          <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="flex flex-wrap items-center gap-4 sm:col-span-6">
          <label className="flex items-center gap-2 text-sm text-grey">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[color:var(--violet)]"
              checked={billable}
              onChange={(e) => setBillable(e.target.checked)}
            />
            Billable
          </label>
          <label className="flex items-center gap-2 text-sm text-grey">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[color:var(--violet)]"
              checked={visible}
              onChange={(e) => setVisible(e.target.checked)}
            />
            Visible to client
          </label>
          <PortalButton type="submit" disabled={busy} className="ml-auto">
            <Plus className="h-4 w-4" /> Log hours
          </PortalButton>
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState title="No hours logged yet" />
      ) : (
        <PortalTable head={['Date', 'Who', 'Milestone', 'Description', 'Hours', '']}>
          {rows.slice(0, 60).map((entry) => (
            <Row key={entry.id}>
              <Cell className="whitespace-nowrap text-grey">{formatDate(entry.entry_date)}</Cell>
              <Cell className="whitespace-nowrap">{entry.user ? prettyName(entry.user.full_name) : '—'}</Cell>
              <Cell className="text-grey">
                {(milestones.data ?? []).find((m) => m.id === entry.milestone_id)?.name ?? '—'}
              </Cell>
              <Cell className="text-grey">
                {entry.description || '—'}
                {!entry.visible_to_client && <StatusTag tone="grey" className="ml-2">Internal</StatusTag>}
                {!entry.billable && <StatusTag tone="amber" className="ml-2">Non-billable</StatusTag>}
              </Cell>
              <Cell className="whitespace-nowrap font-medium">{entry.hours.toFixed(2)}</Cell>
              <Cell className="text-right">
                <PortalButton variant="ghost" onClick={() => remove(entry.id)} aria-label="Delete entry">
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

export const WorkspaceProject: React.FC<{ account: PortalAccount }> = ({ account }) => {
  const projects = useAsync(() => adminListProjects(account.id), [account.id]);
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

  if (projects.loading) return <PortalSpinner />;
  if (projects.error) return <ErrorNote>{projects.error}</ErrorNote>;
  if (list.length === 0) return <CreateProjectPanel account={account} onCreated={projects.reload} />;

  return (
    <div className="space-y-5">
      <PortalCard
        title="Projects"
        description="An account can run several projects; winning an opportunity adds one automatically."
        action={
          <PortalButton onClick={() => setShowCreate((open) => !open)}>
            <Plus className="h-4 w-4" /> Add project
          </PortalButton>
        }
      >
        {list.length === 1 ? (
          <p className="text-sm text-grey">
            One project — <span className="font-medium text-foreground">{list[0].name}</span>.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {list.map((entry) => (
              <button
                key={entry.id}
                onClick={() => setSelectedId(entry.id)}
                className={cn(
                  'rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                  entry.id === project?.id
                    ? 'border-violet bg-portal-tint text-violet'
                    : 'border-border-color hover:border-violet/50',
                )}
              >
                <div className="font-medium">{entry.name}</div>
                <div className="mt-0.5">
                  <StatusTag tone={entry.published ? 'green' : 'grey'}>
                    {entry.published ? 'Live' : 'Draft'}
                  </StatusTag>
                </div>
              </button>
            ))}
          </div>
        )}
      </PortalCard>

      {showCreate && (
        <CreateProjectPanel
          account={account}
          onCreated={async () => {
            setSelectedId(null);
            setShowCreate(false);
            await projects.reload();
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {project && (
        <>
      <PortalCard
        title={project.name}
        description={project.summary || undefined}
        action={
          <>
            <StatusTag tone={project.published ? 'green' : 'grey'}>
              {project.published ? 'Live for client' : 'Draft'}
            </StatusTag>
            {!project.published && (
              <PortalButton onClick={() => patch({ published: true, status: 'active' }, 'Published to the client.')}>
                Publish
              </PortalButton>
            )}
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Health">
            <select
              className={inputClass}
              value={project.health}
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
              onChange={(event) => patch({ target_date: event.target.value || null }, 'Target date updated.')}
            />
          </Field>
        </div>
        <div className="mt-3 text-xs text-grey">
          Started {formatDate(project.start_date)} ·{' '}
          <StatusTag tone={toneFor(project.health)}>{HEALTH_LABELS[project.health]}</StatusTag>
        </div>
      </PortalCard>

      <MilestonePanel project={project} />
      <TeamPanel project={project} />
      <TimePanel project={project} />
      <ProjectDocumentsPanel account={account} project={project} />
        </>
      )}
    </div>
  );
};
