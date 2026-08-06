import React from 'react';
import { Star, X } from 'lucide-react';
import { loadPublicReviews, loadStaffRatings } from '@/app/lib/portal-api';
import { formatDate, prettyName } from '@/app/lib/portal-format';
import type { PublicReview, StaffRating } from '@/app/lib/portal-types';
import { EmptyState, PortalButton, Stars } from '@/app/components/portal/PortalUi';

interface StaffFeedback {
  ratings: Map<string, StaffRating>;
  reviews: Map<string, PublicReview[]>;
  loading: boolean;
}

/**
 * Fetches per-staff average ratings and approved public reviews for a set of user ids in one go.
 * Callers pass every id they render; the two lookups are shared across all their rows.
 */
export function useStaffFeedback(userIds: string[]): StaffFeedback {
  const key = React.useMemo(() => Array.from(new Set(userIds)).sort().join(','), [userIds]);
  const [state, setState] = React.useState<StaffFeedback>({ ratings: new Map(), reviews: new Map(), loading: false });

  React.useEffect(() => {
    const ids = key ? key.split(',') : [];
    if (ids.length === 0) {
      setState({ ratings: new Map(), reviews: new Map(), loading: false });
      return;
    }
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true }));
    Promise.all([loadStaffRatings(ids), loadPublicReviews(ids)])
      .then(([ratings, reviews]) => {
        if (!cancelled) setState({ ratings, reviews, loading: false });
      })
      .catch(() => {
        // Ratings are supplementary — never block the widget if they fail to load.
        if (!cancelled) setState({ ratings: new Map(), reviews: new Map(), loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return state;
}

/**
 * Compact average-rating badge shown next to a staff member. When there are approved public
 * reviews, it becomes a button that opens the reviews list. Renders nothing without a rating.
 */
export const RatingSummary: React.FC<{
  name: string;
  rating?: StaffRating;
  reviews?: PublicReview[];
}> = ({ name, rating, reviews }) => {
  const [open, setOpen] = React.useState(false);
  const list = reviews ?? [];

  if (!rating || rating.rating_count === 0) return null;

  const badge = (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-grey">
      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
      <span className="text-foreground">{rating.avg_rating.toFixed(1)}</span>
      <span className="text-grey/80">
        ({rating.rating_count} rating{rating.rating_count === 1 ? '' : 's'})
      </span>
    </span>
  );

  if (list.length === 0) return badge;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md text-xs font-medium text-grey transition-colors hover:text-violet"
        title={`See ${list.length} public review${list.length === 1 ? '' : 's'}`}
      >
        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
        <span className="text-foreground">{rating.avg_rating.toFixed(1)}</span>
        <span className="underline decoration-dotted underline-offset-2">
          {list.length} review{list.length === 1 ? '' : 's'}
        </span>
      </button>
      {open && <ReviewsDialog name={name} reviews={list} onClose={() => setOpen(false)} />}
    </>
  );
};

const ReviewsDialog: React.FC<{ name: string; reviews: PublicReview[]; onClose: () => void }> = ({
  name,
  reviews,
  onClose,
}) => {
  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Reviews for ${prettyName(name)}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="my-auto w-full max-w-lg overflow-hidden rounded-xl bg-card shadow-xl">
        <header className="flex items-center justify-between gap-3 border-b border-border-color px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-violet">Reviews · {prettyName(name)}</h2>
            <p className="mt-0.5 text-xs text-grey">Shared publicly by Klepka clients.</p>
          </div>
          <PortalButton variant="ghost" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </PortalButton>
        </header>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          {reviews.length === 0 ? (
            <EmptyState title="No public reviews yet" />
          ) : (
            <ul className="divide-y divide-border-color">
              {reviews.map((review) => (
                <li key={review.id} className="py-3">
                  <div className="flex items-center justify-between gap-2">
                    <Stars value={review.rating} size={14} />
                    <span className="text-xs text-grey">A client · {formatDate(review.created_at)}</span>
                  </div>
                  {review.comment && <p className="mt-1.5 text-sm">{review.comment}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
