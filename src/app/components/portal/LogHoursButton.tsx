import React from 'react';
import { toast } from 'sonner';
import { Clock, Plus, Trash2 } from 'lucide-react';
import { usePortalUser } from '@/app/hooks/use-portal-user';
import { listProjectsForUser, logHours, type ProjectForUser } from '@/app/lib/portal-api';
import { adminListInternalUsers, adminListProjectTeam } from '@/app/lib/portal-admin-api';
import { prettyName } from '@/app/lib/portal-format';
import type { PortalUser, ProjectTeamMember } from '@/app/lib/portal-types';
import { Field, PortalButton, PortalModal, inputClass } from '@/app/components/portal/PortalUi';

// One worklog line in the popup. `actualTouched` tracks whether the user overrode the auto-filled
// actual hours (which otherwise mirror the billing hours).
interface LogRow {
  description: string;
  billing: string;
  actual: string;
  actualTouched: boolean;
  approved: boolean;
}

const emptyRow = (): LogRow => ({ description: '', billing: '', actual: '', actualTouched: false, approved: false });

/**
 * Reusable "Log hours" widget: a button that opens a popup to record one or more worklogs. Drop it on
 * any page. Pass `project` to lock it to that project (e.g. on a project page); otherwise the picker
 * lists the projects the chosen employee is staffed on.
 *
 * Employee defaults to the current user. Admins can log for anyone and mark a log approved; everyone
 * else can only log for themselves (the RPC enforces this too — the UI just mirrors it).
 */
export const LogHoursButton: React.FC<{
  project?: { id: string; name: string };
  /** Milestones on the locked project — when present, the popup offers a milestone to tag the log. */
  milestones?: { id: string; name: string }[];
  onLogged?: () => void | Promise<void>;
  label?: string;
  variant?: React.ComponentProps<typeof PortalButton>['variant'];
  className?: string;
}> = ({ project, milestones, onLogged, label = 'Log hours', variant, className }) => {
  const { user, isAdmin } = usePortalUser();

  const [open, setOpen] = React.useState(false);
  const [employeeId, setEmployeeId] = React.useState('');
  // Client-facing reporter — who the client sees credited. Defaults to (and follows) the employee
  // until an admin picks someone else, so ordinary logs are credited to the person who did them.
  const [reporterId, setReporterId] = React.useState('');
  const [reporterTouched, setReporterTouched] = React.useState(false);
  const [projectId, setProjectId] = React.useState(project?.id ?? '');
  const [milestoneId, setMilestoneId] = React.useState('');
  const [entryDate, setEntryDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = React.useState<LogRow[]>([emptyRow()]);
  const [busy, setBusy] = React.useState(false);

  const [staff, setStaff] = React.useState<PortalUser[]>([]);
  // When the popup is locked to a project, the Employee/Reporter pickers come from that project's
  // team (Reporter is limited to public members) rather than the whole internal directory.
  const [projectTeam, setProjectTeam] = React.useState<ProjectTeamMember[]>([]);
  const [projects, setProjects] = React.useState<ProjectForUser[]>([]);

  // A milestone can only be tagged when the log is locked to a project (so the list is unambiguous).
  const showMilestones = Boolean(project) && (milestones?.length ?? 0) > 0;

  // Reset the form each time the popup opens; default the employee to the current user.
  React.useEffect(() => {
    if (!open) return;
    setEmployeeId(user?.id ?? '');
    setReporterId(user?.id ?? '');
    setReporterTouched(false);
    setProjectId(project?.id ?? '');
    setMilestoneId('');
    setEntryDate(new Date().toISOString().slice(0, 10));
    setRows([emptyRow()]);
  }, [open, user?.id, project?.id]);

  // Admins can pick the employee — load the internal-user list once the popup is open. Only needed
  // as the fallback when the log isn't locked to a project.
  React.useEffect(() => {
    if (!open || !isAdmin || project) return;
    let cancelled = false;
    adminListInternalUsers()
      .then((rowsData) => !cancelled && setStaff(rowsData))
      .catch(() => !cancelled && setStaff([]));
    return () => {
      cancelled = true;
    };
  }, [open, isAdmin, project]);

  // Locked to a project: load its team so Employee lists the project's members and Reporter lists
  // only its public members.
  React.useEffect(() => {
    if (!open || !isAdmin || !project) return;
    let cancelled = false;
    adminListProjectTeam(project.id)
      .then((rowsData) => !cancelled && setProjectTeam(rowsData))
      .catch(() => !cancelled && setProjectTeam([]));
    return () => {
      cancelled = true;
    };
  }, [open, isAdmin, project]);

  // Employee options: the project's members (linked to a real user); Reporter options: only the
  // public ones. Without a locked project, both fall back to the full internal directory.
  const employeeOptions = React.useMemo(
    () =>
      project
        ? projectTeam.filter((member) => member.user).map((member) => ({ id: member.user!.id, full_name: member.user!.full_name }))
        : staff.map((person) => ({ id: person.id, full_name: person.full_name })),
    [project, projectTeam, staff],
  );
  const reporterOptions = React.useMemo(
    () =>
      project
        ? projectTeam
            .filter((member) => member.user && (member.is_public ?? true))
            .map((member) => ({ id: member.user!.id, full_name: member.user!.full_name }))
        : staff.map((person) => ({ id: person.id, full_name: person.full_name })),
    [project, projectTeam, staff],
  );

  // Without a locked project, offer the projects the chosen employee is staffed on.
  React.useEffect(() => {
    if (!open || project || !employeeId) {
      if (!project) setProjects([]);
      return;
    }
    let cancelled = false;
    listProjectsForUser(employeeId)
      .then((rowsData) => {
        if (cancelled) return;
        setProjects(rowsData);
        // Keep the current pick if still valid, else default to the first project.
        setProjectId((current) =>
          rowsData.some((entry) => entry.id === current) ? current : (rowsData[0]?.id ?? ''),
        );
      })
      .catch(() => !cancelled && setProjects([]));
    return () => {
      cancelled = true;
    };
  }, [open, project, employeeId]);

  const updateRow = (index: number, patch: Partial<LogRow>) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const onBillingChange = (index: number, value: string) =>
    setRows((current) =>
      current.map((row, i) =>
        i === index ? { ...row, billing: value, actual: row.actualTouched ? row.actual : value } : row,
      ),
    );

  const submit = async () => {
    if (!projectId) {
      toast.error('Pick a project.');
      return;
    }
    const valid = rows.filter((row) => Number(row.billing) > 0);
    if (valid.length === 0) {
      toast.error('Add at least one log with billing hours.');
      return;
    }
    setBusy(true);
    try {
      for (const row of valid) {
        await logHours({
          projectId,
          userId: isAdmin ? employeeId || null : null,
          entryDate,
          description: row.description.trim(),
          billingHours: Number(row.billing),
          actualHours: row.actual.trim() === '' ? null : Number(row.actual),
          approved: isAdmin ? row.approved : false,
          milestoneId: showMilestones ? milestoneId || null : null,
          // Only send a reporter when an admin credited the log to someone other than the employee;
          // otherwise the server defaults it to the employee.
          reporterId: isAdmin && reporterId && reporterId !== employeeId ? reporterId : null,
        });
      }
      toast.success(valid.length === 1 ? 'Hours logged.' : `${valid.length} logs added.`);
      setOpen(false);
      await onLogged?.();
    } catch (cause) {
      toast.error('Could not log hours', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PortalButton type="button" variant={variant} className={className} onClick={() => setOpen(true)}>
        <Clock className="h-4 w-4" /> {label}
      </PortalButton>

      <PortalModal
        open={open}
        onClose={() => setOpen(false)}
        title="Log hours"
        description="Record one or more worklogs. Actual hours default to the billing hours."
        className="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Employee" hint={isAdmin ? 'Who actually did the work (internal only).' : undefined}>
              {isAdmin ? (
                <select
                  className={inputClass}
                  value={employeeId}
                  onChange={(event) => {
                    const next = event.target.value;
                    setEmployeeId(next);
                    // The reporter follows the employee until an admin overrides it.
                    if (!reporterTouched) setReporterId(next);
                  }}
                >
                  {user && !employeeOptions.some((person) => person.id === user.id) && (
                    <option value={user.id}>{prettyName(user.full_name)}</option>
                  )}
                  {employeeOptions.map((person) => (
                    <option key={person.id} value={person.id}>
                      {prettyName(person.full_name)}
                    </option>
                  ))}
                </select>
              ) : (
                <input className={inputClass} value={user ? prettyName(user.full_name) : ''} disabled readOnly />
              )}
            </Field>
            {isAdmin && (
              <Field label="Reporter" hint="Who the client sees — defaults to the employee.">
                <select
                  className={inputClass}
                  value={reporterId}
                  onChange={(event) => {
                    setReporterId(event.target.value);
                    setReporterTouched(true);
                  }}
                >
                  {user && !reporterOptions.some((person) => person.id === user.id) && (
                    <option value={user.id}>{prettyName(user.full_name)}</option>
                  )}
                  {reporterOptions.map((person) => (
                    <option key={person.id} value={person.id}>
                      {prettyName(person.full_name)}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Project">
              {project ? (
                <input className={inputClass} value={project.name} disabled readOnly />
              ) : (
                <select className={inputClass} value={projectId} onChange={(event) => setProjectId(event.target.value)}>
                  <option value="">Select…</option>
                  {projects.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name} · {entry.account_name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Date">
              <input
                type="date"
                className={inputClass}
                value={entryDate}
                onChange={(event) => setEntryDate(event.target.value)}
              />
            </Field>
            {showMilestones && (
              <Field label="Milestone">
                <select
                  className={inputClass}
                  value={milestoneId}
                  onChange={(event) => setMilestoneId(event.target.value)}
                >
                  <option value="">No milestone</option>
                  {milestones?.map((milestone) => (
                    <option key={milestone.id} value={milestone.id}>
                      {milestone.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-grey">Logs</div>
            {rows.map((row, index) => (
              <div
                key={index}
                className={`grid items-end gap-2 ${isAdmin ? 'sm:grid-cols-[1fr_110px_110px_auto_40px]' : 'sm:grid-cols-[1fr_110px_110px_40px]'}`}
              >
                <Field label={index === 0 ? 'Description' : ''}>
                  <input
                    className={inputClass}
                    placeholder="What did you work on?"
                    value={row.description}
                    onChange={(event) => updateRow(index, { description: event.target.value })}
                  />
                </Field>
                <Field label={index === 0 ? 'Billing h' : ''}>
                  <input
                    type="number"
                    min={0}
                    max={24}
                    step="0.25"
                    className={inputClass}
                    value={row.billing}
                    onChange={(event) => onBillingChange(index, event.target.value)}
                  />
                </Field>
                <Field label={index === 0 ? 'Actual h' : ''}>
                  <input
                    type="number"
                    min={0}
                    max={24}
                    step="0.25"
                    className={inputClass}
                    value={row.actual}
                    onChange={(event) => updateRow(index, { actual: event.target.value, actualTouched: true })}
                  />
                </Field>
                {isAdmin && (
                  <label className="flex h-9 items-center gap-1.5 text-xs text-grey" title="Mark as approved">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[color:var(--violet)]"
                      checked={row.approved}
                      onChange={(event) => updateRow(index, { approved: event.target.checked })}
                    />
                    Approved
                  </label>
                )}
                <PortalButton
                  variant="ghost"
                  onClick={() => setRows((current) => (current.length === 1 ? [emptyRow()] : current.filter((_, i) => i !== index)))}
                  aria-label="Remove log"
                >
                  <Trash2 className="h-4 w-4" />
                </PortalButton>
              </div>
            ))}
            <PortalButton variant="ghost" onClick={() => setRows((current) => [...current, emptyRow()])}>
              <Plus className="h-4 w-4" /> Add another log
            </PortalButton>
          </div>

          <div className="flex gap-2 pt-1">
            <PortalButton disabled={busy} onClick={submit}>
              {busy ? 'Saving…' : 'Save logs'}
            </PortalButton>
            <PortalButton variant="ghost" type="button" onClick={() => setOpen(false)}>
              Cancel
            </PortalButton>
          </div>
        </div>
      </PortalModal>
    </>
  );
};
