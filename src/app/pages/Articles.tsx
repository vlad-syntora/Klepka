import React from 'react';
import { motion } from 'motion/react';
import { Search } from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import { ArticleCard } from '../components/articles/ArticleCard';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '../components/ui/pagination';
import { isSupabaseConfigured } from '@/app/lib/supabase';
import {
  ARTICLES_PAGE_SIZE,
  listAuthors,
  listPublishedArticles,
  searchArticles,
} from '@/app/lib/articles-api';
import type { ArticleListItem, Author } from '@/app/lib/articles-types';

const SEARCH_DEBOUNCE_MS = 300;

export const Articles: React.FC = () => {
  const [query, setQuery] = React.useState('');
  const [debouncedQuery, setDebouncedQuery] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [items, setItems] = React.useState<ArticleListItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const authorsRef = React.useRef<Map<string, Author> | null>(null);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  React.useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      setError('Articles are not available yet. Please check back soon.');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const load = async () => {
      if (debouncedQuery) {
        if (!authorsRef.current) {
          const authors = await listAuthors();
          authorsRef.current = new Map(authors.map((author) => [author.id, author]));
        }
        const results = await searchArticles(debouncedQuery);
        if (cancelled) return;
        setItems(
          results.map(({ author_id, ...rest }) => ({
            ...rest,
            author: author_id ? (authorsRef.current?.get(author_id) ?? null) : null,
          })),
        );
        setTotal(results.length);
      } else {
        const { items: pageItems, total: count } = await listPublishedArticles(page);
        if (cancelled) return;
        setItems(pageItems);
        setTotal(count);
      }
    };

    load()
      .catch(() => {
        if (!cancelled) setError('Failed to load articles. Please try again later.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, page]);

  const totalPages = debouncedQuery ? 1 : Math.max(1, Math.ceil(total / ARTICLES_PAGE_SIZE));

  return (
    <div className="pt-14 lg:pt-32">
      <SEOHead
        title="Articles"
        description="Salesforce and CRM insights from the Klepka team: guides, best practices and product deep dives."
        canonicalPath="/articles"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'Klepka Articles',
          url: 'https://klepka.solutions/articles',
        }}
      />

      <section className="pb-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <h1 className="text-3xl sm:text-4xl mb-4 text-violet">Articles</h1>
            <p className="text-xl text-text-secondary leading-relaxed">
              Salesforce and CRM insights, guides and best practices from our team.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="max-w-xl mx-auto mt-8 relative"
          >
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-grey" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search articles by title or keywords..."
              aria-label="Search articles"
              className="w-full pl-12 pr-4 py-3 bg-card border border-border-color rounded-lg focus:outline-none focus:ring-2 focus:ring-violet/40 focus:border-transparent transition-all"
            />
          </motion.div>
        </div>
      </section>

      <section className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-card border border-border-color rounded-lg h-80 animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <p className="text-center text-text-secondary py-16">{error}</p>
          ) : items.length === 0 ? (
            <p className="text-center text-text-secondary py-16">
              {debouncedQuery ? `No articles found for “${debouncedQuery}”.` : 'No articles published yet.'}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((article, index) => (
                <ArticleCard key={article.id} article={article} index={index} />
              ))}
            </div>
          )}

          {!loading && !error && totalPages > 1 && (
            <Pagination className="mt-10">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    aria-disabled={page === 1}
                    className={page === 1 ? 'pointer-events-none opacity-50' : ''}
                    onClick={(event) => {
                      event.preventDefault();
                      setPage((p) => Math.max(1, p - 1));
                    }}
                  />
                </PaginationItem>
                {Array.from({ length: totalPages }).map((_, i) => (
                  <PaginationItem key={i}>
                    <PaginationLink
                      href="#"
                      isActive={page === i + 1}
                      onClick={(event) => {
                        event.preventDefault();
                        setPage(i + 1);
                      }}
                    >
                      {i + 1}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    aria-disabled={page === totalPages}
                    className={page === totalPages ? 'pointer-events-none opacity-50' : ''}
                    onClick={(event) => {
                      event.preventDefault();
                      setPage((p) => Math.min(totalPages, p + 1));
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      </section>
    </div>
  );
};
