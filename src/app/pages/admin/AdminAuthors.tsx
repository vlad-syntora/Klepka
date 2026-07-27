import React from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Input, TextArea } from '../../components/Input';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../components/ui/dialog';
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
import { MediaUpload } from '../../components/admin/MediaUpload';
import {
  adminCreateAuthor,
  adminDeleteAuthor,
  adminUpdateAuthor,
} from '@/app/lib/admin-api';
import { listAuthors } from '@/app/lib/articles-api';
import type { Author } from '@/app/lib/articles-types';

interface AuthorFormProps {
  author: Author | null;
  onSaved: (author: Author) => void;
  onClose: () => void;
}

const AuthorForm: React.FC<AuthorFormProps> = ({ author, onSaved, onClose }) => {
  const [fullName, setFullName] = React.useState(author?.full_name ?? '');
  const [title, setTitle] = React.useState(author?.title ?? '');
  const [bio, setBio] = React.useState(author?.bio ?? '');
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(author?.avatar_url ?? null);
  const [saving, setSaving] = React.useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = fullName.trim();
    if (!name) return;

    const input = {
      full_name: name,
      avatar_url: avatarUrl,
      title: title.trim() || null,
      bio: bio.trim() || null,
    };

    setSaving(true);
    try {
      const saved = author
        ? await adminUpdateAuthor(author.id, input)
        : await adminCreateAuthor(input);
      onSaved(saved);
      onClose();
      toast.success(author ? 'Author updated' : 'Author created');
    } catch (error) {
      toast.error('Failed to save author', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Full name"
        value={fullName}
        onChange={(event) => setFullName(event.target.value)}
        maxLength={120}
        required
      />
      <Input
        label="Position"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        maxLength={120}
        placeholder="e.g. Salesforce Architect"
      />
      <TextArea
        label="Short bio"
        value={bio}
        onChange={(event) => setBio(event.target.value)}
        rows={3}
        maxLength={500}
      />
      <MediaUpload label="Avatar" value={avatarUrl} folder="avatars" onChange={setAvatarUrl} />
      <DialogFooter>
        <button
          type="submit"
          disabled={saving}
          className="bg-violet text-white px-4 py-2 rounded-lg text-sm hover:bg-violet/90 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </DialogFooter>
    </form>
  );
};

export const AdminAuthors: React.FC = () => {
  const [authors, setAuthors] = React.useState<Author[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [dialogAuthor, setDialogAuthor] = React.useState<Author | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  React.useEffect(() => {
    listAuthors()
      .then(setAuthors)
      .catch(() => toast.error('Failed to load authors'))
      .finally(() => setLoading(false));
  }, []);

  const handleSaved = (saved: Author) => {
    setAuthors((prev) => {
      const exists = prev.some((author) => author.id === saved.id);
      return exists
        ? prev.map((author) => (author.id === saved.id ? saved : author))
        : [...prev, saved].sort((a, b) => a.full_name.localeCompare(b.full_name));
    });
  };

  const handleDelete = async (id: string) => {
    try {
      await adminDeleteAuthor(id);
      setAuthors((prev) => prev.filter((author) => author.id !== id));
      toast.success('Author deleted');
    } catch (error) {
      toast.error('Failed to delete author', {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl text-violet">Authors</h1>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setDialogAuthor(null);
          }}
        >
          <DialogTrigger asChild>
            <button className="inline-flex items-center gap-2 bg-violet text-white px-4 py-2 rounded-lg hover:bg-violet/90 transition-colors text-sm">
              <Plus className="w-4 h-4" />
              New Author
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{dialogAuthor ? 'Edit Author' : 'New Author'}</DialogTitle>
            </DialogHeader>
            <AuthorForm
              key={dialogAuthor?.id ?? 'new'}
              author={dialogAuthor}
              onSaved={handleSaved}
              onClose={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card border border-border-color rounded-lg shadow-sm divide-y divide-border-color">
        {loading ? (
          <p className="text-center py-10 text-text-secondary">Loading...</p>
        ) : authors.length === 0 ? (
          <p className="text-center py-10 text-text-secondary">No authors yet. Create the first one.</p>
        ) : (
          authors.map((author) => (
            <div key={author.id} className="flex items-center gap-4 px-4 py-3">
              <Avatar className="size-10">
                <AvatarImage src={author.avatar_url ?? undefined} alt={author.full_name} />
                <AvatarFallback className="bg-violet/10 text-violet text-sm">
                  {author.full_name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p>{author.full_name}</p>
                {author.title && <p className="text-sm text-grey truncate">{author.title}</p>}
              </div>

              <button
                onClick={() => {
                  setDialogAuthor(author);
                  setDialogOpen(true);
                }}
                className="p-2 rounded-md hover:bg-violet/10 text-violet"
                aria-label={`Edit ${author.full_name}`}
              >
                <Pencil className="w-4 h-4" />
              </button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    className="p-2 rounded-md hover:bg-destructive/10 text-destructive"
                    aria-label={`Delete ${author.full_name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete author?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Articles by {author.full_name} will remain but lose their author.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(author.id)}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
