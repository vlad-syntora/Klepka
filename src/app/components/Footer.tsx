import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Linkedin} from 'lucide-react';
import logo from "../../assets/d1e97a210363d7653bba220190650a54a2d2ee58.png";
import UaIcon from "../../assets/ua.svg";

export const Footer: React.FC = () => {
  const footerLinks = {
    company: [
      { name: 'About', path: '/about' },
      { name: 'Careers', path: '/careers' },
      { name: 'Partners', path: '/partners' },
    ],
    resources: [
      { name: 'Pricing', path: '/pricing' },
    ],
  };

  return (
    <footer className="bg-violet text-off-white border-t border-border-color">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Company Info */}
          <div>
            <div className="flex items-center mb-6">
              <img src={logo} alt="KLEPKA" className="h-10 w-auto brightness-0 invert" />
            </div>
            <p className="text-white mb-4 text-sm leading-relaxed">
              Designing scalable Salesforce CRM systems for revenue teams.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-white hover:text-accent-yellow transition-colors">
                <Linkedin className="w-5 h-5" />
              </a>
              {/*<a href="#" className="text-white hover:text-accent-yellow transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="text-white hover:text-accent-yellow transition-colors">
                <Youtube className="w-5 h-5" />
              </a>
              <a href="#" className="text-white hover:text-accent-yellow transition-colors">
                <Instagram className="w-5 h-5" />
              </a>*/}
            </div>
          </div>

          {/* Company Links */}
          <div>
            <h4 className="font-semibold mb-4 text-off-white">Company</h4>
            <ul className="space-y-2">
              {footerLinks.company.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.path}
                    className="text-sm text-white hover:text-accent-yellow transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources Links */}
          <div>
            <h4 className="font-semibold mb-4 text-off-white">Resources</h4>
            <ul className="space-y-2">
              {footerLinks.resources.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.path}
                    className="text-sm text-white hover:text-accent-yellow transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="font-semibold mb-4 text-off-white">Contact</h4>
            <ul className="space-y-3">
              <li className="flex items-start space-x-3">
                <Mail className="w-5 h-5 text-accent-yellow mt-0.5 flex-shrink-0" />
                <a href="mailto:klepkasolutions@gmail.com" className="text-sm text-white hover:text-accent-yellow transition-colors">
                  klepkasolutions@gmail.com
                </a>
              </li>
              <li className="flex items-start space-x-3">
                <Phone className="w-5 h-5 text-accent-yellow mt-0.5 flex-shrink-0" />
                <a href="tel:+380936453613" className="text-sm text-white hover:text-accent-yellow transition-colors">
                  +38 (093) 645-36-13
                </a>
              </li>
              <li className="flex items-center space-x-3">
                {/* <MapPin className="w-5 h-5 text-accent-yellow mt-0.5 flex-shrink-0" /> */}
                <img src={UaIcon} alt="Ukraine" className="w-5 h-4 mr-2" />
                <span className="text-sm text-white">
                  Odesa, Ukraine
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border-color/20 mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <p className="text-sm text-white">
              © {new Date().getFullYear()} KLEPKA. All rights reserved.
            </p>
            {/*<div className="flex space-x-6">
              <a href="#" className="text-sm text-white hover:text-accent-yellow transition-colors">
                Privacy Policy
              </a>
              <a href="#" className="text-sm text-white hover:text-accent-yellow transition-colors">
                Terms of Service
              </a>
            </div>*/}
          </div>
        </div>
      </div>
    </footer>
  );
};