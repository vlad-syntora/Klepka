import React from 'react';
import { BookOpen } from 'lucide-react';
import { usePortalData } from '@/app/hooks/use-portal-data';
import { listPublishedArticles } from '@/app/lib/articles-api';
import { formatDate } from '@/app/lib/portal-format';
import { FileViewer, type FileViewerFile } from '@/app/components/portal/FileViewer';
import { MaterialsWidget, ResourceRow } from '@/app/components/portal/MaterialsWidget';
import type { ArticleListItem as Article } from '@/app/lib/articles-types';
import { PortalCard } from '@/app/components/portal/PortalUi';

export const PortalStart: React.FC = () => {
  const { snapshot } = usePortalData();
  const [articles, setArticles] = React.useState<Article[]>([]);
  const [viewerFile, setViewerFile] = React.useState<FileViewerFile | null>(null);

  React.useEffect(() => {
    listPublishedArticles(1)
      .then(({ items }) => setArticles(items.slice(0, 4)))
      .catch(() => setArticles([]));
  }, []);

  if (!snapshot) return null;

  const { resources } = snapshot;
  const curatedArticles = resources.filter((resource) => resource.kind === 'article');

  return (
    <div className="space-y-2">
      <MaterialsWidget resources={resources} />

      {curatedArticles.length > 0 && (
        <PortalCard
          title="Worth reading"
          description="Hand-picked for you, plus the latest from our blog."
        >
          <ul className="mb-2 divide-y divide-border-color">
            {curatedArticles.map((resource) => (
              <ResourceRow key={resource.id} resource={resource} onView={setViewerFile} />
            ))}
          </ul>
          {articles.length > 0 && (
            <ul className="divide-y divide-border-color">
              {articles.map((article) => (
                <li key={article.id}>
                  <a
                    href={`/articles/${article.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-portal-tint/60"
                  >
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-portal-tint text-violet">
                      <BookOpen className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{article.title}</span>
                      <span className="mt-0.5 block text-sm text-grey">{article.excerpt}</span>
                      <span className="mt-0.5 block text-xs text-grey">{formatDate(article.published_at)}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </PortalCard>
      )}

      <FileViewer file={viewerFile} onClose={() => setViewerFile(null)} />
    </div>
  );
};
