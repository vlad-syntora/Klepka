import React from "react";
import { motion } from "motion/react";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Input, TextArea } from "../components/Input";
import { MapPin, Briefcase, Award } from "lucide-react";
import { toast } from "sonner";
import { sendEmailJsForm } from "../lib/emailjs";

export const Careers: React.FC = () => {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSubmitted, setIsSubmitted] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    setIsSubmitting(true);

    try {
      await sendEmailJsForm(formEl);
      setIsSubmitted(true);
      toast.success("Application submitted!", {
        description: "Thanks! We’ll review it and get back to you.",
      });
      formEl.reset();
    } catch (err) {
      console.error(err);
      toast.error("Couldn't submit application", {
        description: "Please try again in a moment.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openRoles = [
    {
      title: "Salesforce Consultant",
      type: "Full-time",
      location: "Remote (US/EU)",
      description:
        "Help clients design and implement Salesforce solutions that drive revenue growth.",
    },
    {
      title: "CRM Solution Architect",
      type: "Full-time",
      location: "Remote (US/EU)",
      description:
        "Lead complex enterprise CRM implementations and integrations.",
    },
    {
      title: "Integration Engineer",
      type: "Full-time",
      location: "Remote (US/EU)",
      description:
        "Build and maintain integrations between Salesforce and various business systems.",
    },
  ];

  const benefits = [
    {
      icon: <MapPin className="w-6 h-6 text-black" />,
      title: "Remote-first Work",
      description: "Work from anywhere in the US or EU with flexible hours",
    },
    {
      icon: <Award className="w-6 h-6 text-black" />,
      title: "Professional Certifications",
      description: "We cover all Salesforce certifications and trainings",
    },
    {
      icon: <Briefcase className="w-6 h-6 text-black" />,
      title: "Real Ownership",
      description:
        "Lead projects and make decisions that impact real businesses",
    },
  ];

  return (
    <div className="min-h-screen pt-24 lg:pt-32">
      {/* Hero Section */}
      <section className="pb-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <h1 className="text-3xl sm:text-4xl mb-6 text-violet">
              Build CRM Systems Used by Real Businesses
            </h1>
            <p className="text-lg text-text-secondary leading-relaxed">
              Join a team of technical experts who love solving complex business
              problems
            </p>
          </motion.div>
        </div>
      </section>

      {/* Benefits */}
      <section className="pb-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {benefits.map((benefit, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="text-center">
                  <div className="flex justify-center mb-4">{benefit.icon}</div>
                  <h3 className="text-xl text-violet mb-3">{benefit.title}</h3>
                  <p className="text-text-secondary">{benefit.description}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Open Roles - commented out
      <section className="pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl mb-4 text-violet">
              Open Positions
            </h2>
          </motion.div>

          <div className="space-y-6">
            {openRoles.map((role, index) => (
              <Card key={index}>
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-2xl text-violet mb-2">
                      {role.title}
                    </h3>
                    <p className="text-text-secondary mb-4">
                      {role.description}
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <span className="inline-flex items-center px-3 py-1 bg-white rounded-full text-sm text-violet">
                        {role.type}
                      </span>
                      <span className="inline-flex items-center px-3 py-1 bg-white rounded-full text-sm text-violet">
                        <MapPin className="w-4 h-4 mr-1" />
                        {role.location}
                      </span>
                    </div>
                  </div>
                  <Button variant="primary">Apply Now</Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>
      */}

      {/* Application Form */}
      <section className="py-0 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl mb-4 text-violet">
              Apply to Join Our Team
            </h2>
            <p className="text-lg text-text-secondary">
              Send us your information and we'll be in touch
            </p>
          </motion.div>

          <Card>
            <form className="space-y-6" onSubmit={handleSubmit}>
              <input
                type="hidden"
                name="form_name"
                value="New Candidate Form"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Input
                  required
                  name="full_name"
                  label="Name"
                  placeholder="Your name"
                />
                <Input
                  required
                  label="Email"
                  type="email"
                  name="reply_to"
                  placeholder="your@email.com"
                />
              </div>
              <Input
                required
                label="Role"
                name="role"
                placeholder="Position you're applying for"
              />
              <Input
                required
                label="LinkedIn"
                name="linkedin"
                placeholder="linkedin.com/in/yourprofile"
              />
              <TextArea
                required
                label="Message"
                name="message"
                placeholder="Tell us about yourself and why you'd be a great fit..."
                rows={6}
              />
              {isSubmitted && (
                <p className="text-sm text-violet">
                  Success — we received your application.
                </p>
              )}
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Sending..." : "Submit Application"}
              </Button>
            </form>
          </Card>
        </div>
      </section>
    </div>
  );
};
