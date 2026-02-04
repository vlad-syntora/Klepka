import React from "react";
import { motion } from "motion/react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Input, TextArea } from "../components/Input";
import {
  ArrowRight,
  CircleCheck,
  Zap,
  Target,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import Slider from "react-slick";
import { CrmChallengesForm } from "../components/CrmChallengesForm";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

import cert1 from "../../assets/e2a3731ce5c28b0aaeabca19fd7e3c14965d21ca.png";
import cert2 from "../../assets/7366f5a4c28ad07c8d9e9f7ffadee0e142693189.png";
import cert3 from "../../assets/82604211df267665aa3c66c85446c94b2ee6cd46.png";
import cert4 from "../../assets/3550a6afca687e342a05d1e6c391a8dbfbdb5561.png";
import cert5 from "../../assets/16a5ea898db9e45a4dda47b5fd950a3b1ec8a9b5.png";
import cert6 from "../../assets/aed582af24f5014b836a133be5f05bf36a841cd1.png";
import cert7 from "../../assets/16a5ea898db9e45a4dda47b5fd950a3b1ec8a9b5.png";
import cert8 from "../../assets/aed582af24f5014b836a133be5f05bf36a841cd1.png";
import salesforceLogo from "../../assets/cbbb4ce1dcbf542b256647147b8d01b2362fdc18.png";
import docusignLogo from "../../assets/25155f2a11a011d3b70848d424b874c0c621c32b.png";
import slackLogo from "../../assets/ed122e531258ed50ebab3a297e8ca6dba7ae30f2.png";
import formTitanLogo from "../../assets/492d9bc4032f73ffbe046c5c7e9cb125b5d3ef6b.png";
import tableauLogo from "../../assets/4380d03553cab5a60c1283a76c56f2d79493987a.png";

export const Home: React.FC = () => {
  const services = [
    {
      title: "Salesforce Implementation",
      description:
        "End-to-end Salesforce setup tailored to your business processes.",
      icon: <Target className="w-8 h-8 text-black" />,
    },
    {
      title: "CRM Audit & Optimization",
      description:
        "Identify bottlenecks, technical debt, and growth blockers.",
      icon: (
        <CircleCheck className="w-8 h-8 text-black" />
      ),
    },
    {
      title: "Integrations & Automation",
      description:
        "Connect Salesforce with ERP, billing, marketing, and data tools.",
      icon: <Zap className="w-8 h-8 text-black" />,
    },
    {
      title: "Training & Enablement",
      description:
        "Empower teams to fully adopt and scale CRM usage.",
      icon: <Users className="w-8 h-8 text-black" />,
    },
  ];

  const techStack = [
    { name: "Salesforce", logo: salesforceLogo },
    { name: "DocuSign", logo: docusignLogo },
    { name: "Slack", logo: slackLogo },
    { name: "FormTitan", logo: formTitanLogo },
    { name: "Tableau", logo: tableauLogo },
  ];

  const settings = {
    dots: false,
    infinite: true,
    speed: 600,
    slidesToShow: 5,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 3000,
    cssEase: "cubic-bezier(0.4, 0, 0.2, 1)",
    pauseOnHover: true,
    responsive: [
      {
        breakpoint: 1024,
        settings: {
          slidesToShow: 3,
          slidesToScroll: 1,
        },
      },
      {
        breakpoint: 768,
        settings: {
          slidesToShow: 2,
          slidesToScroll: 1,
        },
      },
      {
        breakpoint: 480,
        settings: {
          slidesToShow: 1,
          slidesToScroll: 1,
        },
      },
    ],
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="pt-25 pb-2 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white/30 to-background">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-4xl mx-auto"
          >
            <h1 className="text-4xl sm:text-5xl lg:text-6xl mb-6 text-violet">
              Designing Scalable Salesforce CRM Systems for
              Revenue Teams
            </h1>
            <p className="text-lg sm:text-xl text-text-secondary mb-8 leading-relaxed">
              We help growing companies implement, integrate,
              and optimize Salesforce to increase visibility,
              efficiency, and revenue.
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

          <div className="certification-slider mb-24">
            <Slider {...settings}>
              <div className="px-4">
                <div className="flex items-center justify-center h-32">
                  <img
                    src={cert3}
                    alt="Platform Administrator Certification"
                    className="max-h-full w-auto object-contain"
                  />
                </div>
              </div>
              <div className="px-4">
                <div className="flex items-center justify-center h-32">
                  <img
                    src={cert7}
                    alt="Platform App Builder"
                    className="max-h-full w-auto object-contain"
                  />
                </div>
              </div>
              <div className="px-4">
                <div className="flex items-center justify-center h-32">
                  <img
                    src={cert2}
                    alt="Experience Cloud Consultant Certification"
                    className="max-h-full w-auto object-contain"
                  />
                </div>
              </div>
             <div className="px-4">
                <div className="flex items-center justify-center h-32">
                  <img
                    src={cert6}
                    alt="Sales Cloud Consultant Certification"
                    className="max-h-full w-auto object-contain"
                  />
                </div>
              </div>
              <div className="px-4">
                <div className="flex items-center justify-center h-32">
                  <img
                    src={cert8}
                    alt="Pardot Specialist Certification"
                    className="max-h-full w-auto object-contain"
                  />
                </div>
              </div>
              <div className="px-4">
                <div className="flex items-center justify-center h-32">
                  <img
                    src={cert1}
                    alt="Data Cloud Consultant Certification"
                    className="max-h-full w-auto object-contain"
                  />
                </div>
              </div>
              <div className="px-4">
                <div className="flex items-center justify-center h-32">
                  <img
                    src={cert4}
                    alt="Platform Data Architect Certification"
                    className="max-h-full w-auto object-contain"
                  />
                </div>
              </div>
              <div className="px-4">
                <div className="flex items-center justify-center h-32">
                  <img
                    src={cert5}
                    alt="Platform Sharing and Visibility Architect Certification"
                    className="max-h-full w-auto object-contain"
                  />
                </div>
              </div>
            </Slider>
          </div>
        </div>
      

      {/* Tech Stack Section */}
      
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
            <Slider {...settings}>
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
        </div>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
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

          <CrmChallengesForm />
        </div>
      </section>
    </div>
  );
};