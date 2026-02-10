import React, { useState } from "react";
import { motion } from "motion/react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Input, TextArea } from "../components/Input";
import { TrendingUp, Users, Award } from "lucide-react";
import { toast } from "sonner";
import { sendEmailJsForm } from "../lib/emailjs";

export const Partners: React.FC = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    "SaaS and Product Companies",
    "B2B Sales and Revenue Teams",
    "Service and Support Teams",
    "Data-Driven and Analytics-Focused Teams",
    "Companies Scaling Internal Processes",
    "Migration and Optimization Projects",
  ];

  const caseStudies = [
    {
      title: "Salesforce Revamp for Global SaaS",
      description:
        "Redesigned CRM architecture, reduced manual operations by 42%, improved forecasting accuracy.",
      metrics: [
        "42% reduction in manual work",
        "30% faster forecasting",
        "15+ integrations",
      ],
      icon: <TrendingUp className="w-8 h-8 text-black" />,
    },
    {
      title: "Enterprise CRM Consolidation",
      description:
        "Unified 3 disparate CRM systems into one Salesforce instance for a Fortune 500 company.",
      metrics: [
        "3 systems → 1 platform",
        "60% cost savings",
        "1000+ users migrated",
      ],
      icon: <Users className="w-8 h-8 text-black" />,
    },
    {
      title: "Revenue Operations Transformation",
      description:
        "Built end-to-end revenue operations platform with advanced analytics and automation.",
      metrics: [
        "25% revenue growth",
        "50% faster deal cycles",
        "Real-time reporting",
      ],
      icon: <Award className="w-8 h-8 text-black" />,
    },
  ];

  return (
    <div className="min-h-screen pt-24 lg:pt-32">
      {/* Hero Section */}
      <section className="pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <h1 className="text-4xl sm:text-5xl mb-6 text-violet">
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
            <h2 className="text-2xl sm:text-3xl mb-4 text-violet">
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
                className="bg-card border border-violet rounded-lg p-6 flex items-center justify-center "
              >
                <span className="text-black font-medium">{client}</span>
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
                <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                  <div className="flex-shrink-0">{study.icon}</div>
                  <div className="flex-1">
                    <h3 className="text-2xl mb-3 text-violet">{study.title}</h3>
                    <p className="text-text-secondary mb-6 leading-relaxed">
                      {study.description}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {study.metrics.map((metric, idx) => (
                        <div key={idx} className="bg-white/30 rounded-lg p-4">
                          <p className="text-sm text-violet font-medium">
                            {metric}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
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
                placeholder="Your role"
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
            <Input
              required
              name="partner_type"
              placeholder="Partner Type (Technology, Delivery, or Referral)"
              className="bg-card-foreground/10 text-off-white border-border-color/30"
            />
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
