import React from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { FileText, LogOut, MessageSquare, Users } from 'lucide-react';
import { SEOHead } from '../SEOHead';
import { getSupabase } from '@/app/lib/supabase';
import logoPurple from '../../../assets/85bd7ec43f69e1c0fc0ed1f1121c7466d87fd6c5.png';

const navItems = [
  { name: 'Articles', path: '/admin/articles', icon: FileText },
  { name: 'Authors', path: '/admin/authors', icon: Users },
  { name: 'Comments', path: '/admin/comments', icon: MessageSquare },
];

export const AdminLayout: React.FC = () => {
  const navigate = useNavigate();

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

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
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
