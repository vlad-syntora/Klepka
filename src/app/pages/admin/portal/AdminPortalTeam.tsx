import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Pencil, Trash2, UserPlus } from 'lucide-react';
import { useAsync } from '@/app/hooks/use-async';
import {
  adminCreateUser,
  adminDeleteUser,
  adminListAccounts,
  adminListUsers,
  adminSetUserProducts,
  adminUpdateUser,
  portalInviteUser,
} from '@/app/lib/portal-admin-api';
import { notifyInviteResult } from '@/app/lib/invite-feedback';
import { usePortalUser } from '@/app/hooks/use-portal-user';
import { formatRelative, initialsOf, prettyName } from '@/app/lib/portal-format';
import {
  INTERNAL_ROLES,
  PAY_CURRENCIES,
  ROLE_LABELS,
  USER_STATUSES,
  USER_STATUS_LABELS,
  canEditAccounts,
  isImplementer,
  isInternalRole,
  type PortalRole,
  type PortalUser,
  type UserStatus,
} from '@/app/lib/portal-types';
import { openCalendly } from '@/app/lib/calendly';
import { UserStatusControl } from '@/app/components/admin/portal/UserStatusControl';
import { UserSkillsEditor } from '@/app/components/admin/portal/UserSkillsEditor';
import { TeamsPanel } from '@/app/pages/admin/portal/AdminPortalTeams';
import {
  Cell,
  EmptyState,
  ErrorNote,
  Field,
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
  useTableSort,
} from '@/app/components/portal/PortalUi';
import { cn } from '@/app/components/ui/utils';

type TeamTab = 'klepka' | 'customers' | 'teams';

export const AdminPortalTeam: React.FC = () => {
  const { user } = usePortalUser();
  // Implementers can view the team directory but not manage it (RLS blocks the writes anyway), and
  // they don't get the Customer users tab at all.
  const canManage = user ? canEditAccounts(user.role) : true;
  const implementer = user ? isImplementer(user.role) : false;
  const isAdmin = user?.role === 'portal_admin';
  // Employee teams fold in as a tab — admins manage it, Implementers view it read-only (same gate as
  // the old standalone Teams page).
  const canSeeTeams = isAdmin || implementer;
  const users = useAsync(() => adminListUsers(), []);
  const accounts = useAsync(() => adminListAccounts(), []);
  const [searchParams] = useSearchParams();
  const [tab, setTab] = React.useState<TeamTab>(() => {
    const requested = searchParams.get('tab');
    return requested === 'customers' || requested === 'teams' ? requested : 'klepka';
  });
  const [showAdd, setShowAdd] = React.useState(false);
  // null → the form creates a new member; a user id → it edits that member in place.
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [fullName, setFullName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [calendly, setCalendly] = React.useState('');
  const [photo, setPhoto] = React.useState('');
  const [payRate, setPayRate] = React.useState('');
  const [payCurrency, setPayCurrency] = React.useState('USD');
  const [role, setRole] = React.useState<PortalRole>('sales_rep');
  // Draft skills held only while creating a member (no user row to persist against yet); applied
  // once the user is created. In edit mode the editor saves against the user id directly.
  const [skillIds, setSkillIds] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const canEditSkills = user?.role === 'portal_admin';
  // Accounts-style list controls: a search box and a status filter shared by both tabs, plus a role
  // filter on the Klepka-team tab.
  const [query, setQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'all' | UserStatus>('all');
  const [roleFilter, setRoleFilter] = React.useState<'all' | PortalRole>('all');

  const resetForm = () => {
    setEditingId(null);
    setFullName('');
    setEmail('');
    setTitle('');
    setCalendly('');
    setPhoto('');
    setPayRate('');
    setPayCurrency('USD');
    setRole('sales_rep');
    setSkillIds([]);
    setShowAdd(false);
  };

  const startEdit = (user: PortalUser) => {
    setEditingId(user.id);
    setFullName(user.full_name);
    setEmail(user.email);
    setTitle(user.title ?? '');
    setCalendly(user.calendly_url ?? '');
    setPhoto(user.photo_url ?? '');
    setPayRate(user.pay_rate != null ? String(user.pay_rate) : '');
    setPayCurrency(user.pay_currency || 'USD');
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
    const parsedRate = payRate.trim() === '' ? null : Number(payRate);
    if (parsedRate != null && (!Number.isFinite(parsedRate) || parsedRate < 0)) {
      toast.error('Pay rate must be a non-negative number.');
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
          pay_rate: parsedRate,
          pay_currency: payCurrency,
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
          pay_rate: parsedRate,
          pay_currency: payCurrency,
        });
        if (skillIds.length && canEditSkills) {
          await adminSetUserProducts(created.id, skillIds);
        }
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

  const all = users.data ?? [];
  const internal = all.filter((user) => isInternalRole(user.role));
  const customers = all.filter((user) => !isInternalRole(user.role));
  const accountName = (id: string | null) => accounts.data?.find((account) => account.id === id)?.name ?? '—';

  const filtersActive = query.trim().length > 0 || statusFilter !== 'all' || roleFilter !== 'all';
  const matchesFilters = (person: PortalUser) => {
    if (query) {
      const q = query.toLowerCase();
      if (!prettyName(person.full_name).toLowerCase().includes(q) && !person.email.toLowerCase().includes(q)) return false;
    }
    if (statusFilter !== 'all' && person.status !== statusFilter) return false;
    return true;
  };
  const internalVisible = internal.filter((p) => matchesFilters(p) && (roleFilter === 'all' || p.role === roleFilter));
  const customerVisible = customers.filter(matchesFilters);

  const internalSorted = useTableSort(internalVisible, {
    name: (u) => prettyName(u.full_name).toLowerCase(),
    email: (u) => u.email.toLowerCase(),
    role: (u) => ROLE_LABELS[u.role],
    status: (u) => USER_STATUS_LABELS[u.status],
    login: (u) => u.last_login_at,
  });
  const customerSorted = useTableSort(customerVisible, {
    name: (u) => prettyName(u.full_name).toLowerCase(),
    account: (u) => accountName(u.account_id).toLowerCase(),
    role: (u) => ROLE_LABELS[u.role],
    status: (u) => USER_STATUS_LABELS[u.status],
    login: (u) => u.last_login_at,
  });

  // Reusable Accounts-style search + status filter for a card header.
  const filterControls = (
    <>
      <input
        className={`${inputClass} w-40 py-1.5 text-xs`}
        placeholder="Search users…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <select
        className={`${inputClass} w-auto py-1.5 text-xs`}
        value={statusFilter}
        onChange={(event) => setStatusFilter(event.target.value as 'all' | UserStatus)}
      >
        <option value="all">All statuses</option>
        {USER_STATUSES.map((value) => (
          <option key={value} value={value}>
            {USER_STATUS_LABELS[value]}
          </option>
        ))}
      </select>
    </>
  );

  // Tabs available to this role: everyone sees Klepka team; Customer users is hidden from Implementers;
  // Teams is admin-manage / Implementer-view only.
  const tabs: { key: TeamTab; label: string }[] = [
    { key: 'klepka', label: `Klepka team (${internal.length})` },
    ...(implementer ? [] : ([{ key: 'customers', label: `Customer users (${customers.length})` }] as const)),
    ...(canSeeTeams ? ([{ key: 'teams', label: 'Teams' }] as const) : []),
  ];
  // Fall back to Klepka if the requested tab isn't available to this role (e.g. an Implementer deep-linked
  // to ?tab=customers).
  const activeTab: TeamTab = tabs.some((t) => t.key === tab) ? tab : 'klepka';

  if (users.loading) return <PortalSpinner label="Loading team…" />;
  if (users.error) return <ErrorNote>{users.error}</ErrorNote>;

  return (
    <div className="space-y-2">
      {tabs.length > 1 && (
        <div className="flex gap-1 border-b border-border-color">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'border-b-2 px-3 py-2.5 text-sm transition-colors',
                activeTab === key ? 'border-violet font-medium text-violet' : 'border-transparent text-grey hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'teams' ? (
        <TeamsPanel />
      ) : activeTab === 'klepka' ? (
        <PortalCard
          title="Klepka team"
          description="Internal roles set default permissions across accounts."
          action={
            <>
              {filterControls}
              <select
                className={`${inputClass} w-auto py-1.5 text-xs`}
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value as 'all' | PortalRole)}
              >
                <option value="all">All roles</option>
                {INTERNAL_ROLES.map((value) => (
                  <option key={value} value={value}>
                    {ROLE_LABELS[value]}
                  </option>
                ))}
              </select>
              {canManage && (
                <PortalButton
                  className="whitespace-nowrap"
                  onClick={() => {
                    resetForm();
                    setShowAdd(true);
                  }}
                >
                  <UserPlus className="h-4 w-4 shrink-0" /> Add team member
                </PortalButton>
              )}
            </>
          }
        >
          {canManage && (
            <PortalModal
              open={showAdd}
              onClose={resetForm}
              title={editingId ? `Edit ${prettyName(fullName || 'team member')}` : 'Add team member'}
              description="Internal roles set default permissions across accounts."
            >
              <form onSubmit={(event) => event.preventDefault()} className="grid gap-3 sm:grid-cols-2">
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
                <Field label="Internal role">
                  <select className={inputClass} value={role} onChange={(event) => setRole(event.target.value as PortalRole)}>
                    {INTERNAL_ROLES.map((value) => (
                      <option key={value} value={value}>
                        {ROLE_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Job title">
                  <input className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} />
                </Field>
                <Field
                  label="Default pay rate"
                  hint="Internal hourly cost rate. Prefills offer lines and project members; used to calculate salaries."
                >
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className={inputClass}
                      value={payRate}
                      onChange={(event) => setPayRate(event.target.value)}
                      placeholder="0.00"
                    />
                    <select
                      className={`${inputClass} w-24`}
                      value={payCurrency}
                      onChange={(event) => setPayCurrency(event.target.value)}
                    >
                      {PAY_CURRENCIES.map((code) => (
                        <option key={code} value={code}>
                          {code}
                        </option>
                      ))}
                    </select>
                  </div>
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
                <Field label="Calendly link" className="sm:col-span-2" hint="Personal booking URL — optional.">
                  <input
                    type="url"
                    className={inputClass}
                    value={calendly}
                    onChange={(event) => setCalendly(event.target.value)}
                    placeholder="https://calendly.com/name"
                  />
                </Field>
                <Field
                  label="Skills (products owned)"
                  className="sm:col-span-2"
                  hint={
                    !canEditSkills
                      ? 'Only a Portal Admin can change skills.'
                      : editingId
                        ? 'Pick the products this person owns. Changes save immediately.'
                        : 'Pick the products this person owns. Saved when you create the member.'
                  }
                >
                  {editingId ? (
                    <UserSkillsEditor userId={editingId} canEdit={canEditSkills} />
                  ) : (
                    <UserSkillsEditor value={skillIds} onChange={setSkillIds} canEdit={canEditSkills} />
                  )}
                </Field>
                <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
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
            </PortalModal>
          )}

          {internalSorted.sorted.length === 0 ? (
            <EmptyState title={filtersActive ? 'No users match' : 'No internal users yet'} />
          ) : (
            <PortalTable
              className="[&_th]:px-3 [&_td]:px-3"
              head={[
                <SortHeader key="name" label="Name" sortKey="name" sort={internalSorted.sort} onSort={internalSorted.toggle} />,
                <SortHeader key="email" label="Email" sortKey="email" sort={internalSorted.sort} onSort={internalSorted.toggle} />,
                <SortHeader key="role" label="Role" sortKey="role" sort={internalSorted.sort} onSort={internalSorted.toggle} />,
                // Pay rate is finance data — hidden from the delivery-only Implementer role.
                ...(implementer ? [] : ['Pay rate']),
                'Calendly',
                'Photo',
                <SortHeader key="status" label="Status" sortKey="status" sort={internalSorted.sort} onSort={internalSorted.toggle} />,
                <SortHeader key="login" label="Last login" sortKey="login" sort={internalSorted.sort} onSort={internalSorted.toggle} />,
                ...(canManage ? [''] : []),
              ]}
            >
              {internalSorted.sorted.map((user) => (
                <Row key={user.id}>
                  <Cell className="whitespace-nowrap">
                    <div className="font-medium">{prettyName(user.full_name)}</div>
                    {user.title && <div className="text-xs text-grey">{user.title}</div>}
                  </Cell>
                  <Cell className="whitespace-nowrap text-grey">{user.email}</Cell>
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
                  {!implementer && (
                    <Cell className="whitespace-nowrap text-grey">
                      {user.pay_rate != null ? `${user.pay_rate} ${user.pay_currency}/h` : '—'}
                    </Cell>
                  )}
                  <Cell>
                    {canManage ? (
                      <CalendlyCell user={user} onSaved={() => users.reload()} />
                    ) : user.calendly_url ? (
                      <button
                        type="button"
                        className="text-violet hover:underline"
                        onClick={() =>
                          openCalendly(user.calendly_url ?? '').catch(() =>
                            toast.error('Could not open the booking window'),
                          )
                        }
                      >
                        Book
                      </button>
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
                        <PortalButton variant="ghost" onClick={() => startEdit(user)} aria-label="Edit">
                          <Pencil className="h-4 w-4" />
                        </PortalButton>
                        <PortalButton variant="ghost" onClick={() => remove(user)} aria-label="Remove">
                          <Trash2 className="h-4 w-4" />
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
        <PortalCard
          title="Customer users"
          description="Every client-side login across all accounts."
          action={filterControls}
        >
          {customerSorted.sorted.length === 0 ? (
            <EmptyState title={filtersActive ? 'No users match' : 'No customer users yet'} />
          ) : (
            <PortalTable
              head={[
                <SortHeader key="name" label="Name" sortKey="name" sort={customerSorted.sort} onSort={customerSorted.toggle} />,
                <SortHeader key="account" label="Account" sortKey="account" sort={customerSorted.sort} onSort={customerSorted.toggle} />,
                <SortHeader key="role" label="Role" sortKey="role" sort={customerSorted.sort} onSort={customerSorted.toggle} />,
                <SortHeader key="status" label="Status" sortKey="status" sort={customerSorted.sort} onSort={customerSorted.toggle} />,
                <SortHeader key="login" label="Last login" sortKey="login" sort={customerSorted.sort} onSort={customerSorted.toggle} />,
              ]}
            >
              {customerSorted.sorted.map((user) => (
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
    <div className="flex items-center gap-1.5">
      <input
        type="url"
        className={`${inputClass} w-28 py-1 text-xs`}
        value={value}
        disabled={saving}
        placeholder="calendly.com/…"
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
        className={`${inputClass} w-36 py-1 text-xs`}
        value={value}
        disabled={saving}
        placeholder="https://…/photo.jpg"
        onChange={(event) => setValue(event.target.value)}
        onBlur={save}
      />
    </div>
  );
};
