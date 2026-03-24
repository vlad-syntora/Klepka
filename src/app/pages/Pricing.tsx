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
import {
  pricingSpotlightConfig,
  type PricingSpotlightCardContent,
} from "../../config/pricingSpotlightConfig";
import {
  pricingCategories,
  pricingPackages,
  type PricingPackage,
} from "../../config/pricingPackagesConfig";

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

const PricingSpotlightCard: React.FC<{ content: PricingSpotlightCardContent }> = ({
  content,
}) => {
  const [isFlipped, setIsFlipped] = React.useState(false);

  return (
    <div className="w-full" style={{ perspective: "1200px" }}>
      <motion.div
        className="relative [transform-style:preserve-3d]"
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <div className="[backface-visibility:hidden]">
          <Card className="p-8 !bg-card !border-border-color h-full">
            <div className="max-w-3xl mx-auto text-center mb-8">
              <h2 className="text-3xl sm:text-4xl mb-3 text-violet">{content.title}</h2>
              <p className="text-text-secondary leading-relaxed">{content.subtitle}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="rounded-lg border border-border-color p-5 bg-white/80 space-y-5">
                <div>
                  <h3 className="text-violet text-lg mb-3">What&apos;s included</h3>
                  <ul className="space-y-2">
                    {content.whatsIncluded.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-black">
                        <Check className="w-4 h-4 text-violet mt-1 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-violet text-lg mb-1">What you get</h3>
                  <ul className="space-y-2">
                    {content.whatYouGet.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-black">
                        <Check className="w-4 h-4 text-violet mt-1 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="rounded-lg border border-border-color p-5 bg-white/80 space-y-4">
                <div>
                  <h3 className="text-violet text-lg mb-1">Who this is for</h3>
                  <p className="text-black">{content.whoThisIsFor}</p>
                </div>
                <div>
                  <h3 className="text-violet text-lg mb-1">Who this is NOT for</h3>
                  <p className="text-black">{content.whoThisIsNotFor}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <Button
                type="button"
                variant="primary"
                className="px-10"
                onClick={() => setIsFlipped(true)}
              >
                {content.buttonLabel}
              </Button>
            </div>
          </Card>
        </div>

        <div className="absolute inset-0 [transform:rotateY(180deg)] [backface-visibility:hidden]">
          <Card className="p-8 !bg-violet !border-violet/40 text-off-white">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h3 className="text-2xl text-white">Book Meeting with an Expert</h3>
                <p className="text-white/80 text-sm">{content.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsFlipped(false)}
                className="text-white/80 hover:text-white text-sm underline underline-offset-4"
              >
                Back
              </button>
            </div>

            <CrmChallengesForm
              formName={'Pricing Spotlight Request Book Meeting with an Expert'}
            />
          </Card>
        </div>
      </motion.div>
    </div>
  );
};

export const Pricing: React.FC = () => {
  const [selectedCategory, setSelectedCategory] =
    React.useState("Implementation");
  const [spotlightContent] = React.useState<PricingSpotlightCardContent>(() => {
    const randomIndex = Math.floor(Math.random() * pricingSpotlightConfig.length);
    return pricingSpotlightConfig[randomIndex];
  });

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

  const filteredPackages = pricingPackages.filter(
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
      "mainEntity": { "@id": "https://klepka.solutions/pricing#faq" },
      "speakable": {
        "@type": "SpeakableSpecification",
        "cssSelector": ["h1", "h2", "h3"]
      },
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
      "@id": "https://klepka.solutions/pricing#faq",
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
        },
        {
          "@type": "Question",
          "name": "Does Klepka offer Salesforce outsourcing or outstaff services?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. Klepka provides certified Salesforce administrators and consultants on an outsource and outstaff basis. Our Support packages give you dedicated Salesforce specialists — from a single admin (Support Starter, from $1,400 · 10 hrs) to a team of up to 3 specialists (Support Enterprise, from $8,400 · 60 hrs) — without the overhead of hiring in-house."
          }
        },
        {
          "@type": "Question",
          "name": "Can I hire a Salesforce administrator from Klepka?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. Through Klepka's Support packages you get access to certified Salesforce administrators who handle day-to-day platform management, configuration changes, flow updates, reports, and ongoing improvements. This is an outsource or outstaff engagement — your dedicated admin works as part of your team without you needing to hire full-time."
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

        <section className="py-10 px-4 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-7xl mx-auto">
            <PricingSpotlightCard content={spotlightContent} />
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
              {pricingCategories.map((cat) => (
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
