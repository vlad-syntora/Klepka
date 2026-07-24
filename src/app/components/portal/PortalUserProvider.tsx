import React from 'react';
import { PortalUserContext, usePortalUserState } from '@/app/hooks/use-portal-user';

/** Resolves the signed-in user's portal identity once for the whole portal/admin route tree. */
export const PortalUserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const state = usePortalUserState();
  return <PortalUserContext.Provider value={state}>{children}</PortalUserContext.Provider>;
};
