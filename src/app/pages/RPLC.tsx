import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SEOHead } from '../components/SEOHead';
import { ImageLightbox } from '../components/ImageLightbox';
import userGuideContent from '../../../guidelines/productUserGuides/UserGuideRecordProfile.md?raw';
import screenshotConfig from '@/assets/RPLC/Screenshot 2026-03-24 at 14.02.37.png';
import screenshotProfileCard from '@/assets/RPLC/Screenshot 2026-03-24 at 14.04.10.png';
import screenshotCompanyLogo from '@/assets/RPLC/Screenshot 2026-03-24 at 14.04.17.png';

type Bookmark = {
  id: string;
  level: number;
  title: string;
};

function unescapeMarkdownText(value: string): string {
  return value.replace(/\\([\\`*{}[\]()#+\-.!_>])/g, '$1');
}

function stripMarkdownFormatting(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .trim();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/[`*_~]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function createSlugger() {
  const seen = new Map<string, number>();
  return (value: string) => {
    const base = slugify(value) || 'section';
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}-${count}`;
  };
}

function textFromNode(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textFromNode).join('');
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return textFromNode(node.props.children);
  }
  return '';
}

export const RPLC: React.FC = () => {
  const [lightboxImage, setLightboxImage] = React.useState<{ src: string; alt: string } | null>(null);

  const guideContent = React.useMemo(
    () =>
      userGuideContent
        .replace(/^\[image1\]:\s*<data:[^\n]+$/m, `[image1]: ${screenshotConfig}`)
        .replace(/^\[image2\]:\s*<data:[^\n]+$/m, `[image2]: ${screenshotProfileCard}`)
        .replace(/^\[image3\]:\s*<data:[^\n]+$/m, `[image3]: ${screenshotCompanyLogo}`)
        .trim(),
    [],
  );

  const idMap = React.useMemo<Map<string, string>>(() => {
    const nextSlug = createSlugger();
    const map = new Map<string, string>();
    for (const line of guideContent.split('\n')) {
      const match = line.match(/^#{1,3}\s+(.+)$/);
      if (!match) continue;
      const title = unescapeMarkdownText(match[1].trim());
      if (!map.has(title)) {
        map.set(title, nextSlug(title));
      }
    }
    return map;
  }, [guideContent]);

  const bookmarks = React.useMemo<Bookmark[]>(() => {
    return guideContent.split('\n')
      .map((line) => {
        const match = line.match(/^(#{1,3})\s+(.+)$/);
        if (!match) return null;
        const [, hashes, rawTitle] = match;
        const title = unescapeMarkdownText(rawTitle.trim());
        return {
          title: stripMarkdownFormatting(title),
          level: hashes.length,
          id: idMap.get(title) ?? slugify(title),
        };
      })
      .filter((item): item is Bookmark => Boolean(item));
  }, [guideContent, idMap]);

  const handleBookmarkClick = React.useCallback((event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    const target = document.getElementById(id);
    if (!target) return;

    const headerOffset = 120;
    const targetTop = target.getBoundingClientRect().top + window.scrollY - headerOffset;

    window.scrollTo({
      top: Math.max(0, targetTop),
      behavior: 'smooth',
    });
    window.history.replaceState(null, '', `#${id}`);
  }, []);

  const markdownComponents = React.useMemo<Components>(() => {
    const headingId = (children: React.ReactNode) => {
      const title = unescapeMarkdownText(textFromNode(children));
      return idMap.get(title) ?? slugify(title);
    };

    return {
      h1: ({ children }) => (
        <h1 id={headingId(children)} className="text-3xl sm:text-4xl text-violet mt-6 mb-4 scroll-mt-28">
          {children}
        </h1>
      ),
      h2: ({ children }) => (
        <h2 id={headingId(children)} className="text-2xl text-violet mt-8 mb-3 scroll-mt-28">
          {children}
        </h2>
      ),
      h3: ({ children }) => (
        <h3 id={headingId(children)} className="text-xl text-violet mt-6 mb-2 scroll-mt-28">
          {children}
        </h3>
      ),
      p: ({ children }) => <p className="text-text-secondary leading-relaxed mb-4">{children}</p>,
      ul: ({ children }) => <ul className="list-disc pl-6 mb-4 space-y-1">{children}</ul>,
      ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 space-y-1">{children}</ol>,
      li: ({ children }) => <li className="text-text-secondary">{children}</li>,
      hr: () => <hr className="my-6 border-border-color" />,
      table: ({ children }) => (
        <div className="overflow-x-auto mb-6">
          <table className="min-w-full border border-border-color text-left text-sm">{children}</table>
        </div>
      ),
      th: ({ children }) => (
        <th className="bg-violet/8 text-violet border border-border-color px-3 py-2 font-semibold">
          {children}
        </th>
      ),
      td: ({ children }) => (
        <td className="border border-border-color px-3 py-2 text-text-secondary">{children}</td>
      ),
      img: ({ src, alt }) => (
        <button
          type="button"
          className="block my-4 cursor-zoom-in p-0 border-0 bg-transparent"
          onClick={() => setLightboxImage({ src: src ?? '', alt: alt ?? '' })}
          aria-label={`View image: ${alt ?? ''}`}
        >
          <img
            src={src}
            alt={alt ?? ''}
            className="rounded-lg border border-border-color shadow-sm"
            style={{ imageRendering: 'auto', maxWidth: '480px', width: '100%', height: 'auto' }}
            loading="eager"
          />
        </button>
      ),
      code: ({ children }) => (
        <code className="bg-violet/8 text-violet px-1.5 py-0.5 rounded text-sm">{children}</code>
      ),
      a: ({ href, children }) => (
        <a href={href} className="text-violet underline hover:text-violet/80" target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      ),
    };
  }, [idMap, setLightboxImage]);

  return (
    <div className="pt-14 lg:pt-32">
      <SEOHead
        title="RPLC User Guide | Klepka"
        description="Record Photo & Logo Component for Salesforce user guide for Salesforce administrators and end users."
        canonicalPath="/rplc"
      />

      <section className="pb-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <h1 className="text-3xl sm:text-4xl mb-4 text-violet">
              Record Photo & Logo Component
            </h1>
            <p className="text-xl text-text-secondary leading-relaxed">
              Official user guide for administrators and end users.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 lg:gap-8 items-start">
          <aside className="lg:sticky lg:top-28 bg-card border border-border-color rounded-lg p-4 sm:p-5 shadow-sm">
            <h2 className="text-lg text-violet mb-3">Bookmarks</h2>
            <nav aria-label="RPLC user guide bookmarks">
              <ul className="space-y-2 max-h-[65vh] overflow-auto pr-1">
                {bookmarks.map((bookmark) => (
                  <li key={bookmark.id} className={bookmark.level === 1 ? '' : bookmark.level === 2 ? 'pl-3' : 'pl-6'}>
                    <a
                      href={`#${bookmark.id}`}
                      onClick={(event) => handleBookmarkClick(event, bookmark.id)}
                      className="text-sm text-text-secondary hover:text-violet transition-colors"
                    >
                      {bookmark.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          <motion.article
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-card border border-border-color rounded-lg p-6 sm:p-8 shadow-sm"
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
              urlTransform={(url) => {
                if (/^javascript:/i.test(url)) return '';
                return url;
              }}
            >
              {guideContent}
            </ReactMarkdown>
          </motion.article>
        </div>
      </section>

      <AnimatePresence>
        {lightboxImage && (
          <ImageLightbox
            src={lightboxImage.src}
            alt={lightboxImage.alt}
            onClose={() => setLightboxImage(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};