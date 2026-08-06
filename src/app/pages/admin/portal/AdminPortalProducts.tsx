import React from 'react';
import { toast } from 'sonner';
import { Check, ExternalLink, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useAsync } from '@/app/hooks/use-async';
import { createProduct } from '@/app/lib/portal-api';
import {
  adminApproveProduct,
  adminDeleteProduct,
  adminListProducts,
  adminUpdateProduct,
} from '@/app/lib/portal-admin-api';
import type { Product, ProductDocument } from '@/app/lib/portal-types';
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
  SortHeader,
  StatusTag,
  inputClass,
  useTableSort,
} from '@/app/components/portal/PortalUi';

// A product's documents, tolerating rows that only have the legacy single-document columns (0028).
const productDocs = (product: Product): ProductDocument[] => {
  if (product.documents && product.documents.length > 0) return product.documents;
  if (product.document_url) return [{ name: product.document_name ?? null, url: product.document_url }];
  return [];
};

// Trim + drop empty rows before persisting the documents array.
const cleanDocs = (docs: ProductDocument[]): ProductDocument[] =>
  docs
    .map((doc) => ({ name: (doc.name ?? '').trim() || null, url: doc.url.trim() }))
    .filter((doc) => doc.url.length > 0);

/** Editable list of { name, url } documents — each follows the product onto a client's Materials. */
const DocumentsEditor: React.FC<{ docs: ProductDocument[]; onChange: (docs: ProductDocument[]) => void }> = ({
  docs,
  onChange,
}) => {
  const setAt = (index: number, patch: Partial<ProductDocument>) =>
    onChange(docs.map((doc, i) => (i === index ? { ...doc, ...patch } : doc)));

  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-grey">Documents</span>
      <p className="text-xs text-grey">Each follows this product onto a client’s Materials when it’s tagged.</p>
      {docs.map((doc, index) => (
        <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1.5fr_40px]">
          <input
            className={inputClass}
            placeholder="Document name"
            value={doc.name ?? ''}
            onChange={(event) => setAt(index, { name: event.target.value })}
          />
          <input
            className={inputClass}
            placeholder="https://…"
            value={doc.url}
            onChange={(event) => setAt(index, { url: event.target.value })}
          />
          <PortalButton
            variant="ghost"
            onClick={() => onChange(docs.filter((_, i) => i !== index))}
            aria-label="Remove document"
          >
            <Trash2 className="h-4 w-4" />
          </PortalButton>
        </div>
      ))}
      <PortalButton variant="ghost" onClick={() => onChange([...docs, { name: '', url: '' }])}>
        <Plus className="h-4 w-4" /> Add document
      </PortalButton>
    </div>
  );
};

export const AdminPortalProducts: React.FC = () => {
  const products = useAsync(() => adminListProducts(), []);
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [docs, setDocs] = React.useState<ProductDocument[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [working, setWorking] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [query, setQuery] = React.useState('');

  // Editing an existing product (name / description / documents that follow it onto clients).
  const [editing, setEditing] = React.useState<Product | null>(null);
  const [editName, setEditName] = React.useState('');
  const [editDescription, setEditDescription] = React.useState('');
  const [editDocs, setEditDocs] = React.useState<ProductDocument[]>([]);

  const add = async () => {
    if (!name.trim()) {
      toast.error('Product name is required.');
      return;
    }
    setBusy(true);
    try {
      const created = await createProduct(name.trim(), description.trim() || null);
      // The create RPC only takes name + description; attach the documents in a follow-up write.
      const cleaned = cleanDocs(docs);
      if (cleaned.length > 0) {
        await adminUpdateProduct(created.id, { documents: cleaned });
      }
      toast.success('Product added.');
      setName('');
      setDescription('');
      setDocs([]);
      setAdding(false);
      await products.reload();
    } catch (cause) {
      toast.error('Could not add', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const cancelAdd = () => {
    setAdding(false);
    setName('');
    setDescription('');
    setDocs([]);
  };

  const startEdit = (product: Product) => {
    setEditing(product);
    setEditName(product.name);
    setEditDescription(product.description ?? '');
    setEditDocs(productDocs(product));
  };

  const cancelEdit = () => setEditing(null);

  const saveEdit = async () => {
    if (!editing) return;
    if (!editName.trim()) {
      toast.error('Product name is required.');
      return;
    }
    setBusy(true);
    try {
      await adminUpdateProduct(editing.id, {
        name: editName.trim(),
        description: editDescription.trim() || null,
        documents: cleanDocs(editDocs),
      });
      toast.success('Product updated.');
      setEditing(null);
      await products.reload();
    } catch (cause) {
      toast.error('Could not save', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const approve = async (product: Product) => {
    setWorking(product.id);
    try {
      await adminApproveProduct(product.id);
      await products.reload();
    } catch (cause) {
      toast.error('Could not approve', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setWorking(null);
    }
  };

  const remove = async (product: Product) => {
    if (!window.confirm(`Delete “${product.name}”? It will be removed from every record it's tagged on.`)) return;
    setWorking(product.id);
    try {
      await adminDeleteProduct(product.id);
      if (editing?.id === product.id) setEditing(null);
      await products.reload();
    } catch (cause) {
      toast.error('Could not delete', { description: cause instanceof Error ? cause.message : undefined });
      setWorking(null);
    }
  };

  const all = products.data ?? [];
  const pending = all.filter((product) => product.status === 'pending');
  const q = query.trim().toLowerCase();
  const visible = q
    ? all.filter(
        (product) =>
          product.name.toLowerCase().includes(q) ||
          (product.description ?? '').toLowerCase().includes(q),
      )
    : all;

  const { sorted, sort, toggle } = useTableSort(visible, {
    name: (p) => p.name.toLowerCase(),
    description: (p) => (p.description ?? '').toLowerCase(),
    documents: (p) => productDocs(p).length,
    status: (p) => p.status,
  });

  if (products.loading) return <PortalSpinner label="Loading products…" />;
  if (products.error) return <ErrorNote>{products.error}</ErrorNote>;

  return (
    <div className="space-y-2">
      <PortalCard
        title="Products"
        description={`${all.length} in the catalog${pending.length ? ` · ${pending.length} awaiting approval` : ''}`}
        action={
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-grey" />
              <input
                type="search"
                className={`${inputClass} w-48 pl-8`}
                placeholder="Search products…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <PortalButton type="button" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" /> Add product
            </PortalButton>
          </>
        }
      >
        <PortalModal
          open={adding}
          onClose={cancelAdd}
          title="Add product"
          description="Create a product and, optionally, the documents that follow it onto clients."
        >
          <form onSubmit={(event) => event.preventDefault()} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Product name">
                <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} />
              </Field>
              <Field label="Description (optional)">
                <input className={inputClass} value={description} onChange={(event) => setDescription(event.target.value)} />
              </Field>
            </div>
            <DocumentsEditor docs={docs} onChange={setDocs} />
            <div className="flex gap-2 pt-1">
              <PortalButton type="button" disabled={busy} onClick={add}>
                <Plus className="h-4 w-4" /> {busy ? 'Adding…' : 'Add product'}
              </PortalButton>
              <PortalButton type="button" variant="ghost" onClick={cancelAdd}>
                Cancel
              </PortalButton>
            </div>
          </form>
        </PortalModal>

        <PortalModal
          open={editing !== null}
          onClose={cancelEdit}
          title={editing ? `Edit “${editing.name}”` : 'Edit product'}
          description="Update the product and the documents that follow it onto clients."
        >
          <form onSubmit={(event) => event.preventDefault()} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Product name">
                <input className={inputClass} value={editName} onChange={(event) => setEditName(event.target.value)} />
              </Field>
              <Field label="Description">
                <input
                  className={inputClass}
                  value={editDescription}
                  onChange={(event) => setEditDescription(event.target.value)}
                />
              </Field>
            </div>
            <DocumentsEditor docs={editDocs} onChange={setEditDocs} />
            <div className="flex gap-2 pt-1">
              <PortalButton type="button" disabled={busy} onClick={saveEdit}>
                {busy ? 'Saving…' : 'Save changes'}
              </PortalButton>
              <PortalButton type="button" variant="ghost" onClick={cancelEdit}>
                Cancel
              </PortalButton>
            </div>
          </form>
        </PortalModal>

        {all.length === 0 ? (
          <EmptyState title="No products yet" description="Add the first product with the button above." />
        ) : visible.length === 0 ? (
          <EmptyState title="No matches" description={`No products match “${query.trim()}”.`} />
        ) : (
          <PortalTable
            head={[
              <SortHeader key="name" label="Name" sortKey="name" sort={sort} onSort={toggle} />,
              <SortHeader key="description" label="Description" sortKey="description" sort={sort} onSort={toggle} />,
              <SortHeader key="documents" label="Documents" sortKey="documents" sort={sort} onSort={toggle} />,
              <SortHeader key="status" label="Status" sortKey="status" sort={sort} onSort={toggle} />,
              '',
            ]}
          >
            {sorted.map((product) => {
              const rows = productDocs(product);
              return (
                <Row key={product.id}>
                  <Cell className="font-medium">{product.name}</Cell>
                  <Cell className="text-grey">{product.description || '—'}</Cell>
                  <Cell>
                    {rows.length === 0 ? (
                      <span className="text-grey">—</span>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {rows.map((doc, index) => (
                          <a
                            key={index}
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 font-medium text-violet hover:underline"
                          >
                            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                            {doc.name || 'Document'}
                          </a>
                        ))}
                      </div>
                    )}
                  </Cell>
                  <Cell>
                    {product.status === 'pending' ? (
                      <StatusTag tone="amber">Pending approval</StatusTag>
                    ) : (
                      <StatusTag tone="green">Approved</StatusTag>
                    )}
                  </Cell>
                  <Cell className="text-right">
                    <div className="flex justify-end gap-1">
                      {product.status === 'pending' && (
                        <PortalButton variant="ghost" disabled={working === product.id} onClick={() => approve(product)}>
                          <Check className="h-4 w-4" /> Approve
                        </PortalButton>
                      )}
                      <PortalButton variant="ghost" onClick={() => startEdit(product)} aria-label="Edit">
                        <Pencil className="h-4 w-4" />
                      </PortalButton>
                      <PortalButton variant="ghost" disabled={working === product.id} onClick={() => remove(product)} aria-label="Delete">
                        <Trash2 className="h-4 w-4" />
                      </PortalButton>
                    </div>
                  </Cell>
                </Row>
              );
            })}
          </PortalTable>
        )}
      </PortalCard>
    </div>
  );
};
