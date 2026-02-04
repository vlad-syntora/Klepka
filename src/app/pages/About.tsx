import React from 'react';
import { motion } from 'motion/react';
import { Card } from '../components/Card';
import { Award, Users, Globe, TrendingUp } from 'lucide-react';

export const About: React.FC = () => {
  const stats = [
    { icon: <Users className="w-8 h-8 text-black" />, value: '50+', label: 'CRM Projects Delivered' },
    { icon: <Award className="w-8 h-8 text-black" />, value: '30+', label: 'Salesforce Certifications' },
    { icon: <Globe className="w-8 h-8 text-black" />, value: 'US & EU', label: 'Clients Across Regions' },
    { icon: <TrendingUp className="w-8 h-8 text-black" />, value: '98%', label: 'Client Satisfaction' },
  ];

  const timeline = [
    { year: '2023', title: 'Platform Partnerships', description: 'Became official Salesforce and HubSpot partners' },
    { year: '2021', title: 'Enterprise Clients', description: 'Expanded to serve Fortune 500 companies' },
    { year: '2019', title: 'Salesforce Certifications', description: 'Team achieved 10+ Salesforce certifications' },
    { year: '2026', title: 'Founded', description: 'Started with a mission to simplify CRM for growing businesses', isRoot: true },
  ];

  return (
    <div className="min-h-screen pt-24 lg:pt-32">
      {/* Hero Section */}
      <section className="pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <h1 className="text-4xl sm:text-5xl mb-6 text-violet">
              Built by Engineers <br></br> Trusted by Business Teams
            </h1>
            <p className="text-xl text-text-secondary leading-relaxed mb-8">
              We design CRM systems that scale with your revenue, not against it.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="text-center" hover={false}>
                  <div className="flex justify-center mb-4">{stat.icon}</div>
                  <div className="text-3xl font-semibold text-violet mb-2">{stat.value}</div>
                  <div className="text-text-secondary">{stat.label}</div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
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
      </section>

      
      {/* Values */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-violet text-off-white">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl mb-4">Our Values</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: 'Technical Excellence',
                description: 'We stay ahead of platform updates and best practices to deliver cutting-edge solutions.',
              },
              {
                title: 'Business Focus',
                description: 'Technology serves the business, not the other way around. We prioritize outcomes over features.',
              },
              {
                title: 'Long-term Partnership',
                description: 'We build relationships, not just systems. Your success is our success.',
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
                <p className="text-accent-yellow leading-relaxed">{value.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};