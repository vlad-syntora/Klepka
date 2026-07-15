import { z } from 'zod';
import { getSupabase } from '@/app/lib/supabase';
import {
  ArticleListItemSchema,
  ArticleSchema,
  AuthorSchema,
  CommentSchema,
  SearchResultSchema,
  type Article,
  type ArticleListItem,
  type Author,
  type Comment,
  type CommentInput,
  type SearchResult,
} from '@/app/lib/articles-types';

const LIST_COLUMNS =
  'id, title, slug, excerpt, cover_url, tags, published_at, author:authors(id, full_name, avatar_url, title, bio)';

export const ARTICLES_PAGE_SIZE = 12;

export async function listPublishedArticles(
  page: number,
): Promise<{ items: ArticleListItem[]; total: number }> {
  const from = (page - 1) * ARTICLES_PAGE_SIZE;
  const { data, error, count } = await getSupabase()
    .from('articles')
    .select(LIST_COLUMNS, { count: 'exact' })
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .range(from, from + ARTICLES_PAGE_SIZE - 1);

  if (error) throw new Error(error.message);
  return { items: z.array(ArticleListItemSchema).parse(data), total: count ?? 0 };
}

export async function searchArticles(query: string): Promise<SearchResult[]> {
  const { data, error } = await getSupabase().rpc('search_articles', { q: query });
  if (error) throw new Error(error.message);
  return z.array(SearchResultSchema).parse(data);
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const { data, error } = await getSupabase()
    .from('articles')
    .select(`${LIST_COLUMNS}, body`)
    .eq('status', 'published')
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? ArticleSchema.parse(data) : null;
}

export async function listAuthors(): Promise<Author[]> {
  const { data, error } = await getSupabase()
    .from('authors')
    .select('id, full_name, avatar_url, title, bio')
    .order('full_name');

  if (error) throw new Error(error.message);
  return z.array(AuthorSchema).parse(data);
}

export async function listComments(articleId: string): Promise<Comment[]> {
  const { data, error } = await getSupabase()
    .from('comments')
    .select('id, article_id, author_name, body, created_at')
    .eq('article_id', articleId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return z.array(CommentSchema).parse(data);
}

export async function postComment(input: CommentInput): Promise<Comment> {
  const response = await fetch('/api/comments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload.error === 'string' ? payload.error : 'Failed to post comment';
    throw new Error(message);
  }
  return CommentSchema.parse(payload);
}
