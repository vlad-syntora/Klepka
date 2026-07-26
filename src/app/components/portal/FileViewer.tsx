import React from 'react';
import { Download, X } from 'lucide-react';
import type { FileView } from '@/app/lib/file-view';
import { PortalButton } from '@/app/components/portal/PortalUi';

export interface FileViewerFile extends FileView {
  title: string;
}

/**
 * Full-screen modal that previews a file inline (in an iframe) instead of punting the client to a
 * new browser tab, with a Download button and an "open in new tab" escape hatch. Render it near the
 * root of a page and drive it with a piece of state — it shows nothing when `file` is null.
 */
export const FileViewer: React.FC<{ file: FileViewerFile | null; onClose: () => void }> = ({
  file,
  onClose,
}) => {
  React.useEffect(() => {
    if (!file) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    // Lock background scroll while the viewer is open.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [file, onClose]);

  if (!file) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/70 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={file.title}
      onClick={onClose}
    >
      <div
        className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-card shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center gap-3 border-b border-border-color px-4 py-3">
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{file.title}</h2>
          <a href={file.downloadUrl} target="_blank" rel="noopener noreferrer">
            <PortalButton variant="secondary" className="whitespace-nowrap">
              <Download className="h-4 w-4" /> Download
            </PortalButton>
          </a>
          <PortalButton variant="ghost" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </PortalButton>
        </header>
        <div className="relative flex-1">
          <iframe
            src={file.previewUrl}
            title={file.title}
            className="h-full w-full bg-off-white"
            allow="autoplay"
          />
          {/* Google Drive's preview injects a "Pop-out" button in its top-right; it lives in a
              cross-origin iframe we can't edit, so we mask that corner (the viewer's dark gutter)
              to hide it and swallow the click. */}
          <div
            aria-hidden
            className="absolute right-0 top-0 h-14 w-16 bg-[#202124]"
          />
        </div>
      </div>
    </div>
  );
};
