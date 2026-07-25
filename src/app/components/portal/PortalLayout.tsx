import React from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  CalendarDays,
  ClipboardList,
  FileText,
  Gauge,
  Handshake,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareHeart,
  Settings,
  Sparkles,
  Wallet,
  X,
} from 'lucide-react';
import { SEOHead } from '@/app/components/SEOHead';
import { PortalDataContext, usePortalDataState } from '@/app/hooks/use-portal-data';
import { usePortalUser } from '@/app/hooks/use-portal-user';
import { getSupabase } from '@/app/lib/supabase';
import { prettyName } from '@/app/lib/portal-format';
import { cn } from '@/app/components/ui/utils';
import { ErrorNote, PortalSpinner } from './PortalUi';
import { MODULE_LABELS, ROLE_LABELS } from '@/app/lib/portal-types';
import {
  PHASE_LABELS,
  derivePhase,
  visibleSections,
  type PortalSection,
} from '@/app/lib/portal-phase';
import logoPurple from '@/assets/85bd7ec43f69e1c0fc0ed1f1121c7466d87fd6c5.png';

interface NavEntry {
  to: string;
  label: string;
  icon: React.ElementType;
  section: PortalSection;
  badge?: number;
}

export const PortalLayout: React.FC = () => {
  const { user } = usePortalUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const data = usePortalDataState(user?.account_id ?? null);

  React.useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  if (!user) return null;

  const snapshot = data.snapshot;
  const openOffers = snapshot?.offers.filter((offer) => offer.status === 'sent').length ?? 0;
  const toSign = snapshot?.documents.filter((doc) => doc.status === 'awaiting_signature').length ?? 0;
  const unread =
    snapshot?.activity.filter((entry) => !entry.read_by.includes(user.id)).length ?? 0;

  const intakeOpen =
    snapshot?.intake.filter(
      (item) => item.owner_side === 'client' && !['submitted', 'in_review', 'approved'].includes(item.status),
    ).length ?? 0;

  const allEntries: NavEntry[] = [
    { to: '/portal', label: 'Dashboard', icon: LayoutDashboard, section: 'start' },
    { to: '/portal/start', label: 'Getting started', icon: Sparkles, section: 'start' },
    { to: '/portal/intake', label: 'Information gathering', icon: ClipboardList, section: 'intake', badge: intakeOpen },
    { to: '/portal/pipeline', label: MODULE_LABELS.pipeline, icon: Handshake, section: 'pipeline', badge: openOffers },
    { to: '/portal/calls', label: MODULE_LABELS.calls, icon: CalendarDays, section: 'calls' },
    { to: '/portal/documents', label: MODULE_LABELS.documents, icon: FileText, section: 'documents', badge: toSign },
    { to: '/portal/payments', label: MODULE_LABELS.payments, icon: Wallet, section: 'payments' },
    { to: '/portal/project', label: MODULE_LABELS.project, icon: Gauge, section: 'project' },
    { to: '/portal/feedback', label: MODULE_LABELS.feedback, icon: MessageSquareHeart, section: 'feedback' },
    { to: '/portal/notifications', label: 'Notifications', icon: Bell, section: 'notifications', badge: unread },
    { to: '/portal/settings', label: 'Account Settings', icon: Settings, section: 'settings' },
  ];

  // Phase decides what is relevant now, role decides what they may ever see. Computed here
  // rather than via usePortalPhase() because this component is what provides the data context.
  const phase = snapshot ? derivePhase(snapshot.account, snapshot.opportunities) : null;
  const allowed = phase ? visibleSections(phase, user.role, user.module_access) : [];
  const navEntries = allEntries.filter((entry) => allowed.includes(entry.section));

  const handleSignOut = async () => {
    await getSupabase().auth.signOut();
    navigate('/portal/login');
  };

  const initials = (snapshot?.account.name ?? user.full_name)
    .split(' ')
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <PortalDataContext.Provider value={data}>
      <div className="flex min-h-screen bg-off-white">
        <SEOHead title="Client Portal" description="Klepka client portal" noindex />

        {menuOpen && (
          <button
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          />
        )}

        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-40 flex w-60 shrink-0 flex-col bg-violet text-white transition-transform lg:translate-x-0',
            menuOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="flex h-16 items-center justify-between border-b border-white/15 px-5">
            <img src={logoPurple} alt="KLEPKA" className="h-7 w-auto brightness-0 invert" />
            <span className="text-xs uppercase tracking-widest text-accent-yellow">Portal</span>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
            {navEntries.map((entry) => (
              <NavLink
                key={entry.to}
                to={entry.to}
                end={entry.to === '/portal'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                    isActive ? 'bg-white font-medium text-violet' : 'text-white/80 hover:bg-white/10 hover:text-white',
                  )
                }
              >
                <entry.icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                {entry.badge ? (
                  <span className="rounded-full bg-accent-yellow px-2 py-0.5 text-[11px] font-bold text-violet">
                    {entry.badge}
                  </span>
                ) : null}
              </NavLink>
            ))}
          </nav>

          <div className="border-t border-white/15 px-5 py-3 text-xs text-white/70">
            Signed in as
            <div className="truncate text-sm font-medium text-white">{prettyName(user.full_name)}</div>
            <div className="truncate">{ROLE_LABELS[user.role]}</div>
          </div>

          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 border-t border-white/15 px-5 py-3.5 text-sm text-accent-yellow transition-colors hover:bg-white/10"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col lg:ml-60">
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border-color bg-card px-4 lg:px-8">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setMenuOpen((open) => !open)}
                className="rounded-lg p-2 text-violet hover:bg-portal-tint lg:hidden"
                aria-label="Toggle navigation"
              >
                {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              <h1 className="truncate text-base font-semibold text-foreground">
                {navEntries.find((entry) =>
                  entry.to === '/portal' ? location.pathname === '/portal' : location.pathname.startsWith(entry.to),
                )?.label ?? 'Portal'}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              {phase && (
                <span className="hidden rounded-full bg-portal-tint px-2.5 py-1 text-[11px] font-semibold text-violet md:inline">
                  {PHASE_LABELS[phase]}
                </span>
              )}
              <span className="hidden truncate text-sm text-grey sm:block">{snapshot?.account.name}</span>
              {snapshot?.account.logo_url ? (
                <img
                  src={snapshot.account.logo_url}
                  alt={snapshot.account.name}
                  className="h-9 w-9 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet text-sm font-semibold text-white">
                  {initials || '—'}
                </span>
              )}
            </div>
          </header>

          <main className="min-w-0 flex-1 px-4 py-6 lg:px-8">
            {data.loading ? (
              <PortalSpinner label="Loading your workspace…" />
            ) : data.error ? (
              <ErrorNote>{data.error}</ErrorNote>
            ) : (
              <Outlet />
            )}
          </main>
        </div>
      </div>
    </PortalDataContext.Provider>
  );
};
