import React from 'react';
import { toast } from 'sonner';
import { CalendarPlus } from 'lucide-react';
import { openCalendly } from '@/app/lib/calendly';
import { PortalButton } from '@/app/components/portal/PortalUi';

/**
 * Opens a person's Calendly popup in-portal. Use anywhere a "book a call" action needs to run off a
 * staff member's personal scheduling link (portal_users.calendly_url).
 */
export const CalendlyButton: React.FC<{
  url: string;
  prefill?: { name?: string; email?: string };
  variant?: React.ComponentProps<typeof PortalButton>['variant'];
  className?: string;
  children?: React.ReactNode;
  ['aria-label']?: string;
}> = ({ url, prefill, variant = 'secondary', className, children, ...rest }) => {
  const [busy, setBusy] = React.useState(false);

  const open = async () => {
    setBusy(true);
    try {
      await openCalendly(url, prefill);
    } catch (cause) {
      toast.error('Could not open the booking window', {
        description: cause instanceof Error ? cause.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <PortalButton variant={variant} className={className} disabled={busy} onClick={open} {...rest}>
      {children ?? (
        <>
          <CalendarPlus className="h-4 w-4" /> Book a call
        </>
      )}
    </PortalButton>
  );
};
