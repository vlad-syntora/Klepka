import React, { useState } from "react";
import { motion } from "motion/react";
import { SEOHead } from "../components/SEOHead";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Input, TextArea } from "../components/Input";
import { TrendingUp, Users, Award } from "lucide-react";
import { toast } from "sonner";
import { sendEmailJsForm } from "../lib/emailjs";
import saasProductIcon from "../../assets/SaaS_Product.png";
import b2bSalesIcon from "../../assets/B2B_Sales.png";
import dataDrivenIcon from "../../assets/Data_Driven.png";
import dataMigrationIcon from "../../assets/Data_Migration.png";
import optimisationIcon from "../../assets/Optimisation.png";
import supportIcon from "../../assets/Support.png";
import logoPrytulaIcon from "../../assets/logoPrytulaFund.svg";
import logoKlepkavioletIcon from "../../assets/logo_violet_1.png";

export const Partners: React.FC = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    setIsSubmitting(true);

    try {
      await sendEmailJsForm(formEl);
      toast.success("Partnership inquiry submitted!", {
        description: "We will review your application and reach out soon.",
      });
      formEl.reset();
      setSubmitSuccess(true);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't submit inquiry", {
        description: "Please try again in a moment.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  const clients = [
    {
      title: "SaaS and Product Companies",
      icon: saasProductIcon,
    },
    {
      title: "B2B Sales and Revenue Teams",
      icon: b2bSalesIcon,
    },
    {
      title: "Service and Support Teams",
      icon: supportIcon,
    },
    {
      title: "Data-Driven and Analytics-Focused Teams",
      icon: dataDrivenIcon,
    },
    {
      title: "Companies Scaling Internal Processes",
      icon: optimisationIcon,
    },
    {
      title: "Migration and Optimization Projects",
      icon: dataMigrationIcon,
    },
  ];

  const caseStudies = [
    {
      description: (
        <div>
          <h3 className="text-2xl mb-3 text-violet">Prytula Foundation USA</h3>
          <p className="text-2xl mb-3 text-text-secondary">Salesforce Nonprofit Cloud Implementation</p>
          <p><span style={{ fontSize: "11pt", fontFamily: "Arial,sans-serif" }}>We&rsquo;re happy to share our partnership experience with&nbsp;</span><strong><span style={{ fontSize: "11pt", fontFamily: "Arial,sans-serif" }}>Prytula Foundation USA</span></strong><span style={{ fontSize: "11pt", fontFamily: "Arial,sans-serif" }}>.</span></p>
<p><span style={{ fontSize: "11pt", fontFamily: "Arial,sans-serif" }}>We implemented a Salesforce-based CRM that brings more structure, visibility, and scalability to their operations.</span></p>
<p><span style={{ fontSize: "11pt", fontFamily: "Arial,sans-serif" }}>Salesforce Nonprofit Cloud is a powerful platform for managing processes in nonprofit organizations, and this project is a good example of how it can be applied in practice.</span></p>
<p><span style={{ fontSize: "11pt", fontFamily: "Arial,sans-serif" }}>The solution is built as a single Salesforce org with two logically independent areas, aligned with the foundation&rsquo;s core activities.</span></p>
<p><strong><span style={{ fontSize: "11pt", fontFamily: "Arial,sans-serif" }}>Fundraising &amp; Operations</span></strong></p>
<p><span style={{ fontSize: "11pt", fontFamily: "Arial,sans-serif" }}>We built a unified system covering donations, donor acquisition, request management, procurement, and asset distribution.</span></p>
<p><span style={{ fontSize: "11pt", fontFamily: "Arial,sans-serif" }}>We also introduced a structured donor funnel, making it easier to manage how new supporters are engaged and converted into active donors, with clear visibility into the fundraising pipeline.</span></p>
<p><strong><span style={{ fontSize: "11pt", fontFamily: "Arial,sans-serif" }}>Training &amp; Educational Programs</span></strong></p>
<p><span style={{ fontSize: "11pt", fontFamily: "Arial,sans-serif" }}>A separate subsystem for training initiatives, designed to operate independently and support future growth. It covers the full lifecycle of training programs, from participant registration to attendance tracking.</span></p>
<p><span style={{ fontSize: "11pt", fontFamily: "Arial,sans-serif" }}>By keeping these areas logically separated within one org, we ensured flexibility without adding unnecessary complexity, and created a foundation that can scale together with the organization.</span></p>
<p><span style={{ fontSize: "11pt", fontFamily: "Arial,sans-serif" }}>This project reflects our approach: applying proven Salesforce and commercial best practices to help organizations build systems that are not only functional today, but ready to scale tomorrow.</span></p>
<p><strong><span style={{ fontSize: "11pt", fontFamily: "Arial,sans-serif" }}>If you&apos;re building or scaling a nonprofit or fundraising operation and considering Salesforce, feel free to reach out.</span></strong></p>
<p><span style={{ fontSize: "11pt", fontFamily: "Arial,sans-serif" }}>#Salesforce #NonprofitCloud #SalesforceImplementation #CRM #Nonprofit #Fundraising #SalesforcePartner&nbsp;</span></p>
        </div>
      ),
      icon: logoPrytulaIcon,
    },
  ];

  const partnersJsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": "https://klepka.solutions/partners#webpage",
      "url": "https://klepka.solutions/partners",
      "name": "Partners & Case Studies — Klepka Salesforce Consulting",
      "description": "Explore Klepka's client partnerships and case studies. From Salesforce Nonprofit Cloud to B2B revenue teams, we deliver structured CRM solutions across industries.",
      "isPartOf": { "@id": "https://klepka.solutions/#website" },
      "mainEntity": { "@id": "https://klepka.solutions/partners#case-study-prytula" },
      "speakable": {
        "@type": "SpeakableSpecification",
        "cssSelector": ["h1", "h2", "h3"]
      },
      "breadcrumb": {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://klepka.solutions/" },
          { "@type": "ListItem", "position": 2, "name": "Partners", "item": "https://klepka.solutions/partners" }
        ]
      }
    },
    {
      "@context": "https://schema.org",
      "@type": "Article",
      "@id": "https://klepka.solutions/partners#case-study-prytula",
      "headline": "Prytula Foundation USA — Salesforce Nonprofit Cloud Implementation",
      "description": "Klepka built a robust Salesforce Nonprofit org for Prytula Foundation USA with two independent functional areas: Fundraising & Operations and Training & Educational Programs.",
      "datePublished": "2024-01-01",
      "dateModified": "2026-03-10",
      "author": { "@id": "https://klepka.solutions/#organization" },
      "publisher": { "@id": "https://klepka.solutions/#organization" },
      "about": [
        { "@type": "Thing", "name": "Salesforce Nonprofit Cloud" },
        { "@type": "Thing", "name": "CRM Implementation" },
        { "@type": "Organization", "name": "Prytula Foundation USA" }
      ]
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": "Klepka Areas of Expertise",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "item": { "@type": "Thing", "name": "SaaS and Product Companies" } },
        { "@type": "ListItem", "position": 2, "item": { "@type": "Thing", "name": "B2B Sales and Revenue Teams" } },
        { "@type": "ListItem", "position": 3, "item": { "@type": "Thing", "name": "Service and Support Teams" } },
        { "@type": "ListItem", "position": 4, "item": { "@type": "Thing", "name": "Data-Driven and Analytics-Focused Teams" } },
        { "@type": "ListItem", "position": 5, "item": { "@type": "Thing", "name": "Companies Scaling Internal Processes" } },
        { "@type": "ListItem", "position": 6, "item": { "@type": "Thing", "name": "Migration and Optimization Projects" } }
      ]
    }
  ];

  return (
    <div className="min-h-screen pt-24 lg:pt-32">
      <SEOHead
        title="Partners & Case Studies — Klepka Salesforce Consulting"
        description="Explore Klepka's client partnerships and case studies. From Salesforce Nonprofit Cloud to B2B revenue teams, we deliver structured CRM solutions across industries."
        canonicalPath="/partners"
        jsonLd={partnersJsonLd}
      />
      {/* Hero Section */}
      <section className="pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <h1 className="text-3xl sm:text-4xl mb-6 text-violet">
              Alignment Across Clients and Technology
            </h1>
            <p className="text-lg text-text-secondary leading-relaxed">
              Our experience spans collaboration with growing companies and established organizations using Salesforce as a core business system.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Logo Grid */}
      <section className="py-3 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl mb-4 text-violet">
              Our Areas of Experience
            </h2>
          </motion.div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              {clients.map((client, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-card border border-violet rounded-lg p-6 md:p-3 md:pl-9 flex flex-col md:flex-row items-center md:items-center justify-start gap-2 md:gap-4 hover:shadow-lg transition-shadow"
                >
                  <img
                    src={client.icon}
                    alt={client.title}
                    className="w-14 h-14 md:w-20 md:h-20 object-contain mb-2 md:mb-0 md:mr-4"
                  />
                  <span className="text-black font-medium text-center md:text-left text-xs md:text-sm">
                    {client.title}
                  </span>
                </motion.div>
              ))}
            </div>
        </div>
      </section>

      {/* Case Studies */}
      <section className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl mb-4 text-violet">
              Featured Case Studies
            </h2>
            <p className="text-lg text-text-secondary max-w-2xl mx-auto">
              Real results from real partnerships
            </p>
          </motion.div>

          <div className="space-y-8">
            {caseStudies.map((study, index) => (
              <Card key={index}>
          <div className="flex flex-col lg:flex-row lg:items-center gap-6">
              <div className="flex flex-row lg:flex-col gap-4 items-center justify-center flex-shrink-0 w-full lg:w-auto">
              <img
                src={study.icon}
                alt="Partner logo"
                className="w-24 h-24 object-contain"
              />
             
              </div>
            <div className="flex-1">{study.description}</div>
          </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Partner Form */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-violet text-off-white">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl mb-4">
              Become a Technology or Delivery Partner
            </h2>
            <p className="text-lg text-white">
              Join our network of trusted partners and scale your CRM solutions
            </p>
          </motion.div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            {submitSuccess && (
              <div
                role="status"
                className="rounded-md border border-green-200 bg-green-50 p-3 text-violet"
              >
                Partnership inquiry submitted. We will review your application and reach out soon.
              </div>
            )}
            <input type="hidden" name="form_name" value="New Partner Request" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Input
                required
                name="company_name"
                placeholder="Your company name"
                className="bg-card-foreground/10 text-off-white border-border-color/30"
              />
              <Input
                required
                name="role"
                placeholder="Your Role"
                className="bg-card-foreground/10 text-off-white border-border-color/30"
              />
              <Input
                required
                name="company_site"
                placeholder="Company Site"
                className="bg-card-foreground/10 text-off-white border-border-color/30"
              />
              <Input
                name="company_linkedin"
                placeholder="Company LinkedIn"
                className="bg-card-foreground/10 text-off-white border-border-color/30"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Input
                required
                type="email"
                name="reply_to"
                placeholder="your@email.com"
                className="bg-card-foreground/10 text-off-white border-border-color/30"
              />
              <Input
                required
                name="partner_type"
                placeholder="Partner Type (Technology, Delivery, or Referral)"
                className="bg-card-foreground/10 text-off-white border-border-color/30"
              />
            </div>
            <TextArea
              required
              name="message"
              placeholder="Tell us about your partnership interest..."
              rows={4}
              className="bg-card-foreground/10 text-off-white border-border-color/30"
            />
            <Button
              variant="primary"
              size="lg"
              className="w-full !bg-white !text-violet hover:!bg-accent-yellow hover:!text-violet ring-2 ring-white/40 ring-offset-2 ring-offset-violet"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Submit Partnership Inquiry"}
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
};
