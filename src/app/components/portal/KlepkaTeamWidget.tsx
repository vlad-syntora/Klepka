import React from 'react';
import { CalendarPlus, ChevronDown, Mail, MessageSquareHeart } from 'lucide-react';
import { initialsOf, prettyName } from '@/app/lib/portal-format';
import { usePortalUser } from '@/app/hooks/use-portal-user';
import type {
  AccountTeamMember,
  Candidate,
  Opportunity,
  ProjectBundle,
  PublicReview,
  StaffRating,
} from '@/app/lib/portal-types';
import { PortalButton, PortalCard } from '@/app/components/portal/PortalUi';
import { CalendlyButton } from '@/app/components/portal/CalendlyButton';
import { FeedbackDialog } from '@/app/components/portal/FeedbackDialog';
import { RatingSummary, useStaffFeedback } from '@/app/components/portal/StaffRating';

interface Person {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  photoUrl: string | null;
  calendlyUrl: string | null;
  // Offer-derived roster rows have no linked user account, so feedback/ratings don't apply to them.
  canFeedback: boolean;
}

type Prefill = { name?: string; email?: string } | undefined;

type OwnerEmbed = {
  id: string;
  full_name: string;
  title: string | null;
  email?: string;
  photo_url?: string | null;
  calendly_url?: string | null;
} | null | undefined;

interface Section {
  key: string;
  title: string;
  people: Person[];
}

// Remember which team groups the client has collapsed, across reloads. Absent = expanded,
// so every group starts open by default (only explicit collapses are stored).
const COLLAPSE_STORAGE_KEY = 'klepka-team-collapsed';

const readCollapsed = (): Set<string> => {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
};

const useCollapsedSections = () => {
  const [collapsed, setCollapsed] = React.useState<Set<string>>(readCollapsed);

  const toggle = React.useCallback((key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try {
        window.localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        /* ignore storage failures (private mode, quota) */
      }
      return next;
    });
  }, []);

  return { collapsed, toggle };
};

const Avatar: React.FC<{ person: Person }> = ({ person }) =>
  person.photoUrl ? (
    <img src={person.photoUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
  ) : (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-portal-tint text-xs font-semibold text-violet">
      {initialsOf(person.name)}
    </span>
  );

const IconButton: React.FC<{ children: React.ReactNode; label: string }> = ({ children, label }) => (
  <span
    className="flex h-8 w-8 items-center justify-center rounded-full border border-border-color text-grey transition-colors group-hover:bg-portal-tint group-hover:text-violet"
    aria-hidden
    title={label}
  >
    {children}
  </span>
);

const PersonRow: React.FC<{
  person: Person;
  prefill: Prefill;
  onLeaveFeedback: (personId: string) => void;
  rating?: StaffRating;
  reviews?: PublicReview[];
}> = ({ person, prefill, onLeaveFeedback, rating, reviews }) => (
  <li className="flex items-center gap-3 py-3">
    <Avatar person={person} />
    <div className="min-w-0 flex-1">
      <div className="truncate text-sm font-medium">{prettyName(person.name)}</div>
      {person.title && <div className="truncate text-xs text-grey">{person.title}</div>}
      {person.canFeedback && <RatingSummary name={person.name} rating={rating} reviews={reviews} />}
    </div>
    <div className="flex shrink-0 items-center gap-1.5">
      {/* Book a call on this person's own Calendly — shown only when they have a link. */}
      {person.calendlyUrl && (
        <CalendlyButton
          url={person.calendlyUrl}
          prefill={prefill}
          variant="ghost"
          className="h-8 w-8 rounded-full border border-border-color p-0 text-grey hover:bg-portal-tint hover:text-violet"
          aria-label={`Book a call with ${prettyName(person.name)}`}
        >
          <CalendarPlus className="h-4 w-4" />
        </CalendlyButton>
      )}
      {person.email && (
        <a href={`mailto:${person.email}`} aria-label={`Email ${prettyName(person.name)}`} className="group">
          <IconButton label={person.email}>
            <Mail className="h-4 w-4" />
          </IconButton>
        </a>
      )}
      {/* Leave feedback specifically about this person — only for people with a real user account. */}
      {person.canFeedback && (
        <button
          type="button"
          onClick={() => onLeaveFeedback(person.id)}
          aria-label={`Leave feedback about ${prettyName(person.name)}`}
          title={`Leave feedback about ${prettyName(person.name)}`}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border-color text-grey transition-colors hover:bg-portal-tint hover:text-violet"
        >
          <MessageSquareHeart className="h-4 w-4" />
        </button>
      )}
    </div>
  </li>
);

/**
 * "Your Klepka team" — the people working this account, grouped by how they're staffed:
 * the pre-sale team first, then one group per project. Empty groups are hidden entirely, and the
 * whole card disappears if nobody is staffed anywhere.
 */
export const KlepkaTeamWidget: React.FC<{
  klepkaTeam: AccountTeamMember[];
  projects: ProjectBundle[];
  owner?: OwnerEmbed;
  /** Approved (confirmed) candidates, grouped into a team per opportunity they were staffed on. */
  candidates?: Candidate[];
  opportunities?: Opportunity[];
}> = ({ klepkaTeam, projects, owner, candidates = [], opportunities = [] }) => {
  // Prefill Calendly with the signed-in client's details so they don't retype them.
  const { user } = usePortalUser();
  const prefill: Prefill = user ? { name: prettyName(user.full_name), email: user.email } : undefined;
  const [feedbackOpen, setFeedbackOpen] = React.useState(false);
  // Which team member the dialog opens pre-set to ('' = general feedback about Klepka).
  const [feedbackAbout, setFeedbackAbout] = React.useState('');
  const { collapsed, toggle } = useCollapsedSections();

  const openFeedback = (personId: string) => {
    setFeedbackAbout(personId);
    setFeedbackOpen(true);
  };

  const dedup = (people: Person[]): Person[] => {
    const seen = new Set<string>();
    return people.filter((person) => (seen.has(person.id) ? false : (seen.add(person.id), true)));
  };

  const sections: Section[] = [];

  if (owner) {
    sections.push({
      key: 'owner',
      title: 'Account owner',
      people: [
        {
          id: owner.id,
          name: owner.full_name,
          title: owner.title,
          email: owner.email ?? null,
          photoUrl: owner.photo_url ?? null,
          calendlyUrl: owner.calendly_url ?? null,
          canFeedback: true,
        },
      ],
    });
  }

  // The owner already has their own section — don't repeat them below.
  const notOwner = (person: Person) => person.id !== owner?.id;

  const preSale = dedup(
    klepkaTeam
      .filter((member) => member.user)
      .map((member) => ({
        id: member.user!.id,
        name: member.user!.full_name,
        title: member.user!.title ?? member.team_role,
        email: member.user!.email,
        photoUrl: member.user!.photo_url ?? null,
        calendlyUrl: member.user!.calendly_url ?? null,
        canFeedback: true,
      })),
  ).filter(notOwner);
  if (preSale.length > 0) sections.push({ key: 'pre-sale', title: 'Pre-sale team', people: preSale });

  for (const bundle of projects) {
    // Include offer-derived roster rows (no linked user, just a display_name) so the project team
    // shows up here too — not only members backed by a real user account.
    const people = dedup(
      bundle.team
        .filter((member) => member.user || member.display_name)
        .map((member) =>
          member.user
            ? {
                id: member.user.id,
                name: member.user.full_name,
                title: member.user.title ?? member.project_role,
                email: member.user.email,
                photoUrl: member.user.photo_url ?? null,
                calendlyUrl: member.user.calendly_url ?? null,
                canFeedback: true,
              }
            : {
                id: member.id,
                name: member.display_name as string,
                title: member.project_role,
                email: null,
                photoUrl: null,
                calendlyUrl: null,
                canFeedback: false,
              },
        ),
    ).filter(notOwner);
    if (people.length > 0) sections.push({ key: bundle.project.id, title: bundle.project.name, people });
  }

  // Approved candidates become the opportunity's staffed team — one group per opportunity that
  // has at least one confirmed candidate.
  for (const opp of opportunities) {
    const people = dedup(
      candidates
        .filter((candidate) => candidate.opportunity_id === opp.id && candidate.status === 'confirmed' && candidate.user)
        .map((candidate) => ({
          id: candidate.user!.id,
          name: candidate.user!.full_name,
          title: candidate.title ?? candidate.user!.title,
          email: candidate.user!.email,
          photoUrl: candidate.user!.photo_url ?? null,
          calendlyUrl: candidate.user!.calendly_url ?? null,
          canFeedback: true,
        })),
    ).filter(notOwner);
    if (people.length > 0) sections.push({ key: `opp-${opp.id}`, title: opp.name, people });
  }

  // One shared lookup of ratings + public reviews for everyone shown in the card.
  const { ratings, reviews } = useStaffFeedback(sections.flatMap((section) => section.people.map((person) => person.id)));

  if (sections.length === 0) return null;

  return (
    <PortalCard
      title="Your Klepka Team"
      action={
        <PortalButton variant="secondary" onClick={() => openFeedback('')}>
          <MessageSquareHeart className="h-4 w-4" /> Leave feedback
        </PortalButton>
      }
    >
      <div className="space-y-4">
        {sections.map((section) => {
          const isCollapsed = collapsed.has(section.key);
          const bodyId = `klepka-team-${section.key}`;
          return (
            <div key={section.key}>
              <button
                type="button"
                onClick={() => toggle(section.key)}
                aria-expanded={!isCollapsed}
                aria-controls={bodyId}
                className="flex w-full items-center justify-between gap-2 text-left text-xs font-semibold uppercase tracking-wide text-grey transition-colors hover:text-violet"
              >
                <span className="truncate">
                  {section.title}
                  <span className="ml-1.5 font-normal normal-case text-grey/70">({section.people.length})</span>
                </span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                />
              </button>
              {!isCollapsed && (
                <ul id={bodyId} className="divide-y divide-border-color">
                  {section.people.map((person) => (
                    <PersonRow
                      key={`${section.key}-${person.id}`}
                      person={person}
                      prefill={prefill}
                      onLeaveFeedback={openFeedback}
                      rating={ratings.get(person.id)}
                      reviews={reviews.get(person.id)}
                    />
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <FeedbackDialog
        open={feedbackOpen}
        initialAbout={feedbackAbout}
        onClose={() => setFeedbackOpen(false)}
      />
    </PortalCard>
  );
};
