import React from 'react';
import { motion } from 'motion/react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className = '', hover = true }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      whileHover={hover ? { y: -4, boxShadow: '0 12px 24px rgba(0, 0, 0, 0.08)' } : {}}
      className={`bg-card border border-border-color rounded-lg p-6 shadow-sm transition-shadow ${className}`}
    >
      {children}
    </motion.div>
  );
};
