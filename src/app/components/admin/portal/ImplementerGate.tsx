import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePortalUser } from '@/app/hooks/use-portal-user';
import { isImplementer } from '@/app/lib/portal-types';
import { PortalSpinner } from '@/app/components/portal/PortalUi';

const DASHBOARD_PATH = '/admin/portal/dashboard';

/**
 * Admin landing redirect. The delivery-only Implementer role has no Content section, so it lands on
 * the portal Dashboard; every other internal role keeps the Articles home. Waits for the profile to
 * load so the role is known before choosing (avoids a flash-redirect).
 */
export const AdminHomeRedirect: React.FC = () => {
  const { user, loading } = usePortalUser();
  if (loading) return <PortalSpinner label="Loading…" />;
  const target = user && isImplementer(user.role) ? DASHBOARD_PATH : '/admin/articles';
  return <Navigate to={target} replace />;
};

/**
 * Route guard that keeps the Implementer role out of sections it has no access to (Content, Products),
 * sending it to the Dashboard instead. Other roles pass through untouched.
 */
export const RequireNotImplementer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = usePortalUser();
  if (loading) return <PortalSpinner label="Loading…" />;
  if (user && isImplementer(user.role)) return <Navigate to={DASHBOARD_PATH} replace />;
  return <>{children}</>;
};
