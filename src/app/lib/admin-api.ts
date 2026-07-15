import { z } from 'zod';
import { getSupabase } from '@/app/lib/supabase';
import {
  AdminArticleListItemSchema,
  AdminArticleSchema,
  AdminCommentSchema,
  AuthorSchema,
  type AdminArticle,
  type AdminArticleListItem,
  type AdminComment,
  type ArticleBody,
  type ArticleStatus,
  type Author,
} from '@/app/lib/articles-types';

export interface ArticleUpsertInput {
  title: string;
  slug: string;
  excerpt: string;
  body: ArticleBody;
  cover_url: string | null;
  author_id: string | null;
  tags: string[];
  hidden_keywords: string[];
  status: ArticleStatus;
  publish_at: string | null;
  published_at: string | null;
}

const ADMIN_ARTICLE_COLUMNS =
  'id, title, slug, excerpt, body, cover_url, author_id, tags, hidden_keywords, status, publish_at, published_at, created_at, updated_at, author:authors(id, full_name, avatar_url)';

export async function adminListArticles(): Promise<AdminArticleListItem[]> {
  const { data, error } = await getSupabase()
    .from('articles')
    .select('id, title, slug, status, publish_at, published_at, updated_at, author:authors(id, full_name, avatar_url)')
    .order('updated_at', { ascending: false });

  if (error) throw new Error(error.message);
  return z.array(AdminArticleListItemSchema).parse(data);
}

export async function adminGetArticle(id: string): Promise<AdminArticle> {
  const { data, error } = await getSupabase()
    .from('articles')
    .select(ADMIN_ARTICLE_COLUMNS)
    .eq('id', id)
    .single();

  if (error) throw new Error(error.message);
  return AdminArticleSchema.parse(data);
}

export async function adminCreateArticle(input: ArticleUpsertInput): Promise<AdminArticle> {
  const { data, error } = await getSupabase()
    .from('articles')
    .insert(input)
    .select(ADMIN_ARTICLE_COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return AdminArticleSchema.parse(data);
}

export async function adminUpdateArticle(
  id: string,
  patch: Partial<ArticleUpsertInput>,
): Promise<AdminArticle> {
  const { data, error } = await getSupabase()
    .from('articles')
    .update(patch)
    .eq('id', id)
    .select(ADMIN_ARTICLE_COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return AdminArticleSchema.parse(data);
}

export async function adminDeleteArticle(id: string): Promise<void> {
  const { error } = await getSupabase().from('articles').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function adminCreateAuthor(input: {
  full_name: string;
  avatar_url: string | null;
}): Promise<Author> {
  const { data, error } = await getSupabase()
    .from('authors')
    .insert(input)
    .select('id, full_name, avatar_url')
    .single();

  if (error) throw new Error(error.message);
  return AuthorSchema.parse(data);
}

export async function adminUpdateAuthor(
  id: string,
  patch: { full_name?: string; avatar_url?: string | null },
): Promise<Author> {
  const { data, error } = await getSupabase()
    .from('authors')
    .update(patch)
    .eq('id', id)
    .select('id, full_name, avatar_url')
    .single();

  if (error) throw new Error(error.message);
  return AuthorSchema.parse(data);
}

export async function adminDeleteAuthor(id: string): Promise<void> {
  const { error } = await getSupabase().from('authors').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function adminListComments(): Promise<AdminComment[]> {
  const { data, error } = await getSupabase()
    .from('comments')
    .select('id, article_id, author_name, author_email, body, is_hidden, created_at, article:articles(title, slug)')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return z.array(AdminCommentSchema).parse(data);
}

export async function adminSetCommentHidden(id: string, isHidden: boolean): Promise<void> {
  const { error } = await getSupabase().from('comments').update({ is_hidden: isHidden }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function adminDeleteComment(id: string): Promise<void> {
  const { error } = await getSupabase().from('comments').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function uploadMedia(file: File, folder: 'covers' | 'inline' | 'avatars'): Promise<string> {
  const supabase = getSupabase();
  const extension = file.name.split('.').pop()?.toLowerCase() || 'bin';
  const path = `${folder}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage.from('article-media').upload(path, file, {
    cacheControl: '31536000',
    contentType: file.type || undefined,
  });
  if (error) throw new Error(error.message);

  return supabase.storage.from('article-media').getPublicUrl(path).data.publicUrl;
}

export async function triggerDeploy(): Promise<void> {
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const response = await fetch('/api/deploy', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error('Failed to trigger site rebuild');
  }
}
