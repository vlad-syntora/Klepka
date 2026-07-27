import React from 'react';
import { CalendarPlus } from 'lucide-react';
import { openCalendly } from '@/app/lib/calendly';
import { usePortalData } from '@/app/hooks/use-portal-data';
import { usePortalUser } from '@/app/hooks/use-portal-user';
import { prettyName } from '@/app/lib/portal-format';
import { PortalButton } from '@/app/components/portal/PortalUi';

interface Bookable {
  id: string;
  name: string;
  label: string;
  url: string;
}

/**
 * "Book a call" action that carries its own person-picker. Bookable people (the account owner plus
 * the pre-sale team, anyone with a Calendly link) come from the portal snapshot, so this drops in
 * anywhere without wiring. One person → opens their Calendly straight away; several → a small popup
 * to pick right where the button was clicked. Nothing renders if nobody is bookable.
 *
 * `ownerOnly` limits it to the account owner (their Calendly, no picker) — for a widget that's
 * already about one specific contact.
 */
export const BookCallButton: React.FC<{
  variant?: React.ComponentProps<typeof PortalButton>['variant'];
  className?: string;
  fullWidth?: boolean;
  ownerOnly?: boolean;
  children?: React.ReactNode;
}> = ({ variant = 'secondary', className, fullWidth, ownerOnly, children }) => {
  const { snapshot } = usePortalData();
  const { user } = usePortalUser();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDocClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const people: Bookable[] = [];
  const seen = new Set<string>();
  const add = (id: string, name: string, label: string, url?: string | null) => {
    if (url && !seen.has(id)) {
      seen.add(id);
      people.push({ id, name, label, url });
    }
  };
  const owner = snapshot?.account.owner;
  if (owner) add(owner.id, owner.full_name, owner.title ?? 'Account owner', owner.calendly_url);
  if (!ownerOnly) {
    snapshot?.klepkaTeam.forEach((member) => {
      if (member.user) add(member.user.id, member.user.full_name, member.team_role, member.user.calendly_url);
    });
  }

  if (people.length === 0) return null;

  const prefill = user ? { name: prettyName(user.full_name), email: user.email } : undefined;
  const book = (url: string) => {
    setOpen(false);
    void openCalendly(url, prefill);
  };

  return (
    <div ref={ref} className={fullWidth ? 'relative block' : 'relative inline-block'}>
      <PortalButton
        variant={variant}
        className={`${fullWidth ? 'w-full ' : ''}${className ?? ''}`}
        onClick={() => (people.length === 1 ? book(people[0].url) : setOpen((value) => !value))}
      >
        {children ?? (
          <>
            <CalendarPlus className="h-4 w-4" /> Book a call
          </>
        )}
      </PortalButton>

      {open && people.length > 1 && (
        <div className="absolute left-0 z-30 mt-1 min-w-[240px] max-w-[300px] overflow-hidden rounded-lg border border-border-color bg-card p-1 shadow-lg">
          <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-grey">Book with…</div>
          {people.map((person) => (
            <button
              key={person.id}
              type="button"
              onClick={() => book(person.url)}
              className="flex w-full flex-col rounded-md px-3 py-2 text-left transition-colors hover:bg-portal-tint"
            >
              <span className="text-sm font-medium text-foreground">{prettyName(person.name)}</span>
              <span className="text-xs text-grey">{person.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
