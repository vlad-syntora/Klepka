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
    <div className="pt-24 lg:pt-32">
      {/* Hero Section */}
      <section className="pb-12 px-4 sm:px-6 lg:px-8">
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
      <section className="py-12 px-4 sm:px-6 lg:px-8 bg-violet text-off-white">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
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
                title: 'How we work',
                description: 'Structured delivery with clear responsibility.\nTechnical decisions based on long-term system behavior.\nFocus on scalability rather than short-term fixes.',
                isList: false,
              },
              {
                title: 'What we actually do',
                description: 'System architecture and design\nCustom CRM implementation\nIntegrations with external systems\nAutomation and ongoing support',
                isList: true,
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
                  <ul className="space-y-2 leading-relaxed">
                    {value.description.split('\n').map((item, i) => (
                      <li key={i}>• {item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="leading-relaxed whitespace-pre-line">{value.description}</p>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};