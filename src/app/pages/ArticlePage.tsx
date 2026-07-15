import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import { ArticleBody } from '../components/articles/ArticleBody';
import { ArticleToc } from '../components/articles/ArticleToc';
import { CommentsSection } from '../components/articles/CommentsSection';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { isSupabaseConfigured } from '@/app/lib/supabase';
import { getArticleBySlug } from '@/app/lib/articles-api';
import { extractToc, injectHeadingIds } from '@/app/lib/tiptap-toc';
import type { Article } from '@/app/lib/articles-types';

export const ArticlePage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = React.useState<Article | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!slug || !isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    getArticleBySlug(slug)
      .then((data) => {
        if (!cancelled) setArticle(data);
      })
      .catch(() => {
        if (!cancelled) setArticle(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const processedBody = React.useMemo(
    () => (article ? injectHeadingIds(article.body) : null),
    [article],
  );
  const toc = React.useMemo(() => (processedBody ? extractToc(processedBody) : []), [processedBody]);

  if (loading) {
    return (
      <div className="pt-14 lg:pt-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto py-8">
          <div className="bg-card border border-border-color rounded-lg h-96 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!article || !processedBody) {
    return (
      <div className="pt-14 lg:pt-32 px-4 sm:px-6 lg:px-8">
        <SEOHead title="Article Not Found" description="The article you are looking for does not exist." noindex />
        <div className="max-w-3xl mx-auto py-16 text-center">
          <h1 className="text-3xl text-violet mb-4">Article not found</h1>
          <p className="text-text-secondary mb-8">
            The article you are looking for does not exist or is no longer available.
          </p>
          <Link to="/articles" className="inline-flex items-center gap-2 text-violet hover:underline">
            <ArrowLeft className="w-4 h-4" />
            Back to all articles
          </Link>
        </div>
      </div>
    );
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.excerpt,
    ...(article.cover_url ? { image: article.cover_url } : {}),
    ...(article.published_at ? { datePublished: article.published_at } : {}),
    ...(article.author
      ? {
          author: {
            '@type': 'Person',
            name: article.author.full_name,
            ...(article.author.title ? { jobTitle: article.author.title } : {}),
            ...(article.author.bio ? { description: article.author.bio } : {}),
          },
        }
      : {}),
    publisher: {
      '@type': 'Organization',
      name: 'Klepka',
      url: 'https://klepka.solutions',
    },
    mainEntityOfPage: `https://klepka.solutions/articles/${article.slug}`,
  };

  return (
    <div className="pt-14 lg:pt-32">
      <SEOHead
        title={article.title}
        description={article.excerpt}
        canonicalPath={`/articles/${article.slug}`}
        ogType="article"
        ogImage={article.cover_url ?? undefined}
        jsonLd={jsonLd}
      />

      <section className="pb-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <Link
            to="/articles"
            className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-violet transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            All articles
          </Link>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl sm:text-4xl text-violet mb-4">{article.title}</h1>

            <div className="flex flex-wrap items-center gap-4 mb-6">
              {article.author && (
                <div className="flex items-center gap-2">
                  <Avatar className="size-9">
                    <AvatarImage src={article.author.avatar_url ?? undefined} alt={article.author.full_name} />
                    <AvatarFallback className="bg-violet/10 text-violet text-xs">
                      {article.author.full_name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <span className="text-text-secondary block leading-tight">{article.author.full_name}</span>
                    {article.author.title && (
                      <span className="text-xs text-grey block leading-tight">{article.author.title}</span>
                    )}
                  </div>
                </div>
              )}
              {article.published_at && (
                <span className="text-grey">{format(new Date(article.published_at), 'MMMM d, yyyy')}</span>
              )}
              {article.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-violet border-violet/30">
                  {tag}
                </Badge>
              ))}
            </div>

            {article.cover_url && (
              <img
                src={article.cover_url}
                alt={article.title}
                className="w-full max-h-[420px] object-cover rounded-lg border border-border-color shadow-sm mb-2"
              />
            )}
          </motion.div>
        </div>
      </section>

      <section className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 lg:gap-8 items-start">
          <ArticleToc items={toc} />

          <motion.article
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-card border border-border-color rounded-lg p-6 sm:p-8 shadow-sm min-w-0"
          >
            <ArticleBody body={processedBody} />

            {article.author && article.author.bio && (
              <div className="mt-8 pt-6 border-t border-border-color flex gap-4">
                <Avatar className="size-14 shrink-0">
                  <AvatarImage src={article.author.avatar_url ?? undefined} alt={article.author.full_name} />
                  <AvatarFallback className="bg-violet/10 text-violet">
                    {article.author.full_name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-violet">{article.author.full_name}</p>
                  {article.author.title && <p className="text-sm text-grey mb-1">{article.author.title}</p>}
                  <p className="text-sm text-text-secondary leading-relaxed">{article.author.bio}</p>
                </div>
              </div>
            )}
          </motion.article>
        </div>
      </section>

      <section className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto lg:grid lg:grid-cols-[260px_1fr] lg:gap-8">
          <div className="hidden lg:block" />
          <CommentsSection articleId={article.id} />
        </div>
      </section>
    </div>
  );
};
