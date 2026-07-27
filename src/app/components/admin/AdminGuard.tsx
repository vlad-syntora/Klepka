import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthSession } from '@/app/hooks/use-auth-session';

export const AdminGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, loading } = useAuthSession();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-off-white">
        <div className="w-8 h-8 border-2 border-violet border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
};
