import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { Badge } from '@/app/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar';
import type { ArticleListItem } from '@/app/lib/articles-types';

interface ArticleCardProps {
  article: ArticleListItem;
  index?: number;
}

export const ArticleCard: React.FC<ArticleCardProps> = ({ article, index = 0 }) => {
  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: Math.min(index, 5) * 0.05 }}
      className="bg-card border border-border-color rounded-lg shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow"
    >
      <Link to={`/articles/${article.slug}`} className="flex flex-col flex-1">
        {article.cover_url ? (
          <img
            src={article.cover_url}
            alt={article.title}
            className="w-full aspect-video object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full aspect-video bg-violet/10 flex items-center justify-center">
            <span className="text-violet text-2xl">Klepka</span>
          </div>
        )}

        <div className="p-6 flex flex-col flex-1">
          <h2 className="text-xl text-violet mb-2">{article.title}</h2>
          <p className="text-text-secondary text-sm leading-relaxed mb-4 line-clamp-3">
            {article.excerpt}
          </p>

          {article.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {article.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-violet border-violet/30">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          <div className="mt-auto flex items-center gap-3 pt-4 border-t border-border-color">
            {article.author && (
              <>
                <Avatar className="size-8">
                  <AvatarImage src={article.author.avatar_url ?? undefined} alt={article.author.full_name} />
                  <AvatarFallback className="bg-violet/10 text-violet text-xs">
                    {article.author.full_name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-text-secondary">{article.author.full_name}</span>
              </>
            )}
            {article.published_at && (
              <span className="text-sm text-grey ml-auto">
                {format(new Date(article.published_at), 'MMM d, yyyy')}
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.article>
  );
};
