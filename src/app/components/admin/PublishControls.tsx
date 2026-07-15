import React from 'react';
import { format } from 'date-fns';
import { Archive, CalendarClock, Save, Send } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Calendar } from '../ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import type { ArticleStatus } from '@/app/lib/articles-types';

export type PublishAction =
  | { type: 'save' }
  | { type: 'publish' }
  | { type: 'schedule'; at: string }
  | { type: 'archive' };

interface PublishControlsProps {
  status: ArticleStatus;
  publishAt: string | null;
  saving: boolean;
  onAction: (action: PublishAction) => void;
}

const statusLabel: Record<ArticleStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  published: 'Published',
  archived: 'Archived',
};

export const PublishControls: React.FC<PublishControlsProps> = ({
  status,
  publishAt,
  saving,
  onAction,
}) => {
  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [date, setDate] = React.useState<Date | undefined>(
    publishAt ? new Date(publishAt) : undefined,
  );
  const [time, setTime] = React.useState(publishAt ? format(new Date(publishAt), 'HH:mm') : '09:00');

  const handleSchedule = () => {
    if (!date) return;
    const [hours, minutes] = time.split(':').map(Number);
    const at = new Date(date);
    at.setHours(hours, minutes, 0, 0);
    onAction({ type: 'schedule', at: at.toISOString() });
    setScheduleOpen(false);
  };

  return (
    <div className="bg-card border border-border-color rounded-lg shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-violet">Status</span>
        <Badge variant="outline" className="text-violet border-violet/30">
          {statusLabel[status]}
        </Badge>
      </div>

      {status === 'scheduled' && publishAt && (
        <p className="text-xs text-text-secondary">
          Goes live {format(new Date(publishAt), 'MMM d, yyyy HH:mm')}
        </p>
      )}

      <div className="grid gap-2">
        <button
          type="button"
          onClick={() => onAction({ type: 'save' })}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 border border-border-color rounded-lg px-4 py-2 text-sm hover:border-violet hover:text-violet transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {status === 'published' ? 'Save changes' : 'Save draft'}
        </button>

        {status !== 'published' && (
          <button
            type="button"
            onClick={() => onAction({ type: 'publish' })}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 bg-violet text-white rounded-lg px-4 py-2 text-sm hover:bg-violet/90 transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            Publish now
          </button>
        )}

        {status !== 'published' && status !== 'archived' && (
          <Popover open={scheduleOpen} onOpenChange={setScheduleOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 border border-border-color rounded-lg px-4 py-2 text-sm hover:border-violet hover:text-violet transition-colors disabled:opacity-50"
              >
                <CalendarClock className="w-4 h-4" />
                Schedule...
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3" align="end">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                disabled={{ before: new Date() }}
              />
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="time"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                  aria-label="Publish time"
                  className="flex-1 px-3 py-1.5 border border-border-color rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-violet/40"
                />
                <button
                  type="button"
                  onClick={handleSchedule}
                  disabled={!date}
                  className="px-3 py-1.5 bg-violet text-white rounded-md text-sm disabled:opacity-50"
                >
                  Schedule
                </button>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {status !== 'archived' && (
          <button
            type="button"
            onClick={() => onAction({ type: 'archive' })}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 border border-border-color rounded-lg px-4 py-2 text-sm text-grey hover:border-destructive hover:text-destructive transition-colors disabled:opacity-50"
          >
            <Archive className="w-4 h-4" />
            Archive
          </button>
        )}
      </div>
    </div>
  );
};
