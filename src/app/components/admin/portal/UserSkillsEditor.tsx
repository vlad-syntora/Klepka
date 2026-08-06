import React from 'react';
import { toast } from 'sonner';
import { createProduct, listProducts } from '@/app/lib/portal-api';
import { adminListUserProducts, adminSetUserProducts } from '@/app/lib/portal-admin-api';
import type { Product } from '@/app/lib/portal-types';
import { PortalSpinner } from '@/app/components/portal/PortalUi';
import { ProductPicker } from '@/app/components/portal/ProductPicker';

/**
 * The products a staff member owns (their skills). Admin-only — RLS on portal_user_products also
 * enforces this. New products created here are approved immediately.
 *
 * Two modes:
 * - Persist mode (`userId`): loads the member's current skills and saves on every change.
 * - Draft mode (no `userId`, `value` + `onChange`): a controlled selection with no user row yet,
 *   used while creating a member — the caller applies it once the user is created.
 */
export const UserSkillsEditor: React.FC<{
  userId?: string;
  canEdit?: boolean;
  value?: string[];
  onChange?: (ids: string[]) => void;
}> = ({ userId, canEdit = true, value, onChange }) => {
  const draft = userId === undefined;
  const [catalog, setCatalog] = React.useState<Product[]>([]);
  const [saved, setSaved] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);

  const selectedIds = draft ? value ?? [] : saved;

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([listProducts(), draft ? Promise.resolve([] as Product[]) : adminListUserProducts(userId)])
      .then(([all, skills]) => {
        if (cancelled) return;
        setCatalog(all);
        if (!draft) setSaved(skills.map((product) => product.id));
      })
      .catch((cause) => {
        if (!cancelled) toast.error('Could not load skills', { description: cause instanceof Error ? cause.message : undefined });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, draft]);

  const persist = async (ids: string[]) => {
    if (draft) {
      onChange?.(ids);
      return;
    }
    const previous = saved;
    setSaved(ids);
    try {
      await adminSetUserProducts(userId, ids);
    } catch (cause) {
      setSaved(previous);
      toast.error('Could not save skills', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  const create = async (name: string): Promise<Product> => {
    const product = await createProduct(name);
    setCatalog((prev) => (prev.some((entry) => entry.id === product.id) ? prev : [...prev, product]));
    return product;
  };

  if (loading) return <PortalSpinner />;

  return (
    <ProductPicker
      products={catalog}
      selectedIds={selectedIds}
      onChange={persist}
      canEdit={canEdit}
      canCreate={canEdit}
      onCreate={create}
      emptyLabel={canEdit ? 'No skills yet — add the products this person owns.' : 'No skills set.'}
    />
  );
};
