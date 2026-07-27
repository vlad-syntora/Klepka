import React from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { UserPlus } from 'lucide-react';
import { useAsync } from '@/app/hooks/use-async';
import {
  adminCreateUser,
  adminDeleteUser,
  adminListAccounts,
  adminListUsers,
  adminUpdateUser,
  portalInviteUser,
} from '@/app/lib/portal-admin-api';
import { notifyInviteResult } from '@/app/lib/invite-feedback';
import { usePortalUser } from '@/app/hooks/use-portal-user';
import { formatRelative, initialsOf, prettyName } from '@/app/lib/portal-format';
import {
  INTERNAL_ROLES,
  ROLE_LABELS,
  USER_STATUS_LABELS,
  canEditAccounts,
  isInternalRole,
  type PortalRole,
  type PortalUser,
} from '@/app/lib/portal-types';
import { UserStatusControl } from '@/app/components/admin/portal/UserStatusControl';
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
} from '@/app/components/portal/PortalUi';
import { cn } from '@/app/components/ui/utils';

export const AdminPortalTeam: React.FC = () => {
  const { user } = usePortalUser();
  // Implementers can view the team directory but not manage it (RLS blocks the writes anyway).
  const canManage = user ? canEditAccounts(user.role) : true;
  const users = useAsync(() => adminListUsers(), []);
  const accounts = useAsync(() => adminListAccounts(), []);
  const [tab, setTab] = React.useState<'klepka' | 'customers'>('klepka');
  const [showAdd, setShowAdd] = React.useState(false);
  // null → the form creates a new member; a user id → it edits that member in place.
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [fullName, setFullName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [calendly, setCalendly] = React.useState('');
  const [photo, setPhoto] = React.useState('');
  const [role, setRole] = React.useState<PortalRole>('sales_rep');
  const [busy, setBusy] = React.useState(false);

  const resetForm = () => {
    setEditingId(null);
    setFullName('');
    setEmail('');
    setTitle('');
    setCalendly('');
    setPhoto('');
    setRole('sales_rep');
    setShowAdd(false);
  };

  const startEdit = (user: PortalUser) => {
    setEditingId(user.id);
    setFullName(user.full_name);
    setEmail(user.email);
    setTitle(user.title ?? '');
    setCalendly(user.calendly_url ?? '');
    setPhoto(user.photo_url ?? '');
    setRole(user.role);
    setShowAdd(true);
  };

  // Create mode: Save → profile as Inactive (no access yet); Send invite → also provisions their
  // sign-in and emails the invitation. Edit mode: persists the field changes to the existing row.
  const save = async (sendInvite: boolean) => {
    if (!fullName.trim() || !email.trim()) {
      toast.error('Name and email are required.');
      return;
    }
    setBusy(true);
    try {
      if (editingId) {
        await adminUpdateUser(editingId, {
          email: email.trim().toLowerCase(),
          full_name: fullName.trim(),
          role,
          title: title.trim() || null,
          calendly_url: calendly.trim() || null,
          photo_url: photo.trim() || null,
        });
        toast.success('Changes saved.');
      } else {
        const created = await adminCreateUser({
          email: email.trim(),
          full_name: fullName.trim(),
          role,
          account_id: null,
          module_access: [],
          title: title.trim() || null,
          calendly_url: calendly.trim() || null,
          photo_url: photo.trim() || null,
        });
        if (sendInvite) {
          notifyInviteResult(await portalInviteUser(created.id), created.email);
        } else {
          toast.success('Saved as Inactive — invite them any time from the status column.');
        }
      }
      resetForm();
      await users.reload();
    } catch (cause) {
      toast.error('Could not save', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const changeRole = async (user: PortalUser, next: PortalRole) => {
    try {
      await adminUpdateUser(user.id, { role: next });
      await users.reload();
    } catch (cause) {
      toast.error('Could not update', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  const remove = async (user: PortalUser) => {
    if (!window.confirm(`Remove ${prettyName(user.full_name)}? Feedback they received stays intact.`)) return;
    try {
      await adminDeleteUser(user.id);
      await users.reload();
    } catch (cause) {
      toast.error('Could not remove', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  if (users.loading) return <PortalSpinner label="Loading team…" />;
  if (users.error) return <ErrorNote>{users.error}</ErrorNote>;

  const all = users.data ?? [];
  const internal = all.filter((user) => isInternalRole(user.role));
  const customers = all.filter((user) => !isInternalRole(user.role));
  const accountName = (id: string | null) => accounts.data?.find((account) => account.id === id)?.name ?? '—';

  return (
    <div className="space-y-5">
      <div className="flex gap-1 border-b border-border-color">
        {(['klepka', 'customers'] as const).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'border-b-2 px-3 py-2.5 text-sm transition-colors',
              tab === key ? 'border-violet font-medium text-violet' : 'border-transparent text-grey hover:text-foreground',
            )}
          >
            {key === 'klepka' ? `Klepka team (${internal.length})` : `Customer users (${customers.length})`}
          </button>
        ))}
      </div>

      {tab === 'klepka' ? (
        <PortalCard
          title="Klepka team"
          description="Internal roles set default permissions across accounts."
          action={
            canManage ? (
              <PortalButton onClick={() => (showAdd ? resetForm() : setShowAdd(true))}>
                <UserPlus className="h-4 w-4" /> Add team member
              </PortalButton>
            ) : undefined
          }
        >
          {canManage && showAdd && (
            <form onSubmit={(event) => event.preventDefault()} className="mb-4 grid gap-3 rounded-lg border border-border-color bg-off-white p-4 sm:grid-cols-6">
              <Field label="Full name">
                <input className={inputClass} value={fullName} onChange={(event) => setFullName(event.target.value)} required />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  className={inputClass}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </Field>
              <Field label="Job title">
                <input className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} />
              </Field>
              <Field label="Calendly link" className="sm:col-span-2" hint="Personal booking URL — optional.">
                <input
                  type="url"
                  className={inputClass}
                  value={calendly}
                  onChange={(event) => setCalendly(event.target.value)}
                  placeholder="https://calendly.com/name"
                />
              </Field>
              <Field label="Internal role">
                <select className={inputClass} value={role} onChange={(event) => setRole(event.target.value as PortalRole)}>
                  {INTERNAL_ROLES.map((value) => (
                    <option key={value} value={value}>
                      {ROLE_LABELS[value]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Photo (URL)" className="sm:col-span-2" hint="Headshot shown to clients in “Your Klepka team”.">
                <div className="flex items-center gap-2">
                  {photo.trim() ? (
                    <img src={photo} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-500">
                      {initialsOf(fullName || '—')}
                    </span>
                  )}
                  <input
                    type="url"
                    className={inputClass}
                    value={photo}
                    onChange={(event) => setPhoto(event.target.value)}
                    placeholder="https://…/photo.jpg"
                  />
                </div>
              </Field>
              <div className="flex flex-wrap items-end gap-2 sm:col-span-6">
                <PortalButton type="button" variant="secondary" disabled={busy} onClick={() => save(false)}>
                  {busy ? 'Saving…' : editingId ? 'Save changes' : 'Save'}
                </PortalButton>
                {!editingId && (
                  <PortalButton type="button" disabled={busy} onClick={() => save(true)}>
                    <UserPlus className="h-4 w-4" /> {busy ? 'Working…' : 'Send invite'}
                  </PortalButton>
                )}
                <PortalButton variant="ghost" type="button" onClick={resetForm}>
                  Cancel
                </PortalButton>
              </div>
            </form>
          )}

          {internal.length === 0 ? (
            <EmptyState title="No internal users yet" />
          ) : (
            <PortalTable
              head={
                canManage
                  ? ['Name', 'Email', 'Role', 'Calendly', 'Photo', 'Status', 'Last login', '']
                  : ['Name', 'Email', 'Role', 'Calendly', 'Photo', 'Status', 'Last login']
              }
            >
              {internal.map((user) => (
                <Row key={user.id}>
                  <Cell>
                    <div className="font-medium">{prettyName(user.full_name)}</div>
                    {user.title && <div className="text-xs text-grey">{user.title}</div>}
                  </Cell>
                  <Cell className="text-grey">{user.email}</Cell>
                  <Cell>
                    {canManage ? (
                      <select
                        className={`${inputClass} w-auto py-1 text-xs`}
                        value={user.role}
                        onChange={(event) => changeRole(user, event.target.value as PortalRole)}
                      >
                        {INTERNAL_ROLES.map((value) => (
                          <option key={value} value={value}>
                            {ROLE_LABELS[value]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-grey">{ROLE_LABELS[user.role]}</span>
                    )}
                  </Cell>
                  <Cell>
                    {canManage ? (
                      <CalendlyCell user={user} onSaved={() => users.reload()} />
                    ) : user.calendly_url ? (
                      <a href={user.calendly_url} target="_blank" rel="noreferrer" className="text-violet hover:underline">
                        Link
                      </a>
                    ) : (
                      <span className="text-grey">—</span>
                    )}
                  </Cell>
                  <Cell>
                    {canManage ? (
                      <PhotoCell user={user} onSaved={() => users.reload()} />
                    ) : user.photo_url ? (
                      <img src={user.photo_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-500">
                        {initialsOf(user.full_name)}
                      </span>
                    )}
                  </Cell>
                  <Cell>
                    {canManage ? (
                      <UserStatusControl user={user} onChanged={() => users.reload()} />
                    ) : (
                      <span className="text-grey">{USER_STATUS_LABELS[user.status]}</span>
                    )}
                  </Cell>
                  <Cell className="whitespace-nowrap text-grey">{formatRelative(user.last_login_at)}</Cell>
                  {canManage && (
                    <Cell className="text-right">
                      <div className="flex justify-end gap-1">
                        <PortalButton variant="ghost" onClick={() => startEdit(user)}>
                          Edit
                        </PortalButton>
                        <PortalButton variant="ghost" onClick={() => remove(user)}>
                          Remove
                        </PortalButton>
                      </div>
                    </Cell>
                  )}
                </Row>
              ))}
            </PortalTable>
          )}

          <div className="mt-4">
            {canManage ? (
              <InfoNote>
                Adding someone here creates their profile as <strong>Inactive</strong> — no access yet. Set their status
                to <strong> Invited</strong> to create their sign-in and email them an invitation; it becomes Active on
                their first login. <strong>Inactive</strong> revokes portal access. Staff them onto a project from an
                account’s Project tab.
              </InfoNote>
            ) : (
              <InfoNote>Your role can view the team directory but not add, edit or remove members.</InfoNote>
            )}
          </div>
        </PortalCard>
      ) : (
        <PortalCard title="Customer users" description="Every client-side login across all accounts.">
          {customers.length === 0 ? (
            <EmptyState title="No customer users yet" />
          ) : (
            <PortalTable head={['Name', 'Account', 'Role', 'Status', 'Last login']}>
              {customers.map((user) => (
                <Row key={user.id}>
                  <Cell>
                    <div className="font-medium">{prettyName(user.full_name)}</div>
                    <div className="text-xs text-grey">{user.email}</div>
                  </Cell>
                  <Cell>
                    {user.account_id ? (
                      <Link to={`/admin/portal/accounts/${user.account_id}`} className="text-violet hover:underline">
                        {accountName(user.account_id)}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </Cell>
                  <Cell className="whitespace-nowrap text-grey">{ROLE_LABELS[user.role]}</Cell>
                  <Cell>
                    {canManage ? (
                      <UserStatusControl user={user} onChanged={() => users.reload()} />
                    ) : (
                      <span className="text-grey">{USER_STATUS_LABELS[user.status]}</span>
                    )}
                  </Cell>
                  <Cell className="whitespace-nowrap text-grey">{formatRelative(user.last_login_at)}</Cell>
                </Row>
              ))}
            </PortalTable>
          )}
        </PortalCard>
      )}
    </div>
  );
};

// Inline Calendly editor: saves on blur when changed, and flags anyone still missing a link.
const CalendlyCell: React.FC<{ user: PortalUser; onSaved: () => void }> = ({ user, onSaved }) => {
  const [value, setValue] = React.useState(user.calendly_url ?? '');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => setValue(user.calendly_url ?? ''), [user.calendly_url]);

  const save = async () => {
    const next = value.trim();
    if (next === (user.calendly_url ?? '')) return;
    setSaving(true);
    try {
      await adminUpdateUser(user.id, { calendly_url: next || null });
      onSaved();
    } catch (cause) {
      toast.error('Could not save the link', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="url"
        className={`${inputClass} w-48 py-1 text-xs`}
        value={value}
        disabled={saving}
        placeholder="https://calendly.com/…"
        onChange={(event) => setValue(event.target.value)}
        onBlur={save}
      />
      {!user.calendly_url && <StatusTag tone="amber">Missing</StatusTag>}
    </div>
  );
};

// Inline headshot-URL editor with a live avatar preview; shown in the client's "Your Klepka team".
const PhotoCell: React.FC<{ user: PortalUser; onSaved: () => void }> = ({ user, onSaved }) => {
  const [value, setValue] = React.useState(user.photo_url ?? '');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => setValue(user.photo_url ?? ''), [user.photo_url]);

  const save = async () => {
    const next = value.trim();
    if (next === (user.photo_url ?? '')) return;
    setSaving(true);
    try {
      await adminUpdateUser(user.id, { photo_url: next || null });
      onSaved();
    } catch (cause) {
      toast.error('Could not save the photo', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {value ? (
        <img src={value} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-500">
          {initialsOf(user.full_name)}
        </span>
      )}
      <input
        type="url"
        className={`${inputClass} w-40 py-1 text-xs`}
        value={value}
        disabled={saving}
        placeholder="https://…/photo.jpg"
        onChange={(event) => setValue(event.target.value)}
        onBlur={save}
      />
    </div>
  );
};
