import React from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Building2,
  CalendarDays,
  CalendarOff,
  FileText,
  Landmark,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  MessageSquareHeart,
  Package,
  SlidersHorizontal,
  Users,
  UsersRound,
  Wallet,
} from 'lucide-react';
import { SEOHead } from '../SEOHead';
import { getSupabase } from '@/app/lib/supabase';
import { usePortalUser } from '@/app/hooks/use-portal-user';
import { canManageSalesSettings, isImplementer, type PortalRole } from '@/app/lib/portal-types';
import logoPurple from '../../../assets/85bd7ec43f69e1c0fc0ed1f1121c7466d87fd6c5.png';

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
  /**
   * When set, the item is shown only if this passes for the signed-in user's role:
   *   - 'sales-settings' — internal roles that manage sales defaults
   *   - 'finance' — full payroll (portal admin only)
   *   - 'own-finance' — a person's own salary, shown to non-admin staff (admins use the full page)
   */
  gate?: 'sales-settings' | 'finance' | 'own-finance';
  /** Hidden from the delivery-only Implementer role (Content, Products). */
  hideFromImplementer?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
  /** The whole group is hidden from the Implementer role (Content). */
  hideFromImplementer?: boolean;
}

const navGroups: NavGroup[] = [
  {
    title: 'Client portal',
    items: [
      { name: 'Dashboard', path: '/admin/portal/dashboard', icon: LayoutDashboard },
      // Everyone takes leave — visible to all staff (self-service); admins approve and manage all of it.
      { name: 'Time Off', path: '/admin/portal/time-off', icon: CalendarOff },
      // Every staffer can see their own pay; admins get the full Salaries page below instead.
      { name: 'My Salary', path: '/admin/portal/my-salary', icon: Wallet, gate: 'own-finance' },
      { name: 'Public Holidays', path: '/admin/portal/holidays', icon: CalendarDays, hideFromImplementer: true },
      { name: 'Accounts', path: '/admin/portal/accounts', icon: Building2 },
      { name: 'Products', path: '/admin/portal/products', icon: Package, hideFromImplementer: true },
      { name: 'Sales Process Settings', path: '/admin/portal/settings', icon: SlidersHorizontal, gate: 'sales-settings' },
      { name: 'Feedback', path: '/admin/portal/feedback', icon: MessageSquareHeart },
      // Klepka team, customer users and employee teams — folded into one tabbed page.
      { name: 'Users & Teams', path: '/admin/portal/team', icon: UsersRound },
      // Financial accounting hub — P&L, Overhead, Salaries and Invoices tabs (0056). Admin-only for now
      // (RLS enforces it too); a broader grant can widen this later.
      { name: 'Finance', path: '/admin/portal/finance', icon: Landmark, gate: 'finance' },
    ],
  },
  {
    title: 'Content',
    hideFromImplementer: true,
    items: [
      { name: 'Articles', path: '/admin/articles', icon: FileText },
      { name: 'Authors', path: '/admin/authors', icon: Users },
      { name: 'Comments', path: '/admin/comments', icon: MessageSquare },
    ],
  },
];

export const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const { user } = usePortalUser();
  const role: PortalRole | null = user?.role ?? null;
  const canManageSettings = role ? canManageSalesSettings(role) : false;
  // Finance (Salaries) is portal-admin only for now.
  const canFinance = role === 'portal_admin';
  const implementer = role ? isImplementer(role) : false;

  const handleSignOut = async () => {
    await getSupabase().auth.signOut();
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen bg-off-white flex">
      <SEOHead title="Admin" description="Klepka admin panel" noindex />

      <aside className="w-56 shrink-0 bg-violet text-white flex flex-col fixed inset-y-0 left-0 z-40">
        <Link to="/" className="flex items-center px-5 h-16 border-b border-white/20">
          <img src={logoPurple} alt="KLEPKA" className="h-8 w-auto brightness-0 invert" />
        </Link>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {navGroups
            .filter((group) => !(group.hideFromImplementer && implementer))
            .map((group) => (
            <div key={group.title} className="space-y-1">
              <div className="px-3 pb-1 text-[11px] uppercase tracking-widest text-white/50">{group.title}</div>
              {group.items
                .filter((item) => {
                  if (!item.gate) return true;
                  if (item.gate === 'sales-settings') return canManageSettings;
                  if (item.gate === 'finance') return canFinance;
                  // 'own-finance' — a person's own salary, for non-admin staff only.
                  return !canFinance;
                })
                .filter((item) => !(item.hideFromImplementer && implementer))
                .map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${
                      isActive ? 'bg-white text-violet' : 'text-accent-yellow hover:bg-white/10'
                    }`
                  }
                >
                  <item.icon className="w-4 h-4" />
                  {item.name}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-6 py-4 text-sm text-accent-yellow hover:bg-white/10 transition-colors border-t border-white/20"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </aside>

      <main className="flex-1 ml-56 p-6 lg:p-8 min-w-0">
        <Outlet />
      </main>
    </div>
  );
};
