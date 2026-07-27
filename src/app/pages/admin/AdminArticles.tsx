import React from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Pencil, Plus, Trash2 } from 'lucide-react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
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
import { adminDeleteArticle, adminListArticles } from '@/app/lib/admin-api';
import type { AdminArticleListItem, ArticleStatus } from '@/app/lib/articles-types';

const statusBadgeClass: Record<ArticleStatus, string> = {
  draft: 'bg-grey/15 text-grey border-transparent',
  scheduled: 'bg-primary/10 text-primary border-transparent',
  published: 'bg-green-100 text-green-700 border-transparent',
  archived: 'bg-accent-yellow text-violet border-transparent',
};

export const AdminArticles: React.FC = () => {
  const [articles, setArticles] = React.useState<AdminArticleListItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState<'all' | ArticleStatus>('all');
  const [search, setSearch] = React.useState('');

  const load = React.useCallback(() => {
    setLoading(true);
    adminListArticles()
      .then(setArticles)
      .catch((error: unknown) => {
        toast.error('Failed to load articles', {
          description: error instanceof Error ? error.message : undefined,
        });
      })
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(load, [load]);

  const handleDelete = async (id: string) => {
    try {
      await adminDeleteArticle(id);
      setArticles((prev) => prev.filter((article) => article.id !== id));
      toast.success('Article deleted');
    } catch (error) {
      toast.error('Failed to delete article', {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const visible = articles.filter(
    (article) =>
      (statusFilter === 'all' || article.status === statusFilter) &&
      article.title.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <h1 className="text-2xl text-violet mr-auto">Articles</h1>

        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by title..."
          aria-label="Search articles by title"
          className="px-3 py-2 bg-card border border-border-color rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet/40"
        />

        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | ArticleStatus)}>
          <SelectTrigger className="w-36 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>

        <Link
          to="/admin/articles/new"
          className="inline-flex items-center gap-2 bg-violet text-white px-4 py-2 rounded-lg hover:bg-violet/90 transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          New Article
        </Link>
      </div>

      <div className="bg-card border border-border-color rounded-lg shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Publish date</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-text-secondary">
                  Loading...
                </TableCell>
              </TableRow>
            ) : visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-text-secondary">
                  No articles found.
                </TableCell>
              </TableRow>
            ) : (
              visible.map((article) => (
                <TableRow key={article.id}>
                  <TableCell className="max-w-64">
                    <Link to={`/admin/articles/${article.id}`} className="text-violet hover:underline">
                      {article.title}
                    </Link>
                  </TableCell>
                  <TableCell>{article.author?.full_name ?? '—'}</TableCell>
                  <TableCell>
                    <Badge className={statusBadgeClass[article.status]}>{article.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {article.status === 'scheduled' && article.publish_at
                      ? format(new Date(article.publish_at), 'MMM d, yyyy HH:mm')
                      : article.published_at
                        ? format(new Date(article.published_at), 'MMM d, yyyy')
                        : '—'}
                  </TableCell>
                  <TableCell>{format(new Date(article.updated_at), 'MMM d, yyyy HH:mm')}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Link
                        to={`/admin/articles/${article.id}`}
                        className="p-2 rounded-md hover:bg-violet/10 text-violet"
                        aria-label={`Edit ${article.title}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </Link>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            className="p-2 rounded-md hover:bg-destructive/10 text-destructive"
                            aria-label={`Delete ${article.title}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete article?</AlertDialogTitle>
                            <AlertDialogDescription>
                              “{article.title}” and all its comments will be permanently deleted.
                              Consider archiving instead if you may need it later.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(article.id)}>
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
