import React, { useEffect } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Home } from './pages/Home';
import { Partners } from './pages/Partners';
import { Pricing } from './pages/Pricing';
import { About } from './pages/About';
import { Careers } from './pages/Careers';
import { FounderCardPage } from './pages/FounderCardPage';

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

  if (isCardPage) {
    return (
      <Routes>
        <Route path="/card/:slug" element={<FounderCardPage />} />
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
      </Router>
    </HelmetProvider>
  );
}

export default App;