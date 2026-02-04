import React from 'react';
import { motion } from 'motion/react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Check, Info } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { CrmChallengesForm } from '../components/CrmChallengesForm';

type PricingCategory = {
  id: string;
  label: string;
};

type PricingPackage = {
  name: string;
  category: string;
  description: string;
  estimate: string;
  subtitle: string;
  price: string;
  features: string[];
  popular?: boolean;
};

export const Pricing: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = React.useState('Implementation');

  const categories: PricingCategory[] = [
    { id: 'Implementation', label: 'Implementation'},
    { id: 'Support', label: 'Support' },
    { id: 'CRM Audit', label: 'CRM Audit' },
    { id: 'Trainings', label: 'Trainings' },
    { id: 'Migration', label: 'Migration' },
    { id: 'Optimizations', label: 'Optimizations' },
    { id: 'Custom Configuration', label: 'Custom Configuration' },
  ];

  const packages: PricingPackage[] = [
    {
      name: 'Support Starter',
      category: 'Support',
      description: 'Reliable Salesforce support for small teams and stable orgs',
      estimate: 'Starting from 10 hours per month',
      subtitle: 'For companies that need day-to-day Salesforce assistance without a full-time admin.',
      price: 'Starting from $1400 per month',
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
      estimate: 'Starting from 25 hours per month',
      subtitle: 'For growing teams that want continuous system improvements, not just fixes.',
      price: 'Starting from $3500 per month',
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
      estimate: 'Starting from 60 hours per month',
      subtitle: 'For complex orgs that require reliability, control, and architectural oversight.',
      price: 'Starting from $8400 per month',
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
      estimate: 'Starting from 50 hours per month',
      subtitle: 'To identify risks, technical debt, and quick wins.',
      price: 'Starting from $3500 per month',
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
      estimate: 'Starting from 80 hours per month',
      subtitle: 'For teams lacking transparency and internal Salesforce knowledge.',
      price: 'Starting from $5600 per month',
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
      estimate: 'Starting from 120 hours per month',
      subtitle: 'To stabilize Salesforce and immediately improve performance and usability.',
      price: 'Starting from $8400 per month',
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
      estimate: 'Starting from 12 hours per month',
      subtitle: 'To ensure users adopt Salesforce correctly from day one.',
      price: 'Starting from $1680 per month',
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
      estimate: 'Starting from 24 hours per month',
      subtitle: 'To reduce support load and increase productivity.',
      price: 'Starting from $3360 per month',
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
      estimate: 'Starting from 50 hours per month',
      subtitle: 'For large teams with frequent onboarding and complex roles.',
      price: 'Starting from $7000 per month',
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
      estimate: 'Starting from 80 hours per month',
      subtitle: 'To launch or reset Salesforce sales processes quickly and correctly.',
      price: 'Starting from $4800 per month',
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
      estimate: 'Starting from 90 hours per month',
      subtitle: 'To enable support teams to work efficiently in Salesforce.',
      price: 'Starting from $5400 per month',
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
      estimate: 'Starting from 80 hours per month',
      subtitle: 'To enable self-service and collaboration with external users.',
      price: 'Starting from $4800 per month',
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
      estimate: 'Starting from 140 hours per month',
      subtitle: 'For teams with complex sales processes and reporting needs.',
      price: 'Starting from $8400 per month',
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
      estimate: 'Starting from 160 hours per month',
      subtitle: 'For high-volume or multi-team support environments.',
      price: 'Starting from $9600 per month',
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
      estimate: 'Starting from 140 hours per month',
      subtitle: 'For complex external user scenarios and integrations.',
      price: 'Starting from $8400 per month',
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
      estimate: 'Starting from 80 hours per month',
      subtitle: 'To safely introduce AI-driven assistance into service or sales workflows.',
      price: 'Starting from $4800 per month',
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
      estimate: 'Starting from 80 hours per month',
      subtitle: 'For leadership and operations teams that need reliable, actionable insights from Salesforce data instead of static reports.',
      price: 'Starting from $4800 per month',
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
      estimate: 'Starting from 40 hours per month',
      subtitle: 'To automate document signing and status tracking.',
      price: 'Starting from $1800 per month',
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
      estimate: 'Starting from 80 hours per month',
      subtitle: 'For companies adopting Salesforce or replacing legacy CRMs.',
      price: 'Starting from $4800 per month',
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
      estimate: 'Starting from 220 hours per month',
      subtitle: 'After mergers, acquisitions, or multi-org growth.',
      price: 'Starting from $13200 per month',
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
      estimate: 'Starting from 80 hours per month',
      subtitle: 'To reduce automation failures and future change costs.',
      price: 'Starting from $4800 per month',
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
      estimate: 'Starting from 80 hours per month',
      subtitle: 'To reduce risk and prepare for long-term platform stability.',
      price: 'Starting from $4800 per month',
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
      estimate: 'Starting from 80 hours per month',
      subtitle: 'To reduce defects and technical debt in custom development.',
      price: 'Starting from $4800 per month',
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
      estimate: 'Starting from 100 hours per month',
      subtitle: 'To unlock modern UX, automation, and new Salesforce features.',
      price: 'Starting from $4000 per month',
      features: [
        'Readiness assessment',
        'Lightning apps and pages',
        'User enablement',
        'Pilot and production rollout',
      ],
    },
  ];

  const filteredPackages = packages.filter(pkg => pkg.category === selectedCategory);

  return (
    <Tooltip.Provider>
      <div className="min-h-screen pt-24 lg:pt-32">
        {/* Hero Section */}
        <section className="pb-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center max-w-3xl mx-auto"
            >
              <h1 className="text-4xl sm:text-10xl mb-6 text-violet">
                Transparent Pricing. Predictable Scope.
              </h1>
              <p className="text-lg text-text-secondary leading-relaxed">
                Starting prices based on proven delivery frameworks.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Category Filter */}
        <section className="pb-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-wrap justify-center gap-4">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center space-x-2 px-6 py-4 rounded-xl border transition-all cursor-pointer ${
                    selectedCategory === cat.id
                      ? 'bg-violet text-white border-violet shadow-lg scale-105'
                      : 'bg-white text-violet border-border-color hover:border-violet hover:bg-white/10'
                  }`}
                >
                  <span className="font-semibold">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Service Packages */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-7xl mx-auto">
            {selectedCategory === 'Custom Configuration' ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-2xl mx-auto"
              >
                <Card className="p-8">
                  <div className="text-center mb-8">
                    <h3 className="text-2xl text-violet mb-2">Request Custom Configuration</h3>
                    <p className="text-grey">
                      Tell us about your specific CRM requirements and we'll build a tailored proposal for you.
                    </p>
                  </div>
                  <CrmChallengesForm lightMode />
                </Card>
              </motion.div>
            ) : (
              <motion.div 
                layout
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 justify-center"
              >
                {filteredPackages.map((pkg, index) => (
                  <motion.div
                    key={`${pkg.category}-${pkg.name}`}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card className={`h-full flex flex-col ${pkg.popular ? 'border-violet border-2 shadow-lg' : ''}`}>
                      {pkg.popular && (
                        <div className="bg-violet text-white text-sm font-medium px-4 py-1 rounded-full inline-block mb-4 w-fit">
                          Most Popular
                        </div>
                      )}
                      <h3 className="text-2xl mb-2 text-violet">{pkg.name}</h3>
                      <p className="text-grey mb-4">{pkg.subtitle}</p>
                      <p className="text-3xl font-semibold text-violet mb-4">{pkg.price}</p>
                      
                      <div className="mb-6 space-y-2 border-t border-border-color pt-4 text-sm">
                        <p className="text-grey leading-relaxed">
                          {pkg.description}
                        </p>
                        <p className="text-violet font-medium">
                          {pkg.estimate}
                        </p>
                      </div>

                      <ul className="space-y-3 mb-8 flex-grow">
                        {pkg.features.map((feature, idx) => (
                          <li key={idx} className="flex items-start space-x-3">
                            <Check className="w-5 h-5 text-violet flex-shrink-0 mt-0.5" />
                            <span className="text-black">{feature}</span>
                          </li>
                        ))}
                      </ul>
                      
                      <Button
                        variant={pkg.popular ? 'primary' : 'ghost'}
                        className="w-full mt-auto"
                      >
                        Get Started
                      </Button>
                    </Card>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        </section>

        {/* Additional Info */}
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <Card>
              <h3 className="text-2xl mb-4 text-violet">What's Included</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-grey">
                <div>
                  <h4 className="text-violet font-medium mb-2">All Packages Include:</h4>
                  <ul className="space-y-2">
                    <li className="flex items-start space-x-2">
                      <Check className="w-4 h-4 text-violet mt-1 flex-shrink-0" />
                      <span>Initial discovery & planning</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <Check className="w-4 h-4 text-violet mt-1 flex-shrink-0" />
                      <span>Data migration support</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <Check className="w-4 h-4 text-violet mt-1 flex-shrink-0" />
                      <span>User training sessions</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <Check className="w-4 h-4 text-violet mt-1 flex-shrink-0" />
                      <span>30 days post-launch support</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-violet font-medium mb-2">Payment Terms:</h4>
                  <ul className="space-y-2">
                    <li>• 50% upfront deposit</li>
                    <li>• 50% upon completion</li>
                    <li>• Monthly payment plans available</li>
                    <li>• Money-back guarantee</li>
                  </ul>
                </div>
              </div>
            </Card>
          </div>
        </section>
      </div>
    </Tooltip.Provider>
  );
};