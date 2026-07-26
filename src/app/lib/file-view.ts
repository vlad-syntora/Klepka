/**
 * Turns a stored file link into the URLs the in-portal viewer needs. Files live in Google Drive
 * (an account's Shared Drive folder) or, as a fallback, a Supabase Storage signed URL. Drive links
 * can't be dropped into an `<iframe>` as-is — the `/preview` variant can, and `uc?export=download`
 * forces a download — so we normalise both here.
 */
export interface FileView {
  /** URL safe to embed in an `<iframe>` for inline preview. */
  previewUrl: string;
  /** URL that downloads the file directly. */
  downloadUrl: string;
  /** The original link, for an "open in new tab" fallback. */
  sourceUrl: string;
}

/** Pull a Google Drive file id out of the common link shapes, or null if it isn't a Drive link. */
export function driveFileId(url: string): string | null {
  // .../file/d/<id>/view, .../d/<id>/edit, docs.google.com/document/d/<id>/...
  const path = url.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
  if (path) return path[1];
  // ...open?id=<id>, ...uc?id=<id>&...
  const query = url.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (query) return query[1];
  return null;
}

/**
 * Resolve a (already dereferenced) file URL into preview/download links. Pass an explicit Drive
 * file id when the record has one — it's more reliable than parsing the share link.
 */
export function resolveFileView(url: string, driveId?: string | null): FileView {
  const id = driveId || driveFileId(url);
  if (id) {
    return {
      previewUrl: `https://drive.google.com/file/d/${id}/preview`,
      downloadUrl: `https://drive.google.com/uc?export=download&id=${id}`,
      sourceUrl: url,
    };
  }
  // A direct http(s) file (e.g. a Supabase Storage signed URL) — browsers render PDFs/images in
  // an iframe, and the same URL serves the download.
  return { previewUrl: url, downloadUrl: url, sourceUrl: url };
}
