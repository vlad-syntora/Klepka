import React from 'react';
import { toast } from 'sonner';
import { GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { useAsync } from '@/app/hooks/use-async';
import { adminListArticles } from '@/app/lib/admin-api';
import {
  adminDeleteIntakeTemplate,
  adminDeleteMaterialTemplate,
  adminGetDefaultAccountOwner,
  adminListIntakeTemplates,
  adminListInternalUsers,
  adminListMaterialTemplates,
  adminSetDefaultAccountOwner,
  adminSetIntakeTemplatePosition,
  adminUpsertIntakeTemplate,
  adminUpsertMaterialTemplate,
} from '@/app/lib/portal-admin-api';
import {
  RESOURCE_KINDS,
  RESOURCE_KIND_LABELS,
  type IntakeTemplate,
  type MaterialTemplate,
  type PortalResource,
} from '@/app/lib/portal-types';
import { PHASE_LABELS } from '@/app/lib/portal-phase';
import { prettyName } from '@/app/lib/portal-format';
import {
  Cell,
  CollapsibleCards,
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
  StatusTag,
  inputClass,
} from '@/app/components/portal/PortalUi';

const PHASES: PortalResource['phase'][] = ['onboarding', 'discovery', 'proposal', 'delivery', 'any'];
const phaseLabel = (phase: PortalResource['phase']) => (phase === 'any' ? 'All stages' : PHASE_LABELS[phase]);

/**
 * The org-wide default Account Owner. Stored only for now — account creation still assigns the
 * running user as owner (see adminCreateAccount); this preference does not change that yet.
 */
const DefaultOwnerSection: React.FC = () => {
  const users = useAsync(() => adminListInternalUsers(), []);
  const current = useAsync(() => adminGetDefaultAccountOwner(), []);
  const [ownerId, setOwnerId] = React.useState<string>('');
  const [busy, setBusy] = React.useState(false);

  // Seed the select once the stored value loads.
  React.useEffect(() => {
    if (current.data !== undefined && current.data !== null) setOwnerId(current.data);
  }, [current.data]);

  const active = (users.data ?? []).filter((user) => user.status === 'active');

  const save = async () => {
    setBusy(true);
    try {
      await adminSetDefaultAccountOwner(ownerId || null);
      toast.success('Default account owner saved.');
      await current.reload();
    } catch (cause) {
      toast.error('Could not save', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  if (users.loading || current.loading) return <PortalSpinner />;
  if (users.error) return <ErrorNote>{users.error}</ErrorNote>;
  if (current.error) return <ErrorNote>{current.error}</ErrorNote>;

  return (
    <PortalCard
      title="Default account owner"
      description="Pick the default owner for new accounts from active team members."
    >
      <div className="grid gap-3 rounded-lg border border-border-color bg-off-white p-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field label="Owner">
          <select className={inputClass} value={ownerId} onChange={(event) => setOwnerId(event.target.value)}>
            <option value="">No default</option>
            {active.map((user) => (
              <option key={user.id} value={user.id}>
                {prettyName(user.full_name)}
                {user.title ? ` — ${user.title}` : ''}
              </option>
            ))}
          </select>
        </Field>
        <PortalButton type="button" disabled={busy} onClick={save}>
          {busy ? 'Saving…' : 'Save'}
        </PortalButton>
      </div>
    </PortalCard>
  );
};

/**
 * A list + editor of the general onboarding-material templates copied into every new account.
 * Mirrors WorkspaceResources, minus the shared/Drive bits — template files live in the shared
 * storage path and are copied by reference into accounts. The editor opens in a modal.
 */
const MaterialTemplatesSection: React.FC = () => {
  const materials = useAsync(() => adminListMaterialTemplates(), []);
  const articles = useAsync(() => adminListArticles(), []);

  const [showForm, setShowForm] = React.useState(false);
  const [editing, setEditing] = React.useState<MaterialTemplate | null>(null);
  const [formTitle, setFormTitle] = React.useState('');
  const [formDescription, setFormDescription] = React.useState('');
  const [kind, setKind] = React.useState<PortalResource['kind']>('presentation');
  const [phase, setPhase] = React.useState<PortalResource['phase']>('onboarding');
  const [url, setUrl] = React.useState('');
  const [articleId, setArticleId] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const rows = materials.data ?? [];

  const resetForm = () => {
    setEditing(null);
    setFormTitle('');
    setFormDescription('');
    setKind('presentation');
    setPhase('onboarding');
    setUrl('');
    setArticleId('');
  };

  const closeForm = () => {
    resetForm();
    setShowForm(false);
  };

  const startAdd = () => {
    resetForm();
    setShowForm(true);
  };

  const startEdit = (material: MaterialTemplate) => {
    setEditing(material);
    setFormTitle(material.title ?? '');
    setFormDescription(material.description ?? '');
    setKind(material.kind);
    setPhase(material.phase);
    setUrl(material.url ?? '');
    setArticleId(material.article_id ?? '');
    setShowForm(true);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (kind === 'article' && !articleId) {
      toast.error('Pick an article.');
      return;
    }
    if (kind !== 'article' && !url.trim()) {
      toast.error('Add a link.');
      return;
    }

    setBusy(true);
    try {
      await adminUpsertMaterialTemplate({
        id: editing?.id,
        title: formTitle.trim() || 'Untitled',
        description: formDescription.trim(),
        kind,
        url: url.trim() || null,
        file_path: null,
        article_id: kind === 'article' ? articleId : null,
        phase,
        position: editing?.position ?? rows.length,
      });
      toast.success(editing ? 'Material updated.' : 'Material added.');
      closeForm();
      await materials.reload();
    } catch (cause) {
      toast.error('Could not save', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (material: MaterialTemplate) => {
    if (!window.confirm(`Remove "${material.title}"? Accounts that already have it keep their copy.`)) return;
    try {
      await adminDeleteMaterialTemplate(material.id);
      await materials.reload();
    } catch (cause) {
      toast.error('Could not remove', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  if (materials.loading) return <PortalSpinner />;
  if (materials.error) return <ErrorNote>{materials.error}</ErrorNote>;

  return (
    <PortalCard
      title="Default onboarding materials"
      description="Copied into every new client’s Materials on creation."
      action={
        <PortalButton onClick={startAdd}>
          <Plus className="h-4 w-4" /> Add material
        </PortalButton>
      }
    >
      <PortalModal
        open={showForm}
        onClose={closeForm}
        title={editing ? 'Edit material' : 'New material'}
        description="Add a link (or an article); it’s copied into each new account’s Materials."
      >
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Kind">
              <select
                className={inputClass}
                value={kind}
                onChange={(event) => setKind(event.target.value as PortalResource['kind'])}
              >
                {RESOURCE_KINDS.map((value) => (
                  <option key={value} value={value}>
                    {RESOURCE_KIND_LABELS[value]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Shown from" hint="And every stage after it.">
              <select
                className={inputClass}
                value={phase}
                onChange={(event) => setPhase(event.target.value as PortalResource['phase'])}
              >
                {PHASES.map((value) => (
                  <option key={value} value={value}>
                    {phaseLabel(value)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Title">
            <input className={inputClass} value={formTitle} onChange={(event) => setFormTitle(event.target.value)} />
          </Field>

          <Field label="Description">
            <input
              className={inputClass}
              value={formDescription}
              onChange={(event) => setFormDescription(event.target.value)}
            />
          </Field>

          {kind === 'article' ? (
            <Field label="Article" hint="Published articles from the site.">
              <select className={inputClass} value={articleId} onChange={(event) => setArticleId(event.target.value)}>
                <option value="">Select…</option>
                {(articles.data ?? [])
                  .filter((article) => article.status === 'published')
                  .map((article) => (
                    <option key={article.id} value={article.id}>
                      {article.title}
                    </option>
                  ))}
              </select>
            </Field>
          ) : (
            <Field label="Link" hint="External URL to the material.">
              <input className={inputClass} value={url} onChange={(event) => setUrl(event.target.value)} />
            </Field>
          )}

          <div className="flex gap-2 pt-1">
            <PortalButton type="submit" disabled={busy}>
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Add'}
            </PortalButton>
            <PortalButton variant="ghost" type="button" onClick={closeForm}>
              Cancel
            </PortalButton>
          </div>
        </form>
      </PortalModal>

      {rows.length === 0 ? (
        <EmptyState title="No material yet" description="Add the materials every new client should start with." />
      ) : (
        <PortalTable head={['Title', 'Kind', 'Shown from', '']}>
          {rows.map((material) => (
            <Row key={material.id}>
              <Cell>
                <div className="font-medium">{material.title}</div>
                {material.description && <div className="text-xs text-grey">{material.description}</div>}
              </Cell>
              <Cell className="whitespace-nowrap text-grey">{RESOURCE_KIND_LABELS[material.kind]}</Cell>
              <Cell className="whitespace-nowrap text-grey">{phaseLabel(material.phase)}</Cell>
              <Cell className="text-right">
                <div className="flex justify-end gap-1">
                  <PortalButton variant="ghost" onClick={() => startEdit(material)} aria-label="Edit">
                    <Pencil className="h-4 w-4" />
                  </PortalButton>
                  <PortalButton variant="ghost" onClick={() => remove(material)} aria-label="Remove">
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

/** The standard gathering (discovery) checklist — copied into an opportunity's intake on demand. */
const IntakeTemplateSection: React.FC = () => {
  const items = useAsync(() => adminListIntakeTemplates(), []);
  // Add form (inline) state.
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [ownerSide, setOwnerSide] = React.useState<'client' | 'klepka'>('client');
  // Edit modal state — a separate popup so editing doesn't disturb the add row.
  const [editing, setEditing] = React.useState<IntakeTemplate | null>(null);
  const [editName, setEditName] = React.useState('');
  const [editDescription, setEditDescription] = React.useState('');
  const [editOwnerSide, setEditOwnerSide] = React.useState<'client' | 'klepka'>('client');
  const [busy, setBusy] = React.useState(false);

  // Local, editable copy of the list so drag-and-drop reorders instantly without a page refresh.
  const [rows, setRows] = React.useState<IntakeTemplate[]>([]);
  const rowsRef = React.useRef<IntakeTemplate[]>([]);
  const dragFrom = React.useRef<number | null>(null);
  const [dragging, setDragging] = React.useState<number | null>(null);

  const applyRows = React.useCallback((next: IntakeTemplate[]) => {
    rowsRef.current = next;
    setRows(next);
  }, []);

  // Adopt the server list whenever it (re)loads — e.g. after add / edit / remove.
  React.useEffect(() => {
    applyRows(items.data ?? []);
  }, [items.data, applyRows]);

  const add = async () => {
    if (!name.trim()) {
      toast.error('Item name is required.');
      return;
    }
    setBusy(true);
    try {
      await adminUpsertIntakeTemplate({
        name: name.trim(),
        description: description.trim(),
        owner_side: ownerSide,
        position: rows.length,
      });
      setName('');
      setDescription('');
      setOwnerSide('client');
      await items.reload();
    } catch (cause) {
      toast.error('Could not save', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (item: IntakeTemplate) => {
    setEditing(item);
    setEditName(item.name);
    setEditDescription(item.description);
    setEditOwnerSide(item.owner_side);
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!editName.trim()) {
      toast.error('Item name is required.');
      return;
    }
    setBusy(true);
    try {
      await adminUpsertIntakeTemplate({
        id: editing.id,
        name: editName.trim(),
        description: editDescription.trim(),
        owner_side: editOwnerSide,
        position: editing.position,
      });
      setEditing(null);
      await items.reload();
    } catch (cause) {
      toast.error('Could not save', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  // Drag-and-drop reordering: reorder the local list live, then persist only the changed
  // positions in the background (no reload, so the page never flickers).
  const reorder = (from: number, to: number) => {
    const next = [...rowsRef.current];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    applyRows(next);
  };

  const persistOrder = async () => {
    const next = rowsRef.current;
    const writes = next
      .map((item, index) => (item.position === index ? null : adminSetIntakeTemplatePosition(item.id, index)))
      .filter((write): write is Promise<void> => write !== null);
    if (writes.length === 0) return;
    try {
      await Promise.all(writes);
      applyRows(next.map((item, index) => ({ ...item, position: index })));
    } catch (cause) {
      toast.error('Could not reorder', { description: cause instanceof Error ? cause.message : undefined });
      await items.reload(); // fall back to the stored order if a write failed
    }
  };

  const handleDragStart = (index: number) => () => {
    dragFrom.current = index;
    setDragging(index);
  };

  const handleDragOver = (index: number) => (event: React.DragEvent) => {
    event.preventDefault();
    const from = dragFrom.current;
    if (from === null || from === index) return;
    reorder(from, index);
    dragFrom.current = index;
    setDragging(index);
  };

  const handleDragEnd = () => {
    dragFrom.current = null;
    setDragging(null);
    void persistOrder();
  };

  const remove = async (id: string, itemName: string) => {
    if (!window.confirm(`Remove "${itemName}" from the standard checklist?`)) return;
    try {
      await adminDeleteIntakeTemplate(id);
      if (editing?.id === id) setEditing(null);
      await items.reload();
    } catch (cause) {
      toast.error('Could not remove', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  if (items.loading) return <PortalSpinner />;
  if (items.error) return <ErrorNote>{items.error}</ErrorNote>;

  return (
    <PortalCard
      title="Standard gathering checklist"
      description="The default information-gathering items. Staff apply them to an opportunity with “Use standard checklist”."
    >
      <form
        onSubmit={(event) => event.preventDefault()}
        className="mb-4 grid gap-3 rounded-lg border border-border-color bg-off-white p-4 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end"
      >
        <Field label="Item name">
          <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Description (optional)">
          <input className={inputClass} value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>
        <Field label="Owner">
          <select
            className={inputClass}
            value={ownerSide}
            onChange={(event) => setOwnerSide(event.target.value as 'client' | 'klepka')}
          >
            <option value="client">Client</option>
            <option value="klepka">Klepka</option>
          </select>
        </Field>
        <div className="flex gap-2">
          <PortalButton type="button" disabled={busy} onClick={add}>
            <Plus className="h-4 w-4" />
            {busy ? 'Saving…' : 'Add item'}
          </PortalButton>
        </div>
      </form>

      <PortalModal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Edit checklist item"
        description="Update the standard information-gathering item."
      >
        <form onSubmit={(event) => event.preventDefault()} className="space-y-3">
          <Field label="Item name">
            <input className={inputClass} value={editName} onChange={(event) => setEditName(event.target.value)} />
          </Field>
          <Field label="Description (optional)">
            <input
              className={inputClass}
              value={editDescription}
              onChange={(event) => setEditDescription(event.target.value)}
            />
          </Field>
          <Field label="Owner">
            <select
              className={inputClass}
              value={editOwnerSide}
              onChange={(event) => setEditOwnerSide(event.target.value as 'client' | 'klepka')}
            >
              <option value="client">Client</option>
              <option value="klepka">Klepka</option>
            </select>
          </Field>
          <div className="flex gap-2 pt-1">
            <PortalButton type="button" disabled={busy} onClick={saveEdit}>
              {busy ? 'Saving…' : 'Save changes'}
            </PortalButton>
            <PortalButton type="button" variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </PortalButton>
          </div>
        </form>
      </PortalModal>

      {rows.length === 0 ? (
        <EmptyState title="No checklist items yet" description="Add the first item above." />
      ) : (
        <PortalTable head={['', 'Item', 'Owner', '']}>
          {rows.map((item, index) => (
            <tr
              key={item.id}
              draggable={editing === null}
              onDragStart={handleDragStart(index)}
              onDragOver={handleDragOver(index)}
              onDrop={handleDragEnd}
              onDragEnd={handleDragEnd}
              className={`border-b border-border-color last:border-b-0 transition-colors ${
                dragging === index ? 'bg-portal-tint/60 opacity-70' : ''
              }`}
            >
              <Cell className="w-8 whitespace-nowrap">
                <span
                  className={`inline-flex text-grey ${
                    editing === null ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed opacity-40'
                  }`}
                  aria-label="Drag to reorder"
                  title={editing === null ? 'Drag to reorder' : 'Finish editing to reorder'}
                >
                  <GripVertical className="h-4 w-4" />
                </span>
              </Cell>
              <Cell>
                <div className="font-medium">{item.name}</div>
                {item.description && <div className="text-xs text-grey">{item.description}</div>}
              </Cell>
              <Cell>
                <StatusTag tone={item.owner_side === 'client' ? 'violet' : 'grey'}>
                  {item.owner_side === 'client' ? 'Client' : 'Klepka'}
                </StatusTag>
              </Cell>
              <Cell className="text-right">
                <div className="flex justify-end gap-1">
                  <PortalButton variant="ghost" onClick={() => startEdit(item)} aria-label="Edit">
                    <Pencil className="h-4 w-4" />
                  </PortalButton>
                  <PortalButton variant="ghost" onClick={() => remove(item.id, item.name)} aria-label="Remove">
                    <Trash2 className="h-4 w-4" />
                  </PortalButton>
                </div>
              </Cell>
            </tr>
          ))}
        </PortalTable>
      )}
    </PortalCard>
  );
};

export const AdminSalesProcessSettings: React.FC = () => {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-xl font-semibold text-foreground">Sales Process Settings</h1>
        <p className="text-sm text-grey">
          Reusable defaults that flow into accounts: onboarding materials are copied into every new client, and the
          standard checklist seeds an opportunity’s information gathering. (A product’s own document is set on the
          Products tab and attaches when that product is tagged.)
        </p>
      </div>

      {/* Each section is a collapsible card; open/closed state is remembered per section. */}
      <CollapsibleCards scope="sales-settings" defaultOpen>
        <div className="space-y-2">
          <DefaultOwnerSection />

          <MaterialTemplatesSection />

          <IntakeTemplateSection />
        </div>
      </CollapsibleCards>

      <InfoNote>
        Editing a default only affects future clients — accounts that already received a copy keep their own,
        editable version. The standard checklist is added once and never duplicated on re-applying.
      </InfoNote>
    </div>
  );
};
