import React from "react";
import { motion } from "motion/react";
import { SEOHead } from "../components/SEOHead";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Check, Info } from "lucide-react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { CrmChallengesForm } from "../components/CrmChallengesForm";
import { sendEmailJsForm } from "../lib/emailjs";
import initialDiscoveryPlanningIcon from "../../assets/Initial_discovery_planning.png";
import documentationIcon from "../../assets/Documentation.png";
import deliveryRoadmapIcon from "../../assets/Delivery_roadmap.png";
import dataAccuracyAndIntegrityCheckIcon from "../../assets/Data_accuracy_and_integrity_check.png";
import transparentDeliveryProgressIcon from "../../assets/Transparent_delivery_progress.png";
import qualityCheckIcon from "../../assets/Quality_check.png";
import userTrainingSessionsIcon from "../../assets/User_training_sessions.png";
import postLaunchSupportIcon from "../../assets/Post_launch_support.png";

type PricingCategory = {
  id: string;
  label: string;
};

type PricingPackage = {
  name: string;
  category: string;
  description: string;
  subtitle: string;
  price: string;
  features: string[];
  popular?: boolean;
};

const PackageGetStartedCard: React.FC<{ pkg: PricingPackage }> = ({ pkg }) => {
  const [isFlipped, setIsFlipped] = React.useState(false);
  const [status, setStatus] = React.useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [error, setError] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement | null>(null);
  const timerRef = React.useRef<number | null>(null);

  const getEmailJsErrorInfo = (err: unknown) => {
    const anyErr = err as
      | { status?: number; text?: string; message?: string }
      | undefined;

    const statusCode = anyErr?.status;
    const text = anyErr?.text;
    const message = anyErr?.message;

    const combined = [message, text].filter(Boolean).join(" | ");

    // If the request was sent but the response was blocked (extensions / strict privacy),
    // fetch can reject even though EmailJS processed the email.
    const isUnconfirmedNetworkError =
      typeof combined === "string" &&
      /failed to fetch|networkerror|load failed|fetch/i.test(combined);

    const uiMessage =
      statusCode || combined
        ? `EmailJS error${statusCode ? ` (${statusCode})` : ""}: ${
            combined || "Unknown error"
          }`
        : "Couldn't submit. Please try again.";

    return { isUnconfirmedNetworkError, uiMessage };
  };

  React.useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const flipToFront = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    setIsFlipped(false);
    setStatus("idle");
    setError(null);
    formRef.current?.reset();
  };

  const handleStart = () => {
    setIsFlipped(true);
    setStatus("idle");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    setStatus("submitting");
    setError(null);

    try {
      await sendEmailJsForm(formEl);
      setStatus("success");
      formEl.reset();

      timerRef.current = window.setTimeout(() => {
        flipToFront();
      }, 1600);
    } catch (err) {
      console.error(err);
      const info = getEmailJsErrorInfo(err);

      if (info.isUnconfirmedNetworkError) {
        setStatus("success");
        formEl.reset();
        timerRef.current = window.setTimeout(() => {
          flipToFront();
        }, 1600);
        return;
      }

      setStatus("error");
      setError(info.uiMessage);
    }
  };

  const frontCardClasses = `bg-card border border-border-color rounded-lg p-6 shadow-sm transition-shadow h-full flex flex-col hover:shadow-lg ${
    pkg.popular ? "border-violet border-2 shadow-lg" : ""
  }`;

  const backCardClasses = `bg-violet border border-violet/40 rounded-lg p-6 shadow-sm h-full flex flex-col text-off-white ${
    pkg.popular ? "ring-2 ring-white/30" : ""
  }`;

  const darkInputClasses =
    "bg-card-foreground/10 text-off-white border-border-color/30";

  return (
    <div className="h-full" style={{ perspective: "1200px" }}>
      <motion.div
        className="relative h-full [transform-style:preserve-3d]"
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
      >
        {/* Front */}
        <div className="h-full [backface-visibility:hidden]">
          <div className={frontCardClasses}>
            <div data-align="title">
              {pkg.popular && (
                <div className="bg-violet text-white text-sm font-medium px-4 py-1 rounded-full inline-block mb-4 w-fit">
                  Most Popular
                </div>
              )}
              <h3 className="text-2xl mb-2 text-violet font-bold">
                {pkg.name}
              </h3>
            </div>

            <p data-align="subtitle" className="text-grey mb-4">
              {pkg.subtitle}
            </p>

            <p
              data-align="price"
              className="text-lg font-normal text-violet mb-4"
            >
              {pkg.price}
            </p>

            <div className="border-t border-border-color pt-4 mb-3 text-sm" />

            <p
              data-align="description"
              className="text-grey leading-relaxed mb-2 text-sm"
            >
              {pkg.description}
            </p>

           

            <ul className="space-y-3 mb-8 flex-grow">
              {pkg.features.map((feature, idx) => (
                <li key={idx} className="flex items-start space-x-3">
                  <Check className="w-5 h-5 text-violet flex-shrink-0 mt-0.5" />
                  <span className="text-black">{feature}</span>
                </li>
              ))}
            </ul>

            <Button
              type="button"
              onClick={handleStart}
              variant={pkg.popular ? "primary" : "ghost"}
              className="w-full mt-auto"
            >
              Get Started
            </Button>
          </div>
        </div>

        {/* Back */}
        <div className="absolute inset-0 h-full [transform:rotateY(180deg)] [backface-visibility:hidden]">
          <div className={backCardClasses}>
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h3 className="text-xl font-bold">Get Started</h3>
                <p className="text-white/80 text-sm">{pkg.name}</p>
              </div>
              <button
                type="button"
                onClick={flipToFront}
                className="text-white/80 hover:text-white text-sm underline underline-offset-4"
              >
                Back
              </button>
            </div>

            {status === "success" ? (
              <div className="flex-1 flex items-center justify-center text-center">
                <div>
                  <p className="text-2xl font-semibold">Success</p>
                  <p className="text-white/80 mt-2 text-sm">
                    We received your request and will reach out shortly.
                  </p>
                </div>
              </div>
            ) : (
              <form
                ref={formRef}
                className="space-y-4 flex-1 flex flex-col"
                onSubmit={handleSubmit}
              >
                <input
                  type="hidden"
                  name="form_name"
                  value={`New Client Request '${pkg.name}'`}
                />
                <input type="hidden" name="package_name" value={pkg.name} />
                <input
                  type="hidden"
                  name="package_category"
                  value={pkg.category}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    required
                    name="first_name"
                    placeholder="First Name"
                    className={darkInputClasses}
                  />
                  <Input
                    required
                    name="last_name"
                    placeholder="Last Name"
                    className={darkInputClasses}
                  />
                  <Input
                    required
                    name="company"
                    placeholder="Company"
                    className={darkInputClasses}
                  />
                  <Input
                    type="tel"
                    name="phone"
                    placeholder="+X(XXX)XXX-XXXX"
                    className={darkInputClasses}
                  />
                </div>

                <Input
                  required
                  type="email"
                  name="reply_to"
                  placeholder="your@email.com"
                  className={darkInputClasses}
                />

                {status === "error" && (
                  <p className="text-sm text-accent-yellow">{error}</p>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full mt-auto !bg-white !text-violet hover:!bg-accent-yellow hover:!text-violet ring-2 ring-white/40 ring-offset-2 ring-offset-violet"
                  disabled={status === "submitting"}
                >
                  {status === "submitting" ? "Sending..." : "Submit"}
                </Button>
              </form>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export const Pricing: React.FC = () => {
  const [selectedCategory, setSelectedCategory] =
    React.useState("Implementation");

  const packagesGridRef = React.useRef<HTMLDivElement | null>(null);

  const alignPackageCardsInRows = React.useCallback(() => {
    const grid = packagesGridRef.current;
    if (!grid) return;

    const cards = Array.from(
      grid.querySelectorAll<HTMLElement>('[data-package-card="true"]'),
    );
    if (!cards.length) return;

    const keys = ["title", "subtitle", "price", "description"] as const;

    for (const card of cards) {
      for (const key of keys) {
        const el = card.querySelector<HTMLElement>(`[data-align="${key}"]`);
        if (el) el.style.minHeight = "";
      }
    }

    const gridRect = grid.getBoundingClientRect();
    const rows: Array<{ top: number; cards: HTMLElement[] }> = [];
    const topTolerancePx = 2;

    for (const card of cards) {
      const top = Math.round(card.getBoundingClientRect().top - gridRect.top);
      const row = rows.find((r) => Math.abs(r.top - top) <= topTolerancePx);
      if (row) row.cards.push(card);
      else rows.push({ top, cards: [card] });
    }

    for (const row of rows) {
      for (const key of keys) {
        let max = 0;
        for (const card of row.cards) {
          const el = card.querySelector<HTMLElement>(`[data-align="${key}"]`);
          if (!el) continue;
          const h = el.getBoundingClientRect().height;
          if (h > max) max = h;
        }
        for (const card of row.cards) {
          const el = card.querySelector<HTMLElement>(`[data-align="${key}"]`);
          if (el) el.style.minHeight = `${Math.ceil(max)}px`;
        }
      }
    }
  }, []);

  React.useLayoutEffect(() => {
    const id = window.requestAnimationFrame(alignPackageCardsInRows);
    return () => window.cancelAnimationFrame(id);
  }, [alignPackageCardsInRows, selectedCategory]);

  React.useEffect(() => {
    const grid = packagesGridRef.current;
    if (!grid) return;

    let raf = 0;
    const schedule = () => {
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(alignPackageCardsInRows);
    };

    const ro = new ResizeObserver(schedule);
    ro.observe(grid);
    window.addEventListener("resize", schedule);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", schedule);
      ro.disconnect();
    };
  }, [alignPackageCardsInRows]);

  const categories: PricingCategory[] = [
    { id: "Implementation", label: "Implementation" },
    { id: "Support", label: "Support" },
    { id: "CRM Audit", label: "CRM Audit" },
    { id: "Trainings", label: "Trainings" },
    { id: "Migration", label: "Migration" },
    { id: "Optimizations", label: "Optimizations" },
    { id: "Custom Configuration", label: "Custom Configuration" },
  ];

  const packages: PricingPackage[] = [
    {
      name: 'Support Starter',
      category: 'Support',
      description: 'Reliable Salesforce support for small teams and stable orgs',
      subtitle: 'For companies that need day-to-day Salesforce assistance without a full-time admin.',
      price: 'From $1400 · 10 hrs',
      features: [
        '1 Certified Salesforce Specialist',
'Break/fix support',
'Minor configuration changes (fields, layouts, permissions)',
'Small Flow updates',
'Basic release assistance',
'Reports & dashboards',
'Monthly activity summary',
      ],
    },
{
      name: 'Support Grow',
      category: 'Support',
      description: 'Ongoing Salesforce support with proactive improvements and predictable capacity.',
      subtitle: 'For growing teams that want continuous system improvements, not just fixes.',
      price: 'From $3500 · 25 hrs',
      features: [
        'Up to 3 Certified Salesforce Specialist',
'Break/fix support',
'Minor configuration changes (fields, layouts, permissions)',
'Basic release assistance',
'Monthly activity summary',
'Proactive backlog grooming',
'Flow automation improvements',
'Reports & dashboards',
'Monthly review and improvement plan',
      ],
    },
{
      name: 'Support Enterprise',
      category: 'Support',
      description: 'Managed Salesforce operations with SLAs and governance.',
      subtitle: 'For complex orgs that require reliability, control, and architectural oversight.',
      price: 'From $8400 · 60 hrs',
      features: [
        'Up to 3 Certified Salesforce Specialist',
'Break/fix support',
'Minor configuration changes (fields, layouts, permissions)',
'Monthly activity summary',
'Proactive backlog grooming',
'Flow automation improvements',
'Reports & dashboards',
'Monthly review and improvement plan',
'SLA-based incident handling',
'Release and deployment support',
'Governance & best-practice controls',
'Architecture advisory',
      ],
    },
{
      name: 'CRM Audit',
      category: 'CRM Audit',
      description: 'A fast, structured health check of your Salesforce org.',
      subtitle: 'To identify risks, technical debt, and quick wins.',
      price: 'From $3500 · 50 hrs',
      features: [
        'Stakeholder discovery',
'Org health assessment',
'Security, data, and automation review',
'Prioritized recommendations',
      ],
    },
{
      name: 'CRM Audit & Documentation',
      category: 'CRM Audit',
      description: 'Audit plus clear system documentation for long-term stability.',
      subtitle: 'For teams lacking transparency and internal Salesforce knowledge.',
      price: 'From $5600 · 80 hrs',
      features: [
        'Stakeholder discovery',
'Org health assessment',
'Security, data, and automation review',
'Prioritized recommendations',
'Process and data model overview',
'Automation inventory',
'Admin operating documentation',
'Identified quick wins and long-term optimizations',
      ],
    },
{
      name: 'CRM Audit & Optimisation',
      category: 'CRM Audit',
      description: 'Audit combined with implementation of high-impact improvements.',
      subtitle: 'To stabilize Salesforce and immediately improve performance and usability.',
      price: 'From $8400 · 120 hrs',
      features: [
        'Stakeholder discovery',
'Org health assessment',
'Security, data, and automation review',
'Prioritized recommendations',
'Process and data model overview',
'Automation inventory',
'Admin operating documentation',
'Identified quick wins and long-term optimizations',
'Performance and UX improvements',
'Post-implementation validation',
      ],
    },
{
      name: 'User Training Starter',
      category: 'Trainings',
      description: 'Essential Salesforce onboarding for end users.',
      subtitle: 'To ensure users adopt Salesforce correctly from day one.',
      price: 'From $1680 · 12 hrs',
      features: [
        'Training for 1 user role',
'One live session (up to 2 hours)',
'Quick reference guide',
'Q&A session',
      ],
    },
{
      name: 'User Training Grow',
      category: 'Trainings',
      description: 'Structured Salesforce training across multiple roles.',
      subtitle: 'To reduce support load and increase productivity.',
      price: 'From $3360 · 24 hrs',
      features: [
        'Training for up to 3 roles',
'Multiple live sessions',
'Playbooks and SOPs',
'Adoption feedback and recommendations',
      ],
    },
{
      name: 'User Training Enterprise',
      category: 'Trainings',
      description: 'Enterprise-grade enablement and onboarding framework.',
      subtitle: 'For large teams with frequent onboarding and complex roles.',
      price: 'From $7000 · 50 hrs',
      features: [
        'Training tracks for up to 6 roles',
'Train-the-trainer session',
'Full enablement materials',
'Office hours and adoption reporting',
      ],
    },
{
      name: 'Sales Cloud Setup',
      category: 'Implementation',
      description: 'A clean and scalable Sales Cloud foundation.',
      subtitle: 'To launch or reset Salesforce sales processes quickly and correctly.',
      price: 'From $4800 · 80 hrs',
      features: [
        'Core object configuration',
'Sales stages and validation rules',
'Page layouts and record types',
'Reports and dashboards',
'Security baseline',
'Custom Automations Setup',
      ],
    },
{
      name: 'Service Cloud Setup',
      category: 'Implementation',
      description: 'A production-ready Service Cloud setup for case management.',
      subtitle: 'To enable support teams to work efficiently in Salesforce.',
      price: 'From $5400 · 90 hrs',
      features: [
        'Case lifecycle and queues',
'Channel setup (email or web)',
'Macros and quick actions',
'Reports and dashboards',
'Knowledge base basics',
'Custom Automations Setup',
      ],
    },
{
      name: 'Experience Cloud Setup',
      category: 'Implementation',
      description: 'A secure customer or partner portal built on Salesforce.',
      subtitle: 'To enable self-service and collaboration with external users.',
      price: 'From $4800 · 80 hrs',
      features: [
        'Portal setup and branding',
'Access and sharing model',
'Core pages and navigation',
'Forms and basic automation',
'Production deployment',
      ],
    },
{
      name: 'Advanced Sales Cloud Setup',
      category: 'Implementation',
      description: 'Sales Cloud built for scale, automation, and data quality.',
      subtitle: 'For teams with complex sales processes and reporting needs.',
      price: 'From $8400 · 140 hrs',
      features: [
        'Core object configuration',
'Sales stages and validation rules',
'Page layouts and record types',
'Reports and dashboards',
'Security baseline',
'Custom Automations Setup',
'Lead routing and approvals',
'Data quality and dedup rules',
'Advanced dashboards',
      ],
    },
{
      name: 'Advanced Service Cloud Setup',
      category: 'Implementation',
      description: 'Service operations optimized for scale and efficiency.',
      subtitle: 'For high-volume or multi-team support environments.',
      price: 'From $9600 · 160 hrs',
      features: [
        'Case lifecycle and queues',
'Channel setup (email or web)',
'Macros and quick actions',
'Reports and dashboards',
'Knowledge base basics',
'Custom Automations Setup',
'Omni-Channel routing',
'SLA and entitlement model',
      ],
    },
{
      name: 'Advanced Experience Cloud Setup',
      category: 'Implementation',
      description: 'A scalable Experience Cloud portal with enterprise-grade governance.',
      subtitle: 'For complex external user scenarios and integrations.',
      price: 'From $8400 · 140 hrs',
      features: [
        'Access and sharing model',
'Core pages and navigation',
'Forms and basic automation',
'Production deployment',
'Advanced sharing and security',
'Custom pages and guided flows',
'SSO configuration support',
'Performance optimization',
      ],
    },
{
      name: 'AgentForce Setup',
      category: 'Implementation',
      description: 'Deploy Salesforce Agentforce with clear use cases and guardrails.',
      subtitle: 'To safely introduce AI-driven assistance into service or sales workflows.',
      price: 'From $4800 · 80 hrs',
      features: [
        'Use-case definition',
'Knowledge and data readiness',
'Agent configuration (1 use case)',
'Guardrails and testing',
'Enablement session',
      ],
    },
{
      name: 'Analytic Cloud Setup',
      category: 'Implementation',
      description: 'Launch Salesforce Analytics (CRM Analytics / Tableau CRM) with clear KPIs and decision-ready dashboards.',
      subtitle: 'For leadership and operations teams that need reliable, actionable insights from Salesforce data instead of static reports.',
      price: 'From $4800 · 80 hrs',
      features: [
        'KPI definition workshop (business & operational metrics)',
'Data source analysis (Salesforce objects, relationships, data quality check)',
'Dataset configuration and preparation (basic transformations)',
'Up to 3 interactive dashboards (executive / operational level)',
'Security and access model setup',
'Enablement session for users and admins',
      ],
    },
{
      name: 'Setup Docusign Integration',
      category: 'Implementation',
      description: 'Reliable DocuSign and Salesforce integration for e-signatures.',
      subtitle: 'To automate document signing and status tracking.',
      price: 'From $1800 · 40 hrs',
      features: [
        'Integration configuration',
'Object and template mapping',
'1–2 DocuSign workflows',
'User guidance',
      ],
    },
{
      name: 'Migration to Salesforce',
      category: 'Migration',
      description: 'Move your data and processes into Salesforce with confidence.',
      subtitle: 'For companies adopting Salesforce or replacing legacy CRMs.',
      price: 'From $4800 · 80 hrs',
      features: [
        'Migration strategy',
'Data mapping and cleansing rules',
'Test and production migration',
'Reconciliation and release',
      ],
    },
{
      name: 'Merger Salesforce Orgs',
      category: 'Migration',
      description: 'Safely merge multiple Salesforce orgs into one.',
      subtitle: 'After mergers, acquisitions, or multi-org growth.',
      price: 'From $13200 · 220 hrs',
      features: [
        'Org comparison and target design',
'Data and security alignment',
'Phased migration',
'Cutover planning',
      ],
    },
{
      name: 'Flow Refactoring',
      category: 'Optimizations',
      description: 'Make Salesforce automation faster, safer, and easier to maintain.',
      subtitle: 'To reduce automation failures and future change costs.',
      price: 'From $4800 · 80 hrs',
      features: [
        'Flow inventory and assessment',
'Flow Refactoring',
'Error handling and standards',
'Testing and deployment',
      ],
    },
{
      name: 'WFR & PB Refactoring',
      category: 'Optimizations',
      description: 'Modernize legacy automation by moving it to Salesforce Flow.',
      subtitle: 'To reduce risk and prepare for long-term platform stability.',
      price: 'From $4800 · 80 hrs',
      features: [
        'Inventory of Workflow Rules and Process Builder',
'Conversion to Flow ',
'Logic consolidation',
'Testing and deployment',
      ],
    },
{
      name: 'Apex Refactoring',
      category: 'Optimizations',
      description: 'Improve code quality, performance, and maintainability.',
      subtitle: 'To reduce defects and technical debt in custom development.',
      price: 'From $4800 · 80 hrs',
      features: [
        'Code review',
'Refactoring classes/triggers',
'Unit test improvements',
'Deployment support',
      ],
    },
{
      name: 'Classic to Lightning Migration',
      category: 'Migration',
      description: 'Move from Salesforce Classic to Lightning Experience.',
      subtitle: 'To unlock modern UX, automation, and new Salesforce features.',
      price: 'From $4000 · 100 hrs',
      features: [
        'Readiness assessment',
'Lightning apps and pages',
'User enablement',
'Pilot and production rollout',
      ],
    },
  ];

  const filteredPackages = packages.filter(
    (pkg) => pkg.category === selectedCategory,
  );

  const pricingJsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": "https://klepka.solutions/pricing#webpage",
      "url": "https://klepka.solutions/pricing",
      "name": "Salesforce CRM Pricing & Packages — Klepka",
      "description": "View Klepka's Salesforce implementation pricing packages. Transparent, structured delivery from initial discovery to post-launch support.",
      "isPartOf": { "@id": "https://klepka.solutions/#website" },
      "breadcrumb": {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://klepka.solutions/" },
          { "@type": "ListItem", "position": 2, "name": "Pricing", "item": "https://klepka.solutions/pricing" }
        ]
      }
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What Salesforce implementation services does Klepka offer?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Klepka offers Sales Cloud Setup, Service Cloud Setup, Experience Cloud Setup, AgentForce Setup, Analytics Cloud Setup, and DocuSign integration, starting from $1,800."
          }
        },
        {
          "@type": "Question",
          "name": "How much does a Salesforce CRM audit cost?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Klepka's CRM Audit starts from $3,500 for 50 hours and includes org health assessment, security review, and prioritized recommendations. Full audit with documentation and optimizations starts from $8,400."
          }
        },
        {
          "@type": "Question",
          "name": "Does Klepka provide ongoing Salesforce support?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. Klepka offers three support tiers: Support Starter (from $1,400 · 10 hrs), Support Grow (from $3,500 · 25 hrs), and Support Enterprise (from $8,400 · 60 hrs) with SLA-based handling and architecture advisory."
          }
        },
        {
          "@type": "Question",
          "name": "Can Klepka migrate data to Salesforce from another CRM?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. Klepka provides Migration to Salesforce from legacy CRMs starting from $4,800 · 80 hrs, including data mapping, cleansing, test migration, and reconciliation. Org mergers are also supported."
          }
        },
        {
          "@type": "Question",
          "name": "What is included in Klepka's Salesforce training packages?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Training packages range from User Training Starter ($1,680 · 12 hrs) for single-role onboarding to User Training Enterprise ($7,000 · 50 hrs) covering up to 6 roles with train-the-trainer sessions and full enablement materials."
          }
        }
      ]
    }
  ];

  return (
    <Tooltip.Provider>
      <div className="min-h-screen pt-24 lg:pt-32">
        <SEOHead
          title="Salesforce CRM Pricing & Packages — Klepka"
          description="View Klepka's Salesforce implementation pricing packages. Transparent, structured delivery from initial discovery to post-launch support. Find the right plan for your team."
          canonicalPath="/pricing"
          jsonLd={pricingJsonLd}
        />
        {/* Hero Section */}
        <section className="pb-0 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center max-w-3xl mx-auto"
            >
              <h1 className="text-3xl sm:text-4xl mb-3 text-violet">
                Transparent Pricing. Predictable Scope.
              </h1>
              <p className="text-lg text-text-secondary leading-relaxed">
                Pricing shaped by years of real delivery experience.
              </p>
            </motion.div>
          </div>
        </section>

{/* Additional Info */}
        <section className="py-10 px-4 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl sm:text-4xl mb-4 text-violet">
                All Packages Include
              </h2>
            </motion.div>

            <div className="bg-card border border-violet rounded-lg p-8">
              <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <motion.li
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0 * 0.05 }}
                className="flex items-start space-x-3"
              >
                <span className="text-violet font-bold text-lg flex-shrink-0">•</span>
                <span className="text-black font-medium">Initial discovery & planning</span>
              </motion.li>
              <motion.li
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 1 * 0.05 }}
                className="flex items-start space-x-3"
              >
                <span className="text-violet font-bold text-lg flex-shrink-0">•</span>
                <span className="text-black font-medium">Delivery roadmap</span>
              </motion.li>
              <motion.li
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 2 * 0.05 }}
                className="flex items-start space-x-3"
              >
                <span className="text-violet font-bold text-lg flex-shrink-0">•</span>
                <span className="text-black font-medium">Data accuracy and integrity check</span>
              </motion.li>
              <motion.li
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 3 * 0.05 }}
                className="flex items-start space-x-3"
              >
                <span className="text-violet font-bold text-lg flex-shrink-0">•</span>
                <span className="text-black font-medium">Transparent delivery progress</span>
              </motion.li>
              <motion.li
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 4 * 0.05 }}
                className="flex items-start space-x-3"
              >
                <span className="text-violet font-bold text-lg flex-shrink-0">•</span>
                <span className="text-black font-medium">Quality check</span>
              </motion.li>
              <motion.li
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 5 * 0.05 }}
                className="flex items-start space-x-3"
              >
                <span className="text-violet font-bold text-lg flex-shrink-0">•</span>
                <span className="text-black font-medium">Documentation</span>
              </motion.li>
              <motion.li
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 6 * 0.05 }}
                className="flex items-start space-x-3"
              >
                <span className="text-violet font-bold text-lg flex-shrink-0">•</span>
                <span className="text-black font-medium">User training sessions</span>
              </motion.li>
              <motion.li
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 7 * 0.05 }}
                className="flex items-start space-x-3"
              >
                <span className="text-violet font-bold text-lg flex-shrink-0">•</span>
                <span className="text-black font-medium">Post-launch support</span>
              </motion.li>
              </ul>
            </div>
          </div>
        </section>

        {/* Category Filter */}
        <section className="pb-0 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-wrap justify-center gap-4">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center space-x-2 px-6 py-4 rounded-xl border transition-all cursor-pointer ${
                    selectedCategory === cat.id
                      ? "bg-violet text-white border-violet shadow-lg scale-105"
                      : "bg-white text-violet border-border-color hover:border-violet hover:bg-white/10"
                  }`}
                >
                  <span className="font-semibold">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
        </section>



        {/* Service Packages */}
        <section className="py-6 px-4 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-7xl mx-auto">
            {selectedCategory === "Custom Configuration" ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-2xl mx-auto"
              >
                <Card className="p-8 !bg-violet !border-violet/40 text-off-white">
                  <div className="text-center mb-8">
                    <h3 className="text-2xl text-white mb-2">
                      Request Custom Configuration
                    </h3>
                    <p className="text-white/80">
                      Tell us about your specific CRM requirements and we'll
                      build a tailored proposal for you.
                    </p>
                  </div>
                  <CrmChallengesForm />
                </Card>
              </motion.div>
            ) : (
              <motion.div
                layout
                ref={packagesGridRef}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 justify-center"
              >
                {filteredPackages.map((pkg) => (
                  <motion.div
                    key={`${pkg.category}-${pkg.name}`}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div data-package-card="true" className="h-full">
                      <PackageGetStartedCard pkg={pkg} />
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        </section>

        
      </div>
    </Tooltip.Provider>
  );
};
