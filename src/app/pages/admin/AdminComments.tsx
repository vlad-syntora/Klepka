import React from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Eye, EyeOff, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../../components/ui/alert-dialog';
import {
  adminDeleteComment,
  adminListComments,
  adminSetCommentHidden,
} from '@/app/lib/admin-api';
import type { AdminComment } from '@/app/lib/articles-types';

export const AdminComments: React.FC = () => {
  const [comments, setComments] = React.useState<AdminComment[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    adminListComments()
      .then(setComments)
      .catch((error: unknown) => {
        toast.error('Failed to load comments', {
          description: error instanceof Error ? error.message : undefined,
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const handleToggleHidden = async (comment: AdminComment) => {
    try {
      await adminSetCommentHidden(comment.id, !comment.is_hidden);
      setComments((prev) =>
        prev.map((item) =>
          item.id === comment.id ? { ...item, is_hidden: !comment.is_hidden } : item,
        ),
      );
      toast.success(comment.is_hidden ? 'Comment is visible again' : 'Comment hidden');
    } catch (error) {
      toast.error('Failed to update comment', {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await adminDeleteComment(id);
      setComments((prev) => prev.filter((comment) => comment.id !== id));
      toast.success('Comment deleted');
    } catch (error) {
      toast.error('Failed to delete comment', {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  return (
    <div>
      <h1 className="text-2xl text-violet mb-6">Comments</h1>

      <div className="bg-card border border-border-color rounded-lg shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Article</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="w-96">Comment</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-text-secondary">
                  Loading...
                </TableCell>
              </TableRow>
            ) : comments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-text-secondary">
                  No comments yet.
                </TableCell>
              </TableRow>
            ) : (
              comments.map((comment) => (
                <TableRow key={comment.id} className={comment.is_hidden ? 'opacity-50' : ''}>
                  <TableCell>
                    {comment.article ? (
                      <Link
                        to={`/articles/${comment.article.slug}`}
                        target="_blank"
                        className="text-violet hover:underline"
                      >
                        {comment.article.title}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>{comment.author_name}</TableCell>
                  <TableCell className="text-text-secondary">{comment.author_email}</TableCell>
                  <TableCell className="max-w-96">
                    <p className="truncate" title={comment.body}>
                      {comment.body}
                    </p>
                    {comment.is_hidden && (
                      <Badge variant="outline" className="mt-1 text-grey">
                        hidden
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{format(new Date(comment.created_at), 'MMM d, yyyy HH:mm')}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleHidden(comment)}
                        className="p-2 rounded-md hover:bg-violet/10 text-violet"
                        aria-label={comment.is_hidden ? 'Show comment' : 'Hide comment'}
                        title={comment.is_hidden ? 'Show comment' : 'Hide comment'}
                      >
                        {comment.is_hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            className="p-2 rounded-md hover:bg-destructive/10 text-destructive"
                            aria-label="Delete comment"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete comment?</AlertDialogTitle>
                            <AlertDialogDescription>
                              The comment by {comment.author_name} will be permanently deleted.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(comment.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
