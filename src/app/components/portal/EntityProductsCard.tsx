import React from 'react';
import { toast } from 'sonner';
import {
  createProduct,
  listAccountInheritedProducts,
  listEntityProducts,
  listProducts,
  setEntityProducts,
} from '@/app/lib/portal-api';
import type { Product, ProductEntity } from '@/app/lib/portal-types';
import { PortalCard, PortalSpinner, StatusTag } from '@/app/components/portal/PortalUi';
import { ProductPicker } from '@/app/components/portal/ProductPicker';

/**
 * Products tagged on one account / opportunity / project, with a picker to edit them. Both the
 * admin console and the client portal render this — writes go through the same client-safe RPC,
 * which lets a client on their own account (or staff who can manage it) change the set.
 */
export const EntityProductsCard: React.FC<{
  entity: ProductEntity;
  id: string;
  canEdit?: boolean;
  title?: string;
  description?: string;
  /** Keep the selected chips on one line and scroll horizontally instead of wrapping. */
  singleLine?: boolean;
}> = ({ entity, id, canEdit = true, title = 'Products', description, singleLine = false }) => {
  const [catalog, setCatalog] = React.useState<Product[]>([]);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  // Products in scope through the account's non-Lost opportunities / projects — shown read-only,
  // only on an account (opportunities and projects tag their own products directly).
  const [inherited, setInherited] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      listProducts(),
      listEntityProducts(entity, id),
      entity === 'account' ? listAccountInheritedProducts(id) : Promise.resolve<Product[]>([]),
    ])
      .then(([all, selected, inheritedRows]) => {
        if (cancelled) return;
        setCatalog(all);
        setSelectedIds(selected.map((product) => product.id));
        setInherited(inheritedRows);
      })
      .catch((cause) => {
        if (!cancelled) toast.error('Could not load products', { description: cause instanceof Error ? cause.message : undefined });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entity, id]);

  const persist = async (ids: string[]) => {
    const previous = selectedIds;
    setSelectedIds(ids); // optimistic
    try {
      await setEntityProducts(entity, id, ids);
    } catch (cause) {
      setSelectedIds(previous);
      toast.error('Could not save products', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  const create = async (name: string): Promise<Product> => {
    const product = await createProduct(name);
    setCatalog((prev) => (prev.some((entry) => entry.id === product.id) ? prev : [...prev, product]));
    return product;
  };

  return (
    <PortalCard title={title} description={description}>
      {loading ? (
        <PortalSpinner />
      ) : (
        <div className="space-y-3">
          <ProductPicker
            products={catalog}
            selectedIds={selectedIds}
            onChange={persist}
            canEdit={canEdit}
            canCreate={canEdit}
            onCreate={create}
            singleLine={singleLine}
            emptyLabel={canEdit ? 'No products yet — add the ones that apply.' : 'No products tagged.'}
          />
          {inherited.length > 0 && (
            <div className="border-t border-border-color pt-3">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-grey">
                From opportunities &amp; projects
              </div>
              <div className="flex flex-wrap gap-1.5">
                {inherited.map((product) => (
                  <span
                    key={product.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
                    title="Tagged on an opportunity or project on this account"
                  >
                    {product.name}
                    {product.status === 'pending' && <StatusTag tone="amber">pending</StatusTag>}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </PortalCard>
  );
};
