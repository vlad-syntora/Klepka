import React, { useState } from "react";
import { motion } from "motion/react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Input, TextArea } from "../components/Input";
import { TrendingUp, Users, Award } from "lucide-react";
import { toast } from "sonner";

export const Partners: React.FC = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));

    toast.success("Partnership inquiry submitted!", {
      description:
        "An email with your details has been sent to dme85928@gmail.com. We will review your application and reach out soon.",
    });

    setIsSubmitting(false);
    (e.target as HTMLFormElement).reset();
  };

  const clients = [
    "TechCorp Inc",
    "Global SaaS",
    "Enterprise Solutions",
    "Revenue Systems",
    "Cloud Dynamics",
    "Data Innovations",
    "Scale Partners",
    "Growth Ventures",
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
              Trusted by Growing and Enterprise Teams
            </h1>
            <p className="text-lg text-text-secondary leading-relaxed">
              We partner with ambitious companies to build CRM systems that
              drive real business outcomes
            </p>
          </motion.div>
        </div>
      </section>

      {/* Logo Grid */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl sm:text-3xl mb-4 text-violet">
              Clients & Technology Partners
            </h2>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {clients.map((client, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="bg-card border border-border-color rounded-lg p-6 flex items-center justify-center hover:border-violet transition-colors"
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Input
                required
                placeholder="Your company name"
                className="bg-card-foreground/10 text-off-white border-border-color/30"
              />
              <Input
                required
                placeholder="Your role"
                className="bg-card-foreground/10 text-off-white border-border-color/30"
              />
              <Input
                required
                placeholder="Company Site"
                className="bg-card-foreground/10 text-off-white border-border-color/30"
              />
              <Input
                placeholder="Company LinkedIn"
                className="bg-card-foreground/10 text-off-white border-border-color/30"
              />
            </div>
            <Input
              required
              placeholder="Partner Type (Technology, Delivery, or Referral)"
              className="bg-card-foreground/10 text-off-white border-border-color/30"
            />
            <TextArea
              required
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
