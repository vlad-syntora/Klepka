import React from 'react';
import { Mail, Phone } from 'lucide-react';
import { initialsOf, prettyName } from '@/app/lib/portal-format';
import type { AccountTeamMember, ProjectBundle } from '@/app/lib/portal-types';
import { PortalCard } from '@/app/components/portal/PortalUi';

interface Person {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  photoUrl: string | null;
}

type OwnerEmbed = {
  id: string;
  full_name: string;
  title: string | null;
  email?: string;
  photo_url?: string | null;
} | null | undefined;

interface Section {
  key: string;
  title: string;
  people: Person[];
}

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
    className="flex h-8 w-8 items-center justify-center rounded-full border border-border-color text-grey"
    aria-hidden
    title={label}
  >
    {children}
  </span>
);

const PersonRow: React.FC<{ person: Person }> = ({ person }) => (
  <li className="flex items-center gap-3 py-3">
    <Avatar person={person} />
    <div className="min-w-0 flex-1">
      <div className="truncate text-sm font-medium">{prettyName(person.name)}</div>
      {person.title && <div className="truncate text-xs text-grey">{person.title}</div>}
    </div>
    <div className="flex shrink-0 items-center gap-1.5">
      {/* Phone is UI-only for now — behaviour comes later. */}
      <button type="button" aria-label={`Call ${prettyName(person.name)}`} className="transition-opacity hover:opacity-70">
        <IconButton label="Phone">
          <Phone className="h-4 w-4" />
        </IconButton>
      </button>
      {person.email && (
        <a href={`mailto:${person.email}`} aria-label={`Email ${prettyName(person.name)}`} className="transition-opacity hover:opacity-70">
          <IconButton label={person.email}>
            <Mail className="h-4 w-4" />
          </IconButton>
        </a>
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
}> = ({ klepkaTeam, projects, owner }) => {
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
      })),
  ).filter(notOwner);
  if (preSale.length > 0) sections.push({ key: 'pre-sale', title: 'Pre-sale team', people: preSale });

  for (const bundle of projects) {
    const people = dedup(
      bundle.team
        .filter((member) => member.user)
        .map((member) => ({
          id: member.user!.id,
          name: member.user!.full_name,
          title: member.user!.title ?? member.project_role,
          email: member.user!.email,
          photoUrl: member.user!.photo_url ?? null,
        })),
    ).filter(notOwner);
    if (people.length > 0) sections.push({ key: bundle.project.id, title: bundle.project.name, people });
  }

  if (sections.length === 0) return null;

  return (
    <PortalCard title="Your Klepka team" description="The people working with you — reach any of them directly.">
      <div className="space-y-4">
        {sections.map((section) => (
          <div key={section.key}>
            <div className="text-xs font-semibold uppercase tracking-wide text-grey">{section.title}</div>
            <ul className="divide-y divide-border-color">
              {section.people.map((person) => (
                <PersonRow key={`${section.key}-${person.id}`} person={person} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </PortalCard>
  );
};
