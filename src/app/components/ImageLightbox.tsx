import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface ImageLightboxProps {
  src: string;
  alt: string;
  onClose: () => void;
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({ src, alt, onClose }) => {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <AnimatePresence>
      <motion.div
        key="lightbox-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/75" />
        <motion.div
          key="lightbox-content"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="relative z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute -top-3 -right-3 z-20 bg-card border border-border-color rounded-full p-1.5 text-text-secondary hover:text-violet transition-colors shadow-md cursor-pointer"
            aria-label="Close image"
          >
            <X size={16} />
          </button>
          <img
            src={src}
            alt={alt}
            className="max-w-[90vw] max-h-[85vh] rounded-lg border border-border-color shadow-2xl object-contain"
          />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
