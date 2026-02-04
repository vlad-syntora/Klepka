import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, className = '', ...props }) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm mb-2 text-violet">
          {label}
        </label>
      )}
      <input
        className={`w-full px-4 py-3 bg-card border border-border-color rounded-lg focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent transition-all ${className}`}
        {...props}
      />
      {error && (
        <p className="text-sm text-destructive mt-1">{error}</p>
      )}
    </div>
  );
};

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const TextArea: React.FC<TextAreaProps> = ({ label, error, className = '', ...props }) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm mb-2 text-violet">
          {label}
        </label>
      )}
      <textarea
        className={`w-full px-4 py-3 bg-card border border-border-color rounded-lg focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent transition-all resize-none ${className}`}
        {...props}
      />
      {error && (
        <p className="text-sm text-destructive mt-1">{error}</p>
      )}
    </div>
  );
};
