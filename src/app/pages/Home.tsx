import React from "react";
import { motion } from "motion/react";
import { SEOHead } from "../components/SEOHead";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Input, TextArea } from "../components/Input";
import {
  ArrowRight,
  CircleCheck,
  Zap,
  Target,
  Users,
  Shield,
  Database,
} from "lucide-react";
import { Link } from "react-router-dom";
import Slider from "react-slick";
import { CrmChallengesForm } from "../components/CrmChallengesForm";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

import { certificatesConfig, certFullNames } from "../../config/certificatesConfig";
import type { CertKey } from "../../config/certificatesConfig";
import { foundersConfig, teamsConfig } from "../../config/teamConfig";
import salesforceLogo from "../../assets/cbbb4ce1dcbf542b256647147b8d01b2362fdc18.png";
import docusignLogo from "../../assets/25155f2a11a011d3b70848d424b874c0c621c32b.png";
import slackLogo from "../../assets/ed122e531258ed50ebab3a297e8ca6dba7ae30f2.png";
import formTitanLogo from "../../assets/492d9bc4032f73ffbe046c5c7e9cb125b5d3ef6b.png";
import tableauLogo from "../../assets/4380d03553cab5a60c1283a76c56f2d79493987a.png";

export const Home: React.FC = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sliderRef = React.useRef<any>(null);
  const services = [
    {
      category: "Implementation",
      title: "Salesforce Implementation",
      description:
        "Sales Cloud, Service Cloud, Experience Cloud, Agentforce — end-to-end setup and configuration tailored to your business.",
      icon: <Target className="w-8 h-8 text-black" />,
    },
    {
      category: "Support",
      title: "Support & Administration",
      description:
        "Certified Salesforce administrators on an outsource or outstaff basis. Day-to-day platform management, configuration, and improvements — without hiring in-house.",
      icon: <Shield className="w-8 h-8 text-black" />,
    },
    {
      category: "CRM Audit",
      title: "CRM Audit",
      description:
        "Org health assessment, security review, technical debt analysis, and prioritized recommendations to stabilize and improve your Salesforce.",
      icon: <CircleCheck className="w-8 h-8 text-black" />,
    },
    {
      category: "Trainings",
      title: "Training & Enablement",
      description:
        "Role-based Salesforce training — from single-user onboarding to enterprise-wide enablement programs with full materials.",
      icon: <Users className="w-8 h-8 text-black" />,
    },
    {
      category: "Migration",
      title: "Migration",
      description:
        "Data migration to Salesforce, Classic to Lightning, and org mergers — structured, validated, and low-risk delivery.",
      icon: <Database className="w-8 h-8 text-black" />,
    },
    {
      category: "Optimizations",
      title: "Flow Optimizations",
      description:
        "Flow refactoring, Workflow Rule and Process Builder migration to Flow — reduce technical debt and future change costs.",
      icon: <Zap className="w-8 h-8 text-black" />,
    },
  ];

  const techStack = [
    { name: "Salesforce", logo: salesforceLogo },
    { name: "DocuSign", logo: docusignLogo },
    { name: "Slack", logo: slackLogo },
    { name: "FormTitan", logo: formTitanLogo },
    { name: "Tableau", logo: tableauLogo },
  ];

  const computeSlidesToShow = (w: number) => {
    if (w <= 480) return 2;
    if (w <= 768) return 2;
    if (w <= 1024) return 3;
    return 5;
  };

  const baseSettings = {
    dots: false,
    infinite: true,
    speed: 600,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 3000,
    cssEase: "cubic-bezier(0.4, 0, 0.2, 1)",
    pauseOnHover: true,
  };

  const [showAllCerts, setShowAllCerts] = React.useState(false);

  const [sliderSettings, setSliderSettings] = React.useState(() => ({
    ...baseSettings,
    slidesToShow:
      typeof window !== "undefined"
        ? computeSlidesToShow(window.innerWidth)
        : 5,
  }));

  React.useEffect(() => {
    const handleResize = () => {
      const next = computeSlidesToShow(window.innerWidth);
      setSliderSettings((prev) =>
        prev.slidesToShow === next ? prev : { ...prev, slidesToShow: next }
      );
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  React.useEffect(() => {
    const t = setTimeout(() => window.dispatchEvent(new Event("resize")), 50);
    return () => clearTimeout(t);
  }, []);

  const companyCertKeys = Array.from(
    new Set<CertKey>([
      ...foundersConfig.flatMap((f) => f.certs),
      ...teamsConfig.flatMap((t) => t.members.flatMap((m) => m.certs ?? [])),
    ])
  );

  const companyCreds = companyCertKeys.map((certKey) => ({
    "@type": "EducationalOccupationalCredential",
    "name": certFullNames[certKey],
    "credentialCategory": "certification",
    "recognizedBy": { "@type": "Organization", "name": "Salesforce" },
  }));

  const homeJsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": "https://klepka.solutions/#organization",
      "name": "Klepka",
      "url": "https://klepka.solutions",
      "logo": {
        "@type": "ImageObject",
        "url": "https://klepka.solutions/favicon.png"
      },
      "foundingDate": "2018",
      "description": "Klepka is a Salesforce consulting company delivering end-to-end CRM implementations, integrations, automation, and ongoing support. We provide certified Salesforce administrators, consultants, and architects on an outsource and outstaff basis for SaaS, B2B, and enterprise teams.",
      "knowsAbout": [
        "Salesforce CRM Implementation",
        "Salesforce Integration",
        "Sales Cloud",
        "Service Cloud",
        "Experience Cloud",
        "CRM Audit",
        "Salesforce Automation",
        "CRM Training",
        "Salesforce Administration",
        "Salesforce Staff Augmentation",
        "Salesforce Outsourcing",
        "Salesforce Outstaffing",
        "Salesforce Consulting",
        "Data Cloud",
        "Agentforce"
      ],
      "sameAs": [
        "https://www.linkedin.com/in/sergii-romashov-69b7871a3",
        "https://www.linkedin.com/in/daria-ezerovych-a97a091a4/"
      ],
      "hasCredential": companyCreds,
      "contactPoint": {
        "@type": "ContactPoint",
        "contactType": "sales",
        "areaServed": ["US", "EU"],
        "availableLanguage": "English"
      }
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": "https://klepka.solutions/#website",
      "name": "Klepka",
      "url": "https://klepka.solutions",
      "description": "Salesforce CRM consulting, implementation, outsource administration, and integration services",
      "publisher": { "@id": "https://klepka.solutions/#organization" }
    },
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": "https://klepka.solutions/#homepage",
      "url": "https://klepka.solutions",
      "name": "Klepka — Salesforce CRM Implementation & Integration Services",
      "isPartOf": { "@id": "https://klepka.solutions/#website" },
      "mainEntity": { "@id": "https://klepka.solutions/#organization" },
      "speakable": {
        "@type": "SpeakableSpecification",
        "cssSelector": ["h1", "h2", "h3"]
      }
    },
    {
      "@context": "https://schema.org",
      "@type": "ContactPage",
      "@id": "https://klepka.solutions/#contact",
      "url": "https://klepka.solutions/#contact",
      "name": "Contact Klepka",
      "description": "Contact Klepka to discuss your Salesforce CRM project, outsource administration, or consulting needs.",
      "isPartOf": { "@id": "https://klepka.solutions/#website" },
      "mainEntity": { "@id": "https://klepka.solutions/#organization" }
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": "Klepka Salesforce Services",
      "description": "Full-cycle Salesforce delivery services offered by Klepka",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "item": {
            "@type": "Service",
            "name": "Salesforce Implementation",
            "description": "Sales Cloud, Service Cloud, Experience Cloud, Agentforce — end-to-end setup and configuration tailored to your business.",
            "provider": { "@id": "https://klepka.solutions/#organization" }
          }
        },
        {
          "@type": "ListItem",
          "position": 2,
          "item": {
            "@type": "Service",
            "name": "Salesforce Support & Administration",
            "description": "Certified Salesforce administrators on an outsource or outstaff basis. Day-to-day platform management, configuration, and improvements without hiring in-house.",
            "provider": { "@id": "https://klepka.solutions/#organization" }
          }
        },
        {
          "@type": "ListItem",
          "position": 3,
          "item": {
            "@type": "Service",
            "name": "CRM Audit",
            "description": "Org health assessment, security review, technical debt analysis, and prioritized recommendations to stabilize and improve your Salesforce.",
            "provider": { "@id": "https://klepka.solutions/#organization" }
          }
        },
        {
          "@type": "ListItem",
          "position": 4,
          "item": {
            "@type": "Service",
            "name": "Salesforce Training & Enablement",
            "description": "Role-based Salesforce training — from single-user onboarding to enterprise-wide enablement programs with full materials.",
            "provider": { "@id": "https://klepka.solutions/#organization" }
          }
        },
        {
          "@type": "ListItem",
          "position": 5,
          "item": {
            "@type": "Service",
            "name": "Salesforce Migration",
            "description": "Data migration to Salesforce, Classic to Lightning, and org mergers — structured, validated, and low-risk delivery.",
            "provider": { "@id": "https://klepka.solutions/#organization" }
          }
        },
        {
          "@type": "ListItem",
          "position": 6,
          "item": {
            "@type": "Service",
            "name": "Salesforce Flow Optimizations",
            "description": "Flow refactoring, Workflow Rule and Process Builder migration to Flow — reduce technical debt and future change costs.",
            "provider": { "@id": "https://klepka.solutions/#organization" }
          }
        }
      ]
    }
  ];

  return (
    <div className="min-h-screen">
      <SEOHead
        title="Klepka — Salesforce CRM Implementation & Integration Services"
        description="Klepka delivers end-to-end Salesforce CRM implementations, integrations, and ongoing support. Scalable solutions built to drive revenue for SaaS, B2B, and enterprise teams."
        canonicalPath="/"
        jsonLd={homeJsonLd}
      />
      {/* Hero Section */}
      <section className="pt-25 pb-2 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white/30 to-background">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-4xl mx-auto"
          >
            <h1 className="text-3xl sm:text-4xl mb-6 text-violet">
              Scalable Solutions for Salesforce® CRM
            </h1>
            <p className="text-lg sm:text-xl text-text-secondary mb-8 leading-relaxed">
              Implementations, integrations, and ongoing support. <br></br>
              Full-cycle Salesforce delivery built to drive revenue.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/pricing">
                <Button variant="primary" size="lg">
                  View Pricing{" "}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>

        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          ></motion.div>

          <div className="mb-24">
            {showAllCerts ? (
              <div className="flex flex-wrap justify-center gap-4 py-2">
                {Object.values(certificatesConfig).map((cert) => (
                  <div key={cert.id} className="flex items-center justify-center h-32 w-32">
                    <img
                      src={cert.image}
                      alt={cert.name}
                      title={cert.name}
                      className="max-h-full w-auto object-contain"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="certification-slider">
                <Slider ref={sliderRef} {...sliderSettings}>
                  {Object.values(certificatesConfig).map((cert) => (
                    <div key={cert.id} className="px-4">
                      <div className="flex items-center justify-center h-32">
                        <img
                          src={cert.image}
                          alt={cert.name}
                          title={cert.name}
                          className="max-h-full w-auto object-contain"
                        />
                      </div>
                    </div>
                  ))}
                </Slider>
              </div>
            )}
            <button
              onClick={() => setShowAllCerts((s) => !s)}
              className="w-full text-xs text-text-secondary hover:text-violet cursor-pointer mt-2"
            >
              {showAllCerts ? 'Show slider' : 'View all certificates'}
            </button>
          </div>
        </div>
      

      {/* Tech Stack Section 
      
        <div className="max-w-7xl mx-auto mb-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl mb-4 text-violet">
              Trusted CRM & Integration Technologies
            </h2>
          </motion.div>

          <div className="tech-stack-slider max-w-4xl mx-auto">
            <Slider ref={sliderRef} {...sliderSettings}>
              {techStack.map((tech, index) => (
                <div key={index} className="px-4">
                  <div className="flex items-center justify-center h-16">
                    <img
                      src={tech.logo}
                      alt={tech.name}
                      className="max-h-full w-auto object-contain"
                    />
                  </div>
                </div>
              ))}
            </Slider>
          </div>
        </div>*/}
      {/* Services Overview */}
     
        <div className="max-w-7xl mx-auto mb-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl mb-4 text-violet">
              Our Services
            </h2>
            <p className="text-lg text-text-secondary max-w-2xl mx-auto">
              Comprehensive CRM solutions designed for scale
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {services.map((service, index) => (
              <Card
                key={index}
                className="hover:border-violet"
              >
                <div className="mb-4">{service.icon}</div>
                <h3 className="text-xl mb-3 text-violet font-bold">
                  {service.title}
                </h3>
                <p className="text-text-secondary leading-relaxed">
                  {service.description}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>
      {/* Testimonial Block 
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <Card className="bg-gradient-to-br from-white/40 to-card border-accent-blue/30" hover={false}>
            <div className="text-center">
              <svg className="w-12 h-12 text-accent-blue mx-auto mb-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
              </svg>
              <p className="text-xl sm:text-2xl mb-6 text-violet italic">
                "Working with this team gave us a CRM system that finally matched our sales reality."
              </p>
              <p className="text-text-secondary">
                — VP of Sales, B2B SaaS Company
              </p>
            </div>
          </Card>
        </div>
      </section>*/}

      {/* Contact Teaser */}
      <section className="py-20 pb-24 px-4 sm:px-6 lg:px-8 bg-violet text-off-white">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl mb-4">
              Tell us about your CRM challenges
            </h2>
            <p className="text-lg text-white">
              Discover how we can help you optimize your
              Salesforce architecture
            </p>
          </motion.div>

          <CrmChallengesForm formName="CRM Challenges Inquiry" />
        </div>
      </section>
    </div>
  );
};