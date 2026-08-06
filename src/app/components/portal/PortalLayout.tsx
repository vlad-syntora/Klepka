import React from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  CalendarPlus,
  ClipboardList,
  Eye,
  Handshake,
  LayoutDashboard,
  LogOut,
  Menu,
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
import { BookCallButton } from '@/app/components/portal/BookCallButton';
import { CollapsibleCards, ErrorNote, PortalButton, PortalSpinner } from './PortalUi';
import { MODULE_LABELS, ROLE_LABELS } from '@/app/lib/portal-types';
import {
  PHASE_BLURB,
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
  /** Reachable by URL (e.g. from "View all") but not shown in the sidebar. */
  hidden?: boolean;
}

interface PortalLayoutProps {
  /** Root path the nav links hang off. Defaults to the real portal; the admin preview overrides it. */
  basePath?: string;
  /** When set, renders the "viewing as client" banner + an exit button instead of Sign out. */
  preview?: { onExit: () => void };
}

export const PortalLayout: React.FC<PortalLayoutProps> = ({ basePath = '/portal', preview }) => {
  const { user } = usePortalUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const data = usePortalDataState(user?.account_id ?? null, Boolean(preview));
  const path = (sub: string) => (sub ? `${basePath}/${sub}` : basePath);

  React.useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  if (!user) return null;

  const snapshot = data.snapshot;
  const openOffers = snapshot?.offers.filter((offer) => offer.status === 'sent').length ?? 0;
  const unread =
    snapshot?.activity.filter((entry) => !entry.read_by.includes(user.id)).length ?? 0;

  const intakeOpen =
    snapshot?.intake.filter(
      (item) => item.owner_side === 'client' && !['submitted', 'in_review', 'approved'].includes(item.status),
    ).length ?? 0;

  // Nothing left to gather once every intake step is approved — hide the page entirely then.
  const intakePending = snapshot?.intake.filter((item) => item.status !== 'approved').length ?? 0;

  const allEntries: NavEntry[] = [
    { to: path(''), label: 'Dashboard', icon: LayoutDashboard, section: 'start' },
    // Pipeline & Offers and the Project Tracker now live together on one page (two tabs), reached
    // via this single entry. It keeps the old opportunity page's identity — the "Pipeline & Offers"
    // label and icon clients already know — with the pending-offer badge riding along.
    { to: path('project'), label: MODULE_LABELS.pipeline, icon: Handshake, section: 'project', badge: openOffers },
    { to: path('payments'), label: MODULE_LABELS.payments, icon: Wallet, section: 'payments' },
    { to: path('intake'), label: 'Information gathering', icon: ClipboardList, section: 'intake', badge: intakeOpen },
    { to: path('start'), label: 'Presentations', icon: Sparkles, section: 'start' },
    { to: path('notifications'), label: 'Notifications', icon: Bell, section: 'notifications', badge: unread, hidden: true },
    { to: path('settings'), label: 'Account Settings', icon: Settings, section: 'settings' },
  ];

  // Phase decides what is relevant now, role decides what they may ever see. Computed here
  // rather than via usePortalPhase() because this component is what provides the data context.
  const phase = snapshot ? derivePhase(snapshot.account, snapshot.opportunities) : null;
  const allowed = phase ? visibleSections(phase, user.role, user.module_access) : [];
  const navEntries = allEntries.filter((entry) => {
    // The Project entry doubles as the Pipeline & Offers home, so show it whenever either applies.
    if (entry.section === 'project') return allowed.includes('project') || allowed.includes('pipeline');
    // Once every information-gathering step is approved there's nothing to show — drop the entry.
    if (entry.section === 'intake') return allowed.includes('intake') && intakePending > 0;
    return allowed.includes(entry.section);
  });

  // The welcome banner is the dashboard's page header — rendered here (layout chrome) so it sits
  // above the collapsible content and isn't itself collapsible.
  const isDashboard = location.pathname === basePath;
  const openIntakeCount =
    snapshot?.intake.filter((item) => item.owner_side === 'client' && item.status !== 'approved').length ?? 0;

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
            {navEntries.filter((entry) => !entry.hidden).map((entry) => (
              <NavLink
                key={entry.to}
                to={entry.to}
                end={entry.to === basePath}
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

          {preview ? (
            <button
              onClick={preview.onExit}
              className="flex items-center gap-3 border-t border-white/15 px-5 py-3.5 text-sm text-accent-yellow transition-colors hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" />
              Return to admin panel
            </button>
          ) : (
            <>
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
            </>
          )}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col lg:ml-60">
          {preview && (
            <div className="flex flex-wrap items-center justify-between gap-2 bg-accent-yellow px-4 py-2 text-sm font-medium text-violet lg:px-8">
              <span className="flex items-center gap-2">
                <Eye className="h-4 w-4 shrink-0" />
                Client preview
              </span>
              <button
                onClick={preview.onExit}
                className="inline-flex items-center gap-1.5 rounded-lg bg-violet px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-violet/90"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Return to admin panel
              </button>
            </div>
          )}
          <header className="sticky top-0 z-20 flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-border-color bg-card px-4 py-3 lg:px-8">
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
                  entry.to === basePath ? location.pathname === basePath : location.pathname.startsWith(entry.to),
                )?.label ?? 'Portal'}
              </h1>
            </div>

            {isDashboard && snapshot && phase && (
              <div className="order-last flex w-full flex-col gap-2 rounded-xl bg-gradient-to-br from-violet to-[#9C63C9] px-4 py-2.5 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between lg:order-none lg:w-auto lg:flex-1">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold">Welcome, {snapshot.account.name}</h2>
                  <p className="mt-0.5 max-w-2xl text-xs text-white/90">{PHASE_BLURB[phase]}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                  <BookCallButton variant="primary" className="bg-white text-violet hover:bg-accent-yellow">
                    <CalendarPlus className="h-4 w-4" /> Book a call
                  </BookCallButton>
                  {allowed.includes('intake') && openIntakeCount > 0 && (
                    <Link to={path('intake')}>
                      <PortalButton className="border border-white/60 bg-transparent text-white hover:bg-white/15">
                        {openIntakeCount} item{openIntakeCount > 1 ? 's' : ''} need your input
                      </PortalButton>
                    </Link>
                  )}
                </div>
              </div>
            )}

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

          <main className="min-w-0 flex-1 px-4 pb-6 pt-1 lg:px-8">
            {data.loading ? (
              <PortalSpinner label="Loading your workspace…" />
            ) : data.error ? (
              <ErrorNote>{data.error}</ErrorNote>
            ) : (
              <CollapsibleCards scope={`${user.account_id ?? 'na'}:${location.pathname}`} defaultOpen>
                <Outlet />
              </CollapsibleCards>
            )}
          </main>
        </div>
      </div>
    </PortalDataContext.Provider>
  );
};
