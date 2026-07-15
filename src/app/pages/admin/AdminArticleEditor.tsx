import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { Input, TextArea } from '../../components/Input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { MediaUpload } from '../../components/admin/MediaUpload';
import { TagInput } from '../../components/admin/TagInput';
import { RichTextEditor } from '../../components/admin/RichTextEditor';
import { PublishControls, type PublishAction } from '../../components/admin/PublishControls';
import {
  adminCreateArticle,
  adminGetArticle,
  adminUpdateArticle,
  triggerDeploy,
  type ArticleUpsertInput,
} from '@/app/lib/admin-api';
import { listAuthors } from '@/app/lib/articles-api';
import { slugify } from '@/app/lib/tiptap-toc';
import type { ArticleBody, ArticleStatus, Author } from '@/app/lib/articles-types';

const EMPTY_BODY: ArticleBody = { type: 'doc', content: [] };

const MetadataSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Slug must be lowercase letters, numbers and dashes'),
  excerpt: z.string().trim().min(1, 'Excerpt is required').max(500),
});

const NO_AUTHOR = 'none';

export const AdminArticleEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id;

  const [loading, setLoading] = React.useState(!isNew);
  const [saving, setSaving] = React.useState(false);
  const [authors, setAuthors] = React.useState<Author[]>([]);

  const [title, setTitle] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [excerpt, setExcerpt] = React.useState('');
  const [authorId, setAuthorId] = React.useState<string>(NO_AUTHOR);
  const [tags, setTags] = React.useState<string[]>([]);
  const [hiddenKeywords, setHiddenKeywords] = React.useState<string[]>([]);
  const [coverUrl, setCoverUrl] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<ArticleStatus>('draft');
  const [publishAt, setPublishAt] = React.useState<string | null>(null);
  const [publishedAt, setPublishedAt] = React.useState<string | null>(null);
  const [body, setBody] = React.useState<ArticleBody>(EMPTY_BODY);
  const [initialBody, setInitialBody] = React.useState<ArticleBody | null>(isNew ? EMPTY_BODY : null);

  React.useEffect(() => {
    listAuthors()
      .then(setAuthors)
      .catch(() => toast.error('Failed to load authors'));
  }, []);

  React.useEffect(() => {
    if (!id) return;
    setLoading(true);
    adminGetArticle(id)
      .then((article) => {
        setTitle(article.title);
        setSlug(article.slug);
        setSlugTouched(true);
        setExcerpt(article.excerpt);
        setAuthorId(article.author_id ?? NO_AUTHOR);
        setTags(article.tags);
        setHiddenKeywords(article.hidden_keywords);
        setCoverUrl(article.cover_url);
        setStatus(article.status);
        setPublishAt(article.publish_at);
        setPublishedAt(article.published_at);
        setBody(article.body);
        setInitialBody(article.body);
      })
      .catch((error: unknown) => {
        toast.error('Failed to load article', {
          description: error instanceof Error ? error.message : undefined,
        });
        navigate('/admin/articles');
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!slugTouched) setSlug(slugify(value));
  };

  const handleAction = async (action: PublishAction) => {
    const metadata = MetadataSchema.safeParse({ title, slug, excerpt });
    if (!metadata.success) {
      toast.error(metadata.error.issues[0].message);
      return;
    }

    const next: ArticleUpsertInput = {
      title: metadata.data.title,
      slug: metadata.data.slug,
      excerpt: metadata.data.excerpt,
      body,
      cover_url: coverUrl,
      author_id: authorId === NO_AUTHOR ? null : authorId,
      tags,
      hidden_keywords: hiddenKeywords,
      status,
      publish_at: publishAt,
      published_at: publishedAt,
    };

    if (action.type === 'publish') {
      next.status = 'published';
      next.published_at = publishedAt ?? new Date().toISOString();
      next.publish_at = null;
    } else if (action.type === 'schedule') {
      next.status = 'scheduled';
      next.publish_at = action.at;
    } else if (action.type === 'archive') {
      next.status = 'archived';
    }

    const wasPubliclyVisible = status === 'published';
    const isPubliclyVisible = next.status === 'published';

    setSaving(true);
    try {
      const saved = isNew ? await adminCreateArticle(next) : await adminUpdateArticle(id, next);

      setStatus(saved.status);
      setPublishAt(saved.publish_at);
      setPublishedAt(saved.published_at);
      toast.success(
        action.type === 'publish'
          ? 'Article published'
          : action.type === 'schedule'
            ? 'Article scheduled'
            : action.type === 'archive'
              ? 'Article archived'
              : 'Article saved',
      );

      // Rebuild static pages whenever the public site is affected.
      if (wasPubliclyVisible || isPubliclyVisible) {
        triggerDeploy().catch(() => {
          toast.warning('Saved, but failed to trigger site rebuild');
        });
      }

      if (isNew) {
        navigate(`/admin/articles/${saved.id}`, { replace: true });
      }
    } catch (error) {
      toast.error('Failed to save article', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading || initialBody === null) {
    return <div className="bg-card border border-border-color rounded-lg h-96 animate-pulse" />;
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link
          to="/admin/articles"
          className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-violet transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Articles
        </Link>
        <h1 className="text-2xl text-violet">{isNew ? 'New Article' : 'Edit Article'}</h1>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6 items-start">
        <div className="space-y-4 min-w-0">
          <div className="bg-card border border-border-color rounded-lg shadow-sm p-4 sm:p-6 space-y-4">
            <Input
              label="Title"
              value={title}
              onChange={(event) => handleTitleChange(event.target.value)}
              maxLength={200}
              required
            />
            <Input
              label="Slug"
              value={slug}
              onChange={(event) => {
                setSlug(event.target.value);
                setSlugTouched(true);
              }}
              required
            />
            <TextArea
              label="Excerpt (shown in the articles list)"
              value={excerpt}
              onChange={(event) => setExcerpt(event.target.value)}
              rows={3}
              maxLength={500}
              required
            />
          </div>

          <RichTextEditor initialContent={initialBody} onChange={setBody} />
        </div>

        <div className="space-y-4">
          <PublishControls status={status} publishAt={publishAt} saving={saving} onAction={handleAction} />

          <div className="bg-card border border-border-color rounded-lg shadow-sm p-4 space-y-4">
            <div>
              <span className="block text-sm mb-2 text-violet">Author</span>
              <Select value={authorId} onValueChange={setAuthorId}>
                <SelectTrigger className="w-full bg-card">
                  <SelectValue placeholder="Select author" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_AUTHOR}>No author</SelectItem>
                  {authors.map((author) => (
                    <SelectItem key={author.id} value={author.id}>
                      {author.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <MediaUpload label="Preview image" value={coverUrl} folder="covers" onChange={setCoverUrl} />

            <TagInput
              label="Keywords (public tags)"
              value={tags}
              onChange={setTags}
              placeholder="Add keyword and press Enter"
            />
            <TagInput
              label="Hidden keywords (search only)"
              value={hiddenKeywords}
              onChange={setHiddenKeywords}
              placeholder="Not visible to visitors"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
