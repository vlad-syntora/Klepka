import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { Button } from './Button';
import { Menu, X } from 'lucide-react';
import logoPurple from "../../assets/85bd7ec43f69e1c0fc0ed1f1121c7466d87fd6c5.png";
import logoLight from "../../assets/d1e97a210363d7653bba220190650a54a2d2ee58.png";

export const Header: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { name: 'Home', path: '/' },
    { name: 'Partners', path: '/partners' },
    { name: 'Pricing', path: '/pricing' },
    { name: 'About', path: '/about' },
    { name: 'Careers', path: '/careers' },
  ];

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-violet text-accent-yellow shadow-md border-b border-border-color'
          : 'bg-white'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <img 
              src={scrolled ? logoLight : logoPurple} 
              alt="KLEPKA" 
              className="h-10 w-auto transition-opacity duration-300" 
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  location.pathname === item.path
                    ? 'bg-white text-violet'
                    : scrolled
                      ? 'text-[#F9EDBD] hover:bg-white hover:text-violet'
                      : 'text-black hover:bg-white hover:text-violet'
                }`}
              >
                {item.name}
              </Link>
            ))}
          </nav>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg hover:bg-white transition-colors"
          >
            {mobileMenuOpen ? (
              <X className={`w-6 h-6 ${scrolled ? 'text-[#F9EDBD]' : 'text-violet'}`} />
            ) : (
              <Menu className={`w-6 h-6 ${scrolled ? 'text-[#F9EDBD]' : 'text-violet'}`} />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={`lg:hidden border-t border-border-color shadow-lg ${
            scrolled ? 'bg-white' : 'bg-white'
          }`}
        >
          <nav className="px-4 py-4 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-4 py-3 rounded-lg transition-colors ${
                  location.pathname === item.path
                    ? 'bg-white text-violet'
                    : 'text-black hover:bg-white hover:text-violet'
                }`}
              >
                {item.name}
              </Link>
            ))}
          </nav>
        </motion.div>
      )}
    </motion.header>
  );
};