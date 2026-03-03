import React from 'react';
import { motion } from 'motion/react';
import { Card } from '../components/Card';
import { Award, Users, Globe, TrendingUp } from 'lucide-react';

export const About: React.FC = () => {

  const timeline = [
    { year: '2023', title: 'Platform Partnerships', description: 'Became official Salesforce and HubSpot partners' },
    { year: '2021', title: 'Enterprise Clients', description: 'Expanded to serve Fortune 500 companies' },
    { year: '2019', title: 'Salesforce Certifications', description: 'Team achieved 10+ Salesforce certifications' },
    { year: '2026', title: 'Founded', description: 'Started with a mission to simplify CRM for growing businesses', isRoot: true },
  ];

  return (
    <div className="pt-14 lg:pt-32">
      {/* Hero Section */}
      <section className="pb-0 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <h1 className="text-3xl sm:text-4xl mb-6 text-violet">
             Our Team
            </h1>
            <p className="text-xl text-text-secondary leading-relaxed mb-8">
              Founded by two Salesforce experts with experience working on systems at different stages, from early implementations to complex, evolving environments.
              We bring that experience into every project, focusing on practical, structured solutions that make clients’ work easier over time.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Mission 
      <section className="py-12 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-4xl mb-6 text-violet">Our Mission</h2>
            <p className="text-xl text-text-secondary leading-relaxed">
              We believe that CRM systems should empower teams, not frustrate them. Our mission is to design and implement Salesforce solutions that match the way your business actually works—creating clarity, reducing friction, and driving measurable revenue growth.
            </p>
          </motion.div>
        </div>
      </section> */}

      
      {/* Values */}
      <section className="py-6 px-4 sm:px-6 lg:px-8 bg-violet text-off-white">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-6"
          >
            
          </motion.div>

          <div 
            className="gap-8"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
              gap: '32px'
            }}
          >
            {[
              {
                title: 'About Us',
                description: 'We build Salesforce CRM systems designed to scale with real business requirements.\nOur focus is full-cycle Salesforce delivery, from initial architecture and implementation to integrations and long-term system support.',
                isList: false,
              },
              {
                title: 'What we actually do',
                description: 'System architecture and design\nCustom CRM implementation\nIntegrations with external systems\nAutomation and ongoing support',
                isList: true,
              },
              {
                title: 'How we work',
                description: 'Structured delivery with clear responsibility.\nTechnical decisions based on long-term system behavior.\nFocus on scalability rather than short-term fixes.',
                isList: false,
              },
            ].map((value, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <h3 className="text-xl mb-3">{value.title}</h3>
                {value.isList ? (
                  <ul className="space-y-2 ml-15 leading-relaxed text-left">
                    {value.description.split('\n').map((item, i) => (
                      <li key={i}>• {item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="leading-relaxed whitespace-pre-line text-left">{value.description}</p>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Team Structure Section */}
      <section className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-12">

          {/* Left: Our Team Structure */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center max-w-3xl mx-auto mb-6"
            >
              <h2 className="text-3xl sm:text-4xl mb-4 text-violet">Our Team Structure</h2>
              <p className="text-text-secondary">Meet Our Founders</p>
            </motion.div>

            <div
              className="grid gap-6"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}
            >
              {[
                {
                  name: 'Sergii Romashov',
                  title: 'CEO',
                  description: 'Having 7+ years of overall extensive experience in Salesforce analysis and implementation, with strong technical and functional aspects, and expertise in managing a team and leading it. Proven track record in designing and delivering scalable end-to-end solutions as well as integrations with third-party systems. Comprehensive background in designing highly efficient end-to-end solutions for Sales, Service, and Experience Cloud. Strong leadership background with experience building and leading Salesforce Administrator teams, mentoring professionals, and conducting educational programs. Excellent analytical and communication skills with a focus on driving efficiency, adoption, and cross-functional collaboration.',
                  years: 7,
                  logos: ['/assets/82604211df267665aa3c66c85446c94b2ee6cd46.png','/assets/aed582af24f5014b836a133be5f05bf36a841cd1.png','/assets/pardot-specialist.png']
                },
                {
                  name: 'Daria Ezerovych',
                  title: 'CTO',
                  description: 'Senior Salesforce Consultant with 6+ years of experience delivering complex multi-cloud solutions (Sales, Service, Experience, CRMA). Strong background in solution design, technical discovery, and effort estimation within enterprise sales cycles. Actively supports pre-sales engagements by leading workshops, defining architecture, preparing estimates, and presenting solutions to stakeholders. Proven ability to translate business requirements into scalable Salesforce ecosystems that drive measurable outcomes. Combines technical depth with strong communication skills to build client trust and accelerate deal closure.',
                  years: 6,
                  logos: ['/assets/82604211df267665aa3c66c85446c94b2ee6cd46.png','/assets/aed582af24f5014b836a133be5f05bf36a841cd1.png','/assets/7366f5a4c28ad07c8d9e9f7ffadee0e142693189.png','/assets/e2a3731ce5c28b0aaeabca19fd7e3c14965d21ca.png','/assets/16a5ea898db9e45a4dda47b5fd950a3b1ec8a9b5.png','/assets/3550a6afca687e342a05d1e6c391a8dbfbdb5561.png']
                }
              ].map((person, idx) => (
                <TeamPersonCard key={idx} person={person} />
              ))}
            </div>
          </div>

          {/* Right: Company Team Structure */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mb-6"
            >
              <h3 className="text-2xl mb-2">Company Team Structure</h3>
              <p className="text-text-secondary mb-4">Explore teams and their members.</p>
            </motion.div>

            <div className="space-y-4">
              <AccordionTeam title="Salesforce Admin Team">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SimpleMemberCard name="Kateryna S." role="Salesforce Admin" phone="+380501234567" email="kateryna@example.com" />
                  <SimpleMemberCard name="Ivan K." role="Salesforce Admin" phone="+380671234567" email="ivan@example.com" />
                </div>
              </AccordionTeam>

              <AccordionTeam title="Engineering Team">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SimpleMemberCard name="Dmytro P." role="Engineer" phone="+380631234567" email="dmytro@example.com" />
                </div>
              </AccordionTeam>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};



/* Helper components used only in this file */

function TeamPersonCard({ person }: { person: { name: string; title: string; description: string; years: number; logos: string[] } }) {
  const [isFlipped, setIsFlipped] = React.useState(false);

  const frontCardClasses = `bg-card border border-border-color rounded-lg p-6 shadow-sm transition-shadow h-full flex flex-col hover:shadow-lg`;
  const backCardClasses = `bg-violet border border-violet/40 rounded-lg p-6 shadow-sm h-full flex flex-col text-off-white`;

  const downloadVCard = () => {
    const vcard = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${person.name}`,
      `TITLE:${person.title}`,
      `TEL;TYPE=WORK,VOICE:${'+380000000000'}`,
      `EMAIL;TYPE=INTERNET:${person.name.replace(/\s+/g, '.').toLowerCase()}@example.com`,
      'END:VCARD'
    ].join('\r\n');

    const blob = new Blob([vcard], { type: 'text/vcard' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${person.name.replace(/\s+/g, '_')}.vcf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ perspective: '1200px' }}>
      <motion.div
        className="relative h-full [transform-style:preserve-3d]"
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
      >
        {/* Front */}
        <div className="h-full [backface-visibility:hidden]">
          <div className={frontCardClasses} data-package-card="true">
            <div className="flex flex-col items-center">
              <div className="w-28 h-28 rounded-full bg-card-foreground/10 mb-4 flex items-center justify-center overflow-hidden">
                <img src="/assets/avatar-placeholder.png" alt={person.name} className="w-full h-full object-cover" />
              </div>
              <h3 className="text-xl font-semibold mb-1">{person.name}</h3>
              <p className="text-sm text-grey mb-3">{person.title}</p>
              <p className="text-sm text-text-secondary mb-3">{person.description}</p>
              <p className="text-sm text-violet font-medium mb-3">{person.years} years of experience</p>

              <div className="w-full overflow-hidden mb-4">
                <motion.div
                  className="flex items-center gap-4"
                  animate={{ x: [0, -120, 0] }}
                  transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                >
                  {person.logos.map((l, i) => (
                    <div key={i} className="w-20 h-12 bg-white rounded flex items-center justify-center p-2">
                      <img src={l} alt={`cert-${i}`} className="max-h-8 object-contain" />
                    </div>
                  ))}
                </motion.div>
              </div>

              <button onClick={() => setIsFlipped(true)} className="mt-auto bg-violet text-white px-4 py-2 rounded-md">Contact Information</button>
            </div>
          </div>
        </div>

        {/* Back */}
        <div className="absolute inset-0 h-full [transform:rotateY(180deg)] [backface-visibility:hidden]">
          <div className={backCardClasses}>
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h3 className="text-xl font-bold">{person.name}</h3>
                <p className="text-white/80 text-sm">{person.title}</p>
              </div>
              <button onClick={() => setIsFlipped(false)} className="text-white/80 hover:text-white text-sm underline underline-offset-4">Back</button>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-sm text-white/80">Phone</div>
                <div className="text-white">+380 00 000 0000</div>
              </div>
              <div>
                <div className="text-sm text-white/80">Email</div>
                <div className="text-white">{person.name.replace(/\s+/g, '.').toLowerCase()}@example.com</div>
              </div>
              <div>
                <div className="text-sm text-white/80">LinkedIn</div>
                <a className="text-white underline" href="#">https://linkedin.com/in/{person.name.replace(/\s+/g, '-').toLowerCase()}</a>
              </div>
            </div>

            <div className="mt-auto flex gap-3">
              <button onClick={downloadVCard} className="bg-white text-violet px-3 py-2 rounded-md">Add Contact</button>
              <button onClick={() => setIsFlipped(false)} className="text-white underline">Back</button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function AccordionTeam({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="border border-border-color rounded-lg p-4">
      <button onClick={() => setOpen((s) => !s)} className="w-full text-left flex items-center justify-between">
        <span className="font-medium">{title}</span>
        <span className="text-sm text-text-secondary">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && <div className="mt-4">{children}</div>}
    </div>
  );
}

function SimpleMemberCard({ name, role, phone, email }: { name: string; role: string; phone: string; email: string }) {
  return (
    <div className="bg-card border border-border-color rounded-lg p-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-card-foreground/10 flex items-center justify-center overflow-hidden">
          <img src="/assets/avatar-placeholder.png" alt={name} className="w-full h-full object-cover" />
        </div>
        <div>
          <div className="font-medium">{name}</div>
          <div className="text-sm text-text-secondary">{role}</div>
        </div>
      </div>
      <div className="mt-3 text-sm">
        <div>Phone: {phone}</div>
        <div>Email: {email}</div>
      </div>
    </div>
  );
}
