import React, { useState } from 'react';
import { Button } from './Button';
import { Input, TextArea } from './Input';
import { toast } from 'sonner';

interface CrmChallengesFormProps {
  lightMode?: boolean;
}

export const CrmChallengesForm: React.FC<CrmChallengesFormProps> = ({ lightMode = false }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    toast.success('Request submitted!', {
      description: 'An email with your details has been sent to dme85928@gmail.com. We will get back to you shortly.',
    });
    
    setIsSubmitting(false);
    (e.target as HTMLFormElement).reset();
  };

  const inputClasses = lightMode 
    ? "bg-white text-violet border-border-color" 
    : "bg-card-foreground/10 text-off-white border-border-color/30";

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Input
          required
          placeholder="First Name"
          className={inputClasses}
        />
        <Input
          required
          placeholder="Last name"
          className={inputClasses}
        />
        <Input
          required
          placeholder="Company"
          className={inputClasses}
        />
        <Input
          placeholder="Address"
          className={inputClasses}
        />
        <Input
          required
          type="email"
          placeholder="your@email.com"
          className={inputClasses}
        />
        <Input
          type="tel"
          placeholder="+X(XXX)XXX-XXXX"
          className={inputClasses}
        />
      </div>
      <Input
        required
        placeholder="Topic (e.g., Implementation, Optimization, Integration)"
        className={inputClasses}
      />
      <TextArea
        required
        placeholder="Tell us about your needs..."
        rows={4}
        className={inputClasses}
      />
      <Button 
        variant="primary" 
        size="lg" 
        className="w-full"
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Sending...' : 'Submit Request'}
      </Button>
    </form>
  );
};
