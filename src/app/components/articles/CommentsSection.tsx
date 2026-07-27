import React from 'react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { MessageCircle } from 'lucide-react';
import { CommentForm } from './CommentForm';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { isSupabaseConfigured } from '@/app/lib/supabase';
import { listComments } from '@/app/lib/articles-api';
import type { Comment } from '@/app/lib/articles-types';

interface CommentsSectionProps {
  articleId: string;
}

export const CommentsSection: React.FC<CommentsSectionProps> = ({ articleId }) => {
  const [comments, setComments] = React.useState<Comment[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    listComments(articleId)
      .then((data) => {
        if (!cancelled) setComments(data);
      })
      .catch(() => {
        if (!cancelled) setComments([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [articleId]);

  const handlePosted = React.useCallback((comment: Comment) => {
    setComments((prev) => [...prev, comment]);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="bg-card border border-border-color rounded-lg p-6 sm:p-8 shadow-sm"
    >
      <h2 className="text-2xl text-violet mb-6 flex items-center gap-2">
        <MessageCircle className="w-6 h-6" />
        Comments{comments.length > 0 ? ` (${comments.length})` : ''}
      </h2>

      {loading ? (
        <div className="space-y-3 mb-8">
          <div className="h-16 bg-muted rounded-lg animate-pulse" />
          <div className="h-16 bg-muted rounded-lg animate-pulse" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-text-secondary mb-8">No comments yet. Be the first to share your thoughts!</p>
      ) : (
        <ul className="space-y-5 mb-8">
          {comments.map((comment) => (
            <li key={comment.id} className="flex gap-3">
              <Avatar className="size-9 shrink-0">
                <AvatarFallback className="bg-violet/10 text-violet text-xs">
                  {comment.author_name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-violet">{comment.author_name}</span>
                  <span className="text-xs text-grey">
                    {format(new Date(comment.created_at), 'MMM d, yyyy HH:mm')}
                  </span>
                </div>
                <p className="text-text-secondary leading-relaxed whitespace-pre-wrap break-words">
                  {comment.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-border-color pt-6 relative">
        <CommentForm articleId={articleId} onPosted={handlePosted} />
      </div>
    </motion.div>
  );
};
