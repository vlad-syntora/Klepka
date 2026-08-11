import React from 'react';
import { toast } from 'sonner';
import { CalendarOff, Check, UserPlus } from 'lucide-react';
import { formatDate, prettyName } from '@/app/lib/portal-format';
import { respondTeamTimeOff } from '@/app/lib/portal-api';
import type { TeamTimeOff } from '@/app/lib/portal-types';
import { EmptyState, PortalButton, PortalCard, StatusTag } from '@/app/components/portal/PortalUi';

const KIND_LABELS: Record<TeamTimeOff['kind'], string> = { vacation: 'Vacation', sick: 'Sick leave' };

// One feed row is a (leave, project) pair — a person on several of the account's projects is confirmed
// once per project, so the row (and its busy state) is keyed by both.
const rowKey = (item: TeamTimeOff) => `${item.id}-${item.project_id}`;

/**
 * "Team time off" card for the client dashboard (migration 0058). Lists the approved vacation / sick
 * leave of Klepka people who are visible members of one of the account's projects. The client can
 * acknowledge each leave (Approve) and — when it spans more than 2 days — request a replacement for the
 * period. Both are per-account signals to Klepka; the feed itself is scoped server-side by the RPC.
 */
export const TeamTimeOffWidget: React.FC<{ items: TeamTimeOff[]; onReload: () => void | Promise<void> }> = ({
  items,
  onReload,
}) => {
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const respond = async (item: TeamTimeOff, approve: boolean, requestReplacement: boolean) => {
    setBusyId(rowKey(item));
    try {
      await respondTeamTimeOff(item.id, item.project_id, approve, requestReplacement);
      await onReload();
    } catch (cause) {
      toast.error('Could not send your response', {
        description: cause instanceof Error ? cause.message : undefined,
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <PortalCard
      title={
        <span className="inline-flex items-center gap-2">
          <CalendarOff className="h-4 w-4 text-violet" /> Team time off
        </span>
      }
      collapseKey="team-time-off"
      description="Upcoming leave for the Klepka people on your projects"
    >
      {items.length === 0 ? (
        <EmptyState title="No upcoming time off" description="Nobody on your projects is scheduled to be away." />
      ) : (
        <ul className="divide-y divide-border-color">
          {items.map((item) => {
            const busy = busyId === rowKey(item);
            const canRequestReplacement = item.days > 2;
            return (
              <li key={rowKey(item)} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{prettyName(item.full_name)}</div>
                    <div className="truncate text-xs text-grey">{item.project_name}</div>
                    <div className="text-xs text-grey">
                      {formatDate(item.start_date)} – {formatDate(item.end_date)} · {item.days} day(s)
                    </div>
                    {item.note && <div className="mt-0.5 truncate text-xs text-grey">{item.note}</div>}
                  </div>
                  <StatusTag tone={item.kind === 'vacation' ? 'violet' : 'amber'}>{KIND_LABELS[item.kind]}</StatusTag>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {item.approved ? (
                    <StatusTag tone="green">
                      <Check className="mr-1 inline h-3 w-3" /> Approved
                    </StatusTag>
                  ) : (
                    <PortalButton variant="secondary" disabled={busy} onClick={() => respond(item, true, item.replacement_requested)}>
                      <Check className="h-4 w-4" /> Approve
                    </PortalButton>
                  )}

                  {item.replacement_requested ? (
                    <StatusTag tone="amber">
                      <UserPlus className="mr-1 inline h-3 w-3" /> Replacement requested
                    </StatusTag>
                  ) : (
                    canRequestReplacement && (
                      <PortalButton variant="ghost" disabled={busy} onClick={() => respond(item, item.approved, true)}>
                        <UserPlus className="h-4 w-4" /> Request replacement
                      </PortalButton>
                    )
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </PortalCard>
  );
};
