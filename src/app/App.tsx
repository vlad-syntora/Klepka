import React, { useEffect } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Toaster } from './components/ui/sonner';
import { Home } from './pages/Home';
import { Partners } from './pages/Partners';
import { Pricing } from './pages/Pricing';
import { About } from './pages/About';
import { Careers } from './pages/Careers';
import { Products } from './pages/Products';
import { FEC } from './pages/FEC';
import { RPLC } from './pages/RPLC';
import { URM } from './pages/URM';
import { FounderCardPage } from './pages/FounderCardPage';
import { Articles } from './pages/Articles';
import { ArticlePage } from './pages/ArticlePage';
import { AdminGuard } from './components/admin/AdminGuard';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminLogin } from './pages/admin/AdminLogin';
import { AdminArticles } from './pages/admin/AdminArticles';
import { AdminArticleEditor } from './pages/admin/AdminArticleEditor';
import { AdminAuthors } from './pages/admin/AdminAuthors';
import { AdminComments } from './pages/admin/AdminComments';
import { AdminAccounts } from './pages/admin/portal/AdminAccounts';
import { AdminAccountWorkspace } from './pages/admin/portal/AdminAccountWorkspace';
import { ClientPreview } from './pages/admin/portal/ClientPreview';
import { AdminPortalTeam } from './pages/admin/portal/AdminPortalTeam';
import { AdminPortalFeedback } from './pages/admin/portal/AdminPortalFeedback';
import { PortalUserProvider } from './components/portal/PortalUserProvider';
import { InternalGuard, PortalGuard } from './components/portal/PortalGuard';
import { PortalLayout } from './components/portal/PortalLayout';
import { PortalLogin } from './pages/portal/PortalLogin';
import { PortalDashboard } from './pages/portal/PortalDashboard';
import { PortalStart } from './pages/portal/PortalStart';
import { PortalIntake } from './pages/portal/PortalIntake';
import { PortalPipeline } from './pages/portal/PortalPipeline';
import { PortalPayments } from './pages/portal/PortalPayments';
import { PortalProject } from './pages/portal/PortalProject';
import { PortalNotifications } from './pages/portal/PortalNotifications';
import { PortalSettings } from './pages/portal/PortalSettings';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function AppLayout() {
  const { pathname } = useLocation();
  const isCardPage = pathname.startsWith('/card/');
  const isAdminPage = pathname.startsWith('/admin');
  const isPortalPage = pathname.startsWith('/portal');

  if (isCardPage) {
    return (
      <Routes>
        <Route path="/card/:slug" element={<FounderCardPage />} />
      </Routes>
    );
  }

  if (isPortalPage) {
    return (
      <PortalUserProvider>
        <Routes>
          <Route path="/portal/login" element={<PortalLogin />} />
          <Route
            path="/portal"
            element={
              <PortalGuard>
                <PortalLayout />
              </PortalGuard>
            }
          >
            <Route index element={<PortalDashboard />} />
            <Route path="start" element={<PortalStart />} />
            <Route path="intake" element={<PortalIntake />} />
            <Route path="pipeline" element={<PortalPipeline />} />
            <Route path="payments" element={<PortalPayments />} />
            <Route path="project" element={<PortalProject />} />
            <Route path="notifications" element={<PortalNotifications />} />
            <Route path="settings" element={<PortalSettings />} />
            <Route path="*" element={<Navigate to="/portal" replace />} />
          </Route>
        </Routes>
      </PortalUserProvider>
    );
  }

  if (isAdminPage) {
    return (
      <PortalUserProvider>
        <Routes>
          <Route path="/admin/login" element={<AdminLogin />} />
          {/* Full-screen client preview — internal-guarded, but outside AdminLayout so it renders
              as the real portal for screen-sharing on demo calls. */}
          <Route
            path="/admin/portal/accounts/:id/preview/*"
            element={
              <AdminGuard>
                <InternalGuard>
                  <ClientPreview />
                </InternalGuard>
              </AdminGuard>
            }
          />
          <Route
            path="/admin"
            element={
              <AdminGuard>
                <InternalGuard>
                  <AdminLayout />
                </InternalGuard>
              </AdminGuard>
            }
          >
            <Route index element={<Navigate to="/admin/articles" replace />} />
            <Route path="articles" element={<AdminArticles />} />
            <Route path="articles/new" element={<AdminArticleEditor />} />
            <Route path="articles/:id" element={<AdminArticleEditor />} />
            <Route path="authors" element={<AdminAuthors />} />
            <Route path="comments" element={<AdminComments />} />
            <Route path="portal" element={<Outlet />}>
              <Route index element={<Navigate to="/admin/portal/accounts" replace />} />
              <Route path="accounts" element={<AdminAccounts />} />
              <Route path="accounts/:id" element={<AdminAccountWorkspace />} />
              <Route path="team" element={<AdminPortalTeam />} />
              <Route path="feedback" element={<AdminPortalFeedback />} />
            </Route>
          </Route>
        </Routes>
      </PortalUserProvider>
    );
  }

  return (
    <div className="min-h-screen bg-white text-foreground">
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/partners" element={<Partners />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/about" element={<About />} />
          <Route path="/careers" element={<Careers />} />
          <Route path="/products" element={<Products />} />
          <Route path="/fec" element={<FEC />} />
          <Route path="/rplc" element={<RPLC />} />
          <Route path="/urm" element={<URM />} />
          <Route path="/articles" element={<Articles />} />
          <Route path="/articles/:slug" element={<ArticlePage />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <HelmetProvider>
      <Router>
        <ScrollToTop />
        <AppLayout />
        <Toaster />
      </Router>
    </HelmetProvider>
  );
}

export default App;
