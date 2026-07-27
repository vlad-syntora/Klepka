import React from 'react';
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { PortalUserContext } from '@/app/hooks/use-portal-user';
import { PortalLayout } from '@/app/components/portal/PortalLayout';
import { PortalDashboard } from '@/app/pages/portal/PortalDashboard';
import { PortalStart } from '@/app/pages/portal/PortalStart';
import { PortalIntake } from '@/app/pages/portal/PortalIntake';
import { PortalPipeline } from '@/app/pages/portal/PortalPipeline';
import { PortalPayments } from '@/app/pages/portal/PortalPayments';
import { PortalProject } from '@/app/pages/portal/PortalProject';
import { PortalNotifications } from '@/app/pages/portal/PortalNotifications';
import { PortalSettings } from '@/app/pages/portal/PortalSettings';
import { PORTAL_MODULES, type PortalUser } from '@/app/lib/portal-types';

/**
 * Admin "View as client" — renders the real client portal for one account so the team can screen-
 * share it during demo calls. It is mounted inside the admin guards (internal-only), then supplies a
 * synthetic client_admin identity into PortalUserContext so PortalLayout loads and gates the account
 * exactly as the client would. The data is still fetched with the admin's own RLS, so the layout is
 * told this is a preview and re-applies the client-visibility filter (see filterSnapshotForClient).
 */
export const ClientPreview: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const base = `/admin/portal/accounts/${id}/preview`;

  // A stand-in client_admin with every module so the nav mirrors a fully-provisioned client. It is
  // never persisted or sent anywhere — it only drives which sections PortalLayout renders.
  const previewUser = React.useMemo<PortalUser>(
    () => ({
      id: `preview:${id}`,
      auth_user_id: null,
      email: 'preview@klepka.solutions',
      full_name: 'Client preview',
      role: 'client_admin',
      account_id: id,
      module_access: [...PORTAL_MODULES],
      title: null,
      status: 'active',
      last_login_at: null,
      created_at: new Date().toISOString(),
    }),
    [id],
  );

  const contextValue = React.useMemo(
    () => ({
      user: previewUser,
      loading: false,
      error: null,
      isInternal: false,
      isAdmin: false,
      signedIn: true,
      refresh: () => {},
    }),
    [previewUser],
  );

  const layout = (
    <PortalLayout basePath={base} preview={{ onExit: () => navigate(`/admin/portal/accounts/${id}`) }} />
  );

  return (
    <PortalUserContext.Provider value={contextValue}>
      <Routes>
        <Route element={layout}>
          <Route index element={<PortalDashboard />} />
          <Route path="start" element={<PortalStart />} />
          <Route path="intake" element={<PortalIntake />} />
          <Route path="pipeline" element={<PortalPipeline />} />
          <Route path="payments" element={<PortalPayments />} />
          <Route path="project" element={<PortalProject />} />
          <Route path="notifications" element={<PortalNotifications />} />
          <Route path="settings" element={<PortalSettings />} />
          <Route path="*" element={<Navigate to={base} replace />} />
        </Route>
      </Routes>
    </PortalUserContext.Provider>
  );
};
