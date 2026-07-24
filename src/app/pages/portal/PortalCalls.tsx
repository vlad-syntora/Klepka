import React from 'react';
import { toast } from 'sonner';
import { ExternalLink } from 'lucide-react';
import { usePortalData } from '@/app/hooks/use-portal-data';
import { cancelMeeting, requestMeeting } from '@/app/lib/portal-api';
import { formatDateTime, isoToLocalInput, localInputToIso, prettyName } from '@/app/lib/portal-format';
import { MEETING_TYPES, MEETING_TYPE_LABELS, type MeetingType } from '@/app/lib/portal-types';
import {
  Cell,
  EmptyState,
  Field,
  InfoNote,
  PortalButton,
  PortalCard,
  PortalTable,
  Row,
  StatusTag,
  humanize,
  inputClass,
  toneFor,
} from '@/app/components/portal/PortalUi';

const defaultStart = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  return isoToLocalInput(date.toISOString());
};

export const PortalCalls: React.FC = () => {
  const { snapshot, reload } = usePortalData();
  const [meetingType, setMeetingType] = React.useState<MeetingType>('discovery');
  const [title, setTitle] = React.useState('');
  const [startsAt, setStartsAt] = React.useState(defaultStart);
  const [duration, setDuration] = React.useState(30);
  const [busy, setBusy] = React.useState(false);

  if (!snapshot) return null;

  const now = Date.now();
  const upcoming = snapshot.meetings
    .filter((meeting) => ['requested', 'confirmed'].includes(meeting.status) && new Date(meeting.starts_at).getTime() >= now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = snapshot.meetings.filter((meeting) => !upcoming.includes(meeting));

  // Klepka people with a personal booking link: the account owner plus the pre-sale team.
  const bookable: { id: string; name: string; label: string; url: string }[] = [];
  const seen = new Set<string>();
  const addBookable = (id: string, name: string, label: string, url?: string | null) => {
    if (url && !seen.has(id)) {
      seen.add(id);
      bookable.push({ id, name, label, url });
    }
  };
  if (snapshot.account.owner) {
    addBookable(
      snapshot.account.owner.id,
      snapshot.account.owner.full_name,
      snapshot.account.owner.title ?? 'Account owner',
      snapshot.account.owner.calendly_url,
    );
  }
  snapshot.klepkaTeam.forEach((member) => {
    if (member.user) addBookable(member.user.id, member.user.full_name, member.team_role, member.user.calendly_url);
  });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await requestMeeting({
        title: title.trim() || MEETING_TYPE_LABELS[meetingType],
        meetingType,
        startsAt: localInputToIso(startsAt),
        durationMinutes: duration,
      });
      toast.success('Request sent — your Klepka contact will confirm the slot.');
      setTitle('');
      await reload();
    } catch (cause) {
      toast.error('Could not request the call', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (id: string) => {
    try {
      await cancelMeeting(id);
      toast.success('Meeting cancelled.');
      await reload();
    } catch (cause) {
      toast.error('Could not cancel', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  return (
    <div className="space-y-5">
      {bookable.length > 0 && (
        <PortalCard
          title="Book directly with your Klepka team"
          description="Pick a time on their calendar — confirmed instantly, no waiting."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {bookable.map((person) => (
              <div
                key={person.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border-color p-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{prettyName(person.name)}</div>
                  <div className="truncate text-xs text-grey">{person.label}</div>
                </div>
                <a href={person.url} target="_blank" rel="noreferrer">
                  <PortalButton variant="secondary">
                    <ExternalLink className="h-4 w-4" /> Book
                  </PortalButton>
                </a>
              </div>
            ))}
          </div>
        </PortalCard>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <PortalCard title="Book a call" description="Pick a slot — your Klepka contact confirms it.">
          <form onSubmit={submit} className="space-y-3">
            <Field label="Meeting type">
              <select
                className={inputClass}
                value={meetingType}
                onChange={(event) => setMeetingType(event.target.value as MeetingType)}
              >
                {MEETING_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {MEETING_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="What would you like to cover?" hint="Optional — defaults to the meeting type.">
              <input
                className={inputClass}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Walk through the migration plan"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Preferred time">
                <input
                  type="datetime-local"
                  className={inputClass}
                  value={startsAt}
                  onChange={(event) => setStartsAt(event.target.value)}
                  required
                />
              </Field>
              <Field label="Duration">
                <select
                  className={inputClass}
                  value={duration}
                  onChange={(event) => setDuration(Number(event.target.value))}
                >
                  {[15, 30, 45, 60, 90].map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes} minutes
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <PortalButton type="submit" disabled={busy}>
              {busy ? 'Sending…' : 'Request this slot'}
            </PortalButton>
          </form>
        </PortalCard>

        <PortalCard title="Upcoming">
          {upcoming.length === 0 ? (
            <EmptyState title="Nothing scheduled" description="Request a slot and we’ll confirm it here." />
          ) : (
            <ul className="divide-y divide-border-color">
              {upcoming.map((meeting) => (
                <li key={meeting.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{meeting.title}</span>
                      <StatusTag tone={toneFor(meeting.status)}>{humanize(meeting.status)}</StatusTag>
                    </div>
                    <div className="mt-0.5 text-xs text-grey">
                      {formatDateTime(meeting.starts_at)} · {meeting.duration_minutes} min
                      {meeting.host?.full_name ? ` · ${prettyName(meeting.host.full_name)}` : ''}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {meeting.location_url && (
                      <a href={meeting.location_url} target="_blank" rel="noreferrer">
                        <PortalButton variant="secondary">
                          <ExternalLink className="h-4 w-4" /> Join
                        </PortalButton>
                      </a>
                    )}
                    <PortalButton variant="ghost" onClick={() => cancel(meeting.id)}>
                      Cancel
                    </PortalButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4">
            <InfoNote>
              Requests are matched against your Klepka contact’s calendar. If the slot is taken, they’ll propose the
              nearest alternative.
            </InfoNote>
          </div>
        </PortalCard>
      </div>

      <PortalCard title="Meeting history">
        {past.length === 0 ? (
          <EmptyState title="No past meetings yet" />
        ) : (
          <PortalTable head={['Type', 'When', 'With', 'Status', 'Notes']}>
            {past.map((meeting) => (
              <Row key={meeting.id}>
                <Cell className="font-medium">{MEETING_TYPE_LABELS[meeting.meeting_type]}</Cell>
                <Cell className="whitespace-nowrap text-grey">{formatDateTime(meeting.starts_at)}</Cell>
                <Cell className="text-grey">{meeting.host ? prettyName(meeting.host.full_name) : '—'}</Cell>
                <Cell>
                  <StatusTag tone={toneFor(meeting.status)}>{humanize(meeting.status)}</StatusTag>
                </Cell>
                <Cell className="max-w-xs text-grey">{meeting.notes || '—'}</Cell>
              </Row>
            ))}
          </PortalTable>
        )}
      </PortalCard>
    </div>
  );
};
