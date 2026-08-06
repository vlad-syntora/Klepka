import React from 'react';
import { Plus, X } from 'lucide-react';
import type { Product } from '@/app/lib/portal-types';
import { PortalButton, StatusTag, inputClass } from '@/app/components/portal/PortalUi';
import { cn } from '@/app/components/ui/utils';

interface ProductPickerProps {
  /** The full catalog to choose from. */
  products: Product[];
  /** Currently selected product ids. */
  selectedIds: string[];
  /** Persist a new selection. May be async; the caller owns the selectedIds state. */
  onChange: (ids: string[]) => void | Promise<void>;
  /** When false, renders read-only chips only. */
  canEdit?: boolean;
  /** When true, a no-match query offers to create the product inline. */
  canCreate?: boolean;
  /** Create a product and return it. Required when canCreate is set. */
  onCreate?: (name: string) => Promise<Product>;
  /** Shown (muted) when nothing is selected. */
  emptyLabel?: string;
  /** Keep the selected chips on one line and scroll horizontally instead of wrapping. */
  singleLine?: boolean;
}

/**
 * Multi-select over the product catalog: chips for the current selection, a type-ahead to add
 * more, and (optionally) an inline "create" for a name that isn't in the catalog yet. Used for
 * staff skills and for products on accounts / opportunities / projects, on both sides of the portal.
 */
export const ProductPicker: React.FC<ProductPickerProps> = ({
  products,
  selectedIds,
  onChange,
  canEdit = true,
  canCreate = false,
  onCreate,
  emptyLabel = 'No products yet.',
  singleLine = false,
}) => {
  const [query, setQuery] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  // Products created in this session, merged in so their chips resolve before a parent refresh.
  const [created, setCreated] = React.useState<Product[]>([]);

  const catalog = React.useMemo(() => {
    const byId = new Map<string, Product>();
    for (const product of [...products, ...created]) byId.set(product.id, product);
    return Array.from(byId.values());
  }, [products, created]);

  const byId = React.useMemo(() => new Map(catalog.map((product) => [product.id, product])), [catalog]);
  const selected = selectedIds.map((id) => byId.get(id)).filter((product): product is Product => Boolean(product));

  const trimmed = query.trim();
  const matches = catalog
    .filter((product) => !selectedIds.includes(product.id))
    .filter((product) => product.name.toLowerCase().includes(trimmed.toLowerCase()))
    .slice(0, 8);
  const exactExists = catalog.some((product) => product.name.toLowerCase() === trimmed.toLowerCase());

  const commit = async (ids: string[]) => {
    setBusy(true);
    try {
      await onChange(ids);
    } finally {
      setBusy(false);
    }
  };

  const add = (id: string) => {
    setQuery('');
    if (!selectedIds.includes(id)) void commit([...selectedIds, id]);
  };

  const remove = (id: string) => {
    void commit(selectedIds.filter((existing) => existing !== id));
  };

  const create = async () => {
    if (!onCreate || !trimmed) return;
    setBusy(true);
    try {
      const product = await onCreate(trimmed);
      setCreated((prev) => [...prev, product]);
      setQuery('');
      if (!selectedIds.includes(product.id)) await onChange([...selectedIds, product.id]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      {canEdit && (
        <div className="relative">
          <input
            className={inputClass}
            value={query}
            disabled={busy}
            placeholder="Add a product…"
            onChange={(event) => setQuery(event.target.value)}
          />
          {trimmed && (
            <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border-color bg-card shadow-lg">
              <ul className="max-h-56 overflow-y-auto py-1">
                {matches.map((product) => (
                  <li key={product.id}>
                    <button
                      type="button"
                      onClick={() => add(product.id)}
                      disabled={busy}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-portal-tint/60 disabled:opacity-50"
                    >
                      <span>{product.name}</span>
                      {product.status === 'pending' && <StatusTag tone="amber">pending</StatusTag>}
                    </button>
                  </li>
                ))}
                {matches.length === 0 && !canCreate && (
                  <li className="px-3 py-2 text-sm text-grey">No matching products.</li>
                )}
                {canCreate && !exactExists && (
                  <li className="border-t border-border-color">
                    <PortalButton variant="ghost" className="w-full justify-start" disabled={busy} onClick={create}>
                      <Plus className="h-4 w-4" /> Create “{trimmed}”
                    </PortalButton>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {selected.length > 0 ? (
        <div className={cn('flex gap-1.5', singleLine ? 'flex-nowrap overflow-x-auto pb-1' : 'flex-wrap')}>
          {selected.map((product) => (
            <span
              key={product.id}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full bg-portal-tint px-2.5 py-1 text-xs font-medium text-violet',
                singleLine && 'shrink-0 whitespace-nowrap',
              )}
            >
              {product.name}
              {product.status === 'pending' && <StatusTag tone="amber">pending</StatusTag>}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => remove(product.id)}
                  disabled={busy}
                  aria-label={`Remove ${product.name}`}
                  className="text-violet/70 transition-colors hover:text-violet disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-grey">{emptyLabel}</p>
      )}
    </div>
  );
};
