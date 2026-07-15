import React from 'react';
import { generateHTML } from '@tiptap/core';
import { articleExtensions } from '@/app/lib/tiptap-extensions';
import type { ArticleBody as ArticleBodyContent } from '@/app/lib/articles-types';

interface ArticleBodyProps {
  body: ArticleBodyContent;
}

// Body JSON is admin-authored (trusted), rendered statically for SEO/prerender.
export const ArticleBody: React.FC<ArticleBodyProps> = ({ body }) => {
  const html = React.useMemo(() => generateHTML(body, articleExtensions), [body]);

  return <div className="article-body" dangerouslySetInnerHTML={{ __html: html }} />;
};
