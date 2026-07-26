import React from 'react';
import { toast } from 'sonner';
import { BookOpen, ExternalLink, FileText, Film, Presentation } from 'lucide-react';
import { usePortalData } from '@/app/hooks/use-portal-data';
import { getDocumentUrl } from '@/app/lib/portal-api';
import { driveFileId, resolveFileView } from '@/app/lib/file-view';
import { listPublishedArticles } from '@/app/lib/articles-api';
import { formatDate } from '@/app/lib/portal-format';
import { FileViewer, type FileViewerFile } from '@/app/components/portal/FileViewer';
import { RESOURCE_KIND_LABELS, type PortalResource } from '@/app/lib/portal-types';
import type { ArticleListItem as Article } from '@/app/lib/articles-types';
import {
  EmptyState,
  PortalCard,
  StatusTag,
} from '@/app/components/portal/PortalUi';

const KIND_ICON: Record<string, React.ElementType> = {
  presentation: Presentation,
  document: FileText,
  video: Film,
  link: ExternalLink,
  article: BookOpen,
};

const ResourceRow: React.FC<{ resource: PortalResource; onView: (file: FileViewerFile) => void }> = ({
  resource,
  onView,
}) => {
  const Icon = KIND_ICON[resource.kind] ?? ExternalLink;
  const title = resource.title || resource.article?.title || 'Material';

  const open = async () => {
    // Articles and genuine external links (websites, YouTube, …) still open in a new tab.
    if (resource.article?.slug) {
      window.open(`/articles/${resource.article.slug}`, '_blank', 'noopener');
      return;
    }
    if (resource.url) {
      const driveId = driveFileId(resource.url);
      if (driveId) {
        onView({ title, ...resolveFileView(resource.url, driveId) });
      } else {
        window.open(resource.url, '_blank', 'noopener');
      }
      return;
    }
    if (resource.file_path) {
      try {
        const resolved = await getDocumentUrl(resource.file_path);
        onView({ title, ...resolveFileView(resolved) });
      } catch (cause) {
        toast.error('Could not open', { description: cause instanceof Error ? cause.message : undefined });
      }
    }
  };

  return (
    <li>
      <button
        type="button"
        onClick={open}
        className="-mx-2 flex w-full items-start gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-portal-tint/60"
      >
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-portal-tint text-violet">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {resource.title || resource.article?.title}
            </span>
            <StatusTag tone="violet">{RESOURCE_KIND_LABELS[resource.kind]}</StatusTag>
          </span>
          {(resource.description || resource.article?.excerpt) && (
            <span className="mt-0.5 block text-sm text-grey">
              {resource.description || resource.article?.excerpt}
            </span>
          )}
        </span>
      </button>
    </li>
  );
};

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
  const curated = resources.filter((resource) => resource.kind !== 'article');
  const curatedArticles = resources.filter((resource) => resource.kind === 'article');

  return (
    <div className="space-y-5">
      <PortalCard title="Your materials" description="Everything we've prepared for this stage.">
        {curated.length === 0 ? (
          <EmptyState
            title="Nothing here yet"
            description="Your Klepka contact will share presentations and documents as you go."
          />
        ) : (
          <ul className="divide-y divide-border-color">
            {curated.map((resource) => (
              <ResourceRow key={resource.id} resource={resource} onView={setViewerFile} />
            ))}
          </ul>
        )}
      </PortalCard>

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
