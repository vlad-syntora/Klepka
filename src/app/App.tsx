import React, { useEffect } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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

  if (isCardPage) {
    return (
      <Routes>
        <Route path="/card/:slug" element={<FounderCardPage />} />
      </Routes>
    );
  }

  if (isAdminPage) {
    return (
      <Routes>
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/admin"
          element={
            <AdminGuard>
              <AdminLayout />
            </AdminGuard>
          }
        >
          <Route index element={<Navigate to="/admin/articles" replace />} />
          <Route path="articles" element={<AdminArticles />} />
          <Route path="articles/new" element={<AdminArticleEditor />} />
          <Route path="articles/:id" element={<AdminArticleEditor />} />
          <Route path="authors" element={<AdminAuthors />} />
          <Route path="comments" element={<AdminComments />} />
        </Route>
      </Routes>
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
