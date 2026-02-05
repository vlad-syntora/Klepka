import React, { useRef, useState } from "react";
import { Button } from "./Button";
import { Input, TextArea } from "./Input";
import { toast } from "sonner";
import { sendEmailJsForm } from "../lib/emailjs";

interface CrmChallengesFormProps {
  lightMode?: boolean;
  formName?: string;
}

export const CrmChallengesForm: React.FC<CrmChallengesFormProps> = ({
  lightMode = false,
  formName = "New Client Request",
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    setIsSubmitting(true);

    try {
      await sendEmailJsForm(formEl);
      toast.success("Request submitted!", {
        description:
          "Your request has been sent. We will get back to you shortly.",
      });
      formEl.reset();
    } catch (err) {
      console.error(err);
      toast.error("Couldn't submit the request", {
        description: "Please try again in a moment.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClasses = lightMode
    ? "bg-white text-violet border-border-color"
    : "bg-card-foreground/10 text-off-white border-border-color/30";

  return (
    <form ref={formRef} className="space-y-6" onSubmit={handleSubmit}>
      <input type="hidden" name="form_name" value={formName} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Input
          required
          name="first_name"
          placeholder="First Name"
          className={inputClasses}
        />
        <Input
          required
          name="last_name"
          placeholder="Last name"
          className={inputClasses}
        />
        <Input
          required
          name="company"
          placeholder="Company"
          className={inputClasses}
        />
        <Input name="address" placeholder="Address" className={inputClasses} />
        <Input
          required
          type="email"
          name="reply_to"
          placeholder="your@email.com"
          className={inputClasses}
        />
        <Input
          type="tel"
          name="phone"
          placeholder="+X(XXX)XXX-XXXX"
          className={inputClasses}
        />
      </div>
      <Input
        required
        name="topic"
        placeholder="Topic (e.g., Implementation, Optimization, Integration)"
        className={inputClasses}
      />
      <TextArea
        required
        name="message"
        placeholder="Tell us about your needs..."
        rows={4}
        className={inputClasses}
      />
      <Button
        variant="primary"
        size="lg"
        className={
          lightMode
            ? "w-full"
            : "w-full !bg-white !text-violet hover:!bg-accent-yellow hover:!text-violet ring-2 ring-white/40 ring-offset-2 ring-offset-violet"
        }
        disabled={isSubmitting}
      >
        {isSubmitting ? "Sending..." : "Submit Request"}
      </Button>
    </form>
  );
};
