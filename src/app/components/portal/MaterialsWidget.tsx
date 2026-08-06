import React from 'react';
import { toast } from 'sonner';
import { BookOpen, ExternalLink, FileText, Film, Presentation } from 'lucide-react';
import { getDocumentUrl } from '@/app/lib/portal-api';
import { driveFileId, resolveFileView } from '@/app/lib/file-view';
import { RESOURCE_KIND_LABELS, type PortalResource } from '@/app/lib/portal-types';
import { FileViewer, type FileViewerFile } from '@/app/components/portal/FileViewer';
import { EmptyState, PortalCard, StatusTag } from '@/app/components/portal/PortalUi';

const KIND_ICON: Record<string, React.ElementType> = {
  presentation: Presentation,
  document: FileText,
  video: Film,
  link: ExternalLink,
  article: BookOpen,
};

export const ResourceRow: React.FC<{ resource: PortalResource; onView: (file: FileViewerFile) => void }> = ({
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
            <span className="text-sm font-medium text-foreground">{resource.title || resource.article?.title}</span>
            <StatusTag tone="violet">{RESOURCE_KIND_LABELS[resource.kind]}</StatusTag>
          </span>
          {(resource.description || resource.article?.excerpt) && (
            <span className="mt-0.5 block text-sm text-grey">{resource.description || resource.article?.excerpt}</span>
          )}
        </span>
      </button>
    </li>
  );
};

/**
 * The "Your materials" card (curated presentations/documents) from the Presentations page. Reused
 * verbatim on the dashboard so the two stay in sync. Manages its own file viewer.
 */
export const MaterialsWidget: React.FC<{ resources: PortalResource[]; title?: string }> = ({
  resources,
  title = 'Your materials',
}) => {
  const [viewerFile, setViewerFile] = React.useState<FileViewerFile | null>(null);
  const curated = resources.filter((resource) => resource.kind !== 'article');

  return (
    <>
      <PortalCard title={title} description="Everything we've prepared for this stage.">
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
      <FileViewer file={viewerFile} onClose={() => setViewerFile(null)} />
    </>
  );
};
