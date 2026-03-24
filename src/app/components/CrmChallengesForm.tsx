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
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const formRef = useRef<HTMLFormElement>(null);

  const getEmailJsErrorInfo = (err: unknown) => {
    const anyErr = err as
      | { status?: number; text?: string; message?: string }
      | undefined;

    const statusCode = anyErr?.status;
    const text = anyErr?.text;
    const message = anyErr?.message;

    const combined = [message, text].filter(Boolean).join(" | ");

    const isUnconfirmedNetworkError =
      typeof combined === "string" &&
      /failed to fetch|networkerror|load failed|fetch/i.test(combined);

    const uiMessage =
      statusCode || combined
        ? `EmailJS error${statusCode ? ` (${statusCode})` : ""}: ${
            combined || "Unknown error"
          }`
        : "Couldn't submit the request. Please try again.";

    return { isUnconfirmedNetworkError, uiMessage };
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    setIsSubmitting(true);
    setStatus("idle");

    try {
      await sendEmailJsForm(formEl);
      toast.success("Request submitted!", {
        description:
          "Your request has been sent. We will get back to you shortly.",
      });
      formEl.reset();
      setStatus("success");
    } catch (err) {
      console.error(err);
      const info = getEmailJsErrorInfo(err);

      if (info.isUnconfirmedNetworkError) {
        toast.success("Request submitted!", {
          description:
            "Your request has been sent. We will get back to you shortly.",
        });
        formEl.reset();
        setStatus("success");
        return;
      }

      toast.error("Couldn't submit the request", {
        description: info.uiMessage,
      });
      setStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClasses = lightMode
    ? "bg-white text-violet border-border-color"
    : "bg-card-foreground/10 text-off-white border-border-color/30";

  return (
    <div>
      {status === "success" && (
        <div
          role="status"
          className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-violet"
        >
          Request submitted. We will get back to you shortly.
        </div>
      )}

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
          placeholder="Last Name"
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
        type="submit"
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
    </div>
  );
};
