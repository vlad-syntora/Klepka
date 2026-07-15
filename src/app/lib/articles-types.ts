import { z } from 'zod';
import type { JSONContent } from '@tiptap/core';

export const ArticleStatusSchema = z.enum(['draft', 'scheduled', 'published', 'archived']);
export type ArticleStatus = z.infer<typeof ArticleStatusSchema>;

export const ArticleBodySchema = z.custom<JSONContent>(
  (value) => typeof value === 'object' && value !== null && !Array.isArray(value),
);
export type ArticleBody = JSONContent;

export const AuthorSchema = z.object({
  id: z.uuid(),
  full_name: z.string(),
  avatar_url: z.string().nullable(),
  title: z.string().nullable(),
  bio: z.string().nullable(),
});
export type Author = z.infer<typeof AuthorSchema>;

export const ArticleListItemSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  slug: z.string(),
  excerpt: z.string(),
  cover_url: z.string().nullable(),
  tags: z.array(z.string()),
  published_at: z.string().nullable(),
  author: AuthorSchema.nullable().optional(),
});
export type ArticleListItem = z.infer<typeof ArticleListItemSchema>;

export const ArticleSchema = ArticleListItemSchema.extend({
  body: ArticleBodySchema,
});
export type Article = z.infer<typeof ArticleSchema>;

export const AdminArticleSchema = ArticleSchema.extend({
  author_id: z.uuid().nullable(),
  hidden_keywords: z.array(z.string()),
  status: ArticleStatusSchema,
  publish_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type AdminArticle = z.infer<typeof AdminArticleSchema>;

export const AdminArticleListItemSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  slug: z.string(),
  status: ArticleStatusSchema,
  publish_at: z.string().nullable(),
  published_at: z.string().nullable(),
  updated_at: z.string(),
  author: AuthorSchema.nullable().optional(),
});
export type AdminArticleListItem = z.infer<typeof AdminArticleListItemSchema>;

export const SearchResultSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  slug: z.string(),
  excerpt: z.string(),
  cover_url: z.string().nullable(),
  author_id: z.uuid().nullable(),
  tags: z.array(z.string()),
  published_at: z.string().nullable(),
});
export type SearchResult = z.infer<typeof SearchResultSchema>;

export const CommentSchema = z.object({
  id: z.uuid(),
  article_id: z.uuid(),
  author_name: z.string(),
  body: z.string(),
  created_at: z.string(),
});
export type Comment = z.infer<typeof CommentSchema>;

export const AdminCommentSchema = CommentSchema.extend({
  author_email: z.string(),
  is_hidden: z.boolean(),
  article: z.object({ title: z.string(), slug: z.string() }).nullable().optional(),
});
export type AdminComment = z.infer<typeof AdminCommentSchema>;

export const CommentInputSchema = z.object({
  articleId: z.uuid(),
  name: z.string().trim().min(1).max(80),
  email: z.email().max(255),
  body: z.string().trim().min(1).max(5000),
  turnstileToken: z.string().min(1),
  // Honeypot field: real users leave it empty.
  website: z.string().optional().default(''),
});
export type CommentInput = z.input<typeof CommentInputSchema>;
