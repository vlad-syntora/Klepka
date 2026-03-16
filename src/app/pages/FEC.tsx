import React from 'react';
import { motion } from 'motion/react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SEOHead } from '../components/SEOHead';
import userGuideContent from '../../../guidelines/productUserGuides/user-guide.md?raw';

type Bookmark = {
  id: string;
  level: number;
  title: string;
};

function unescapeMarkdownText(value: string): string {
  return value.replace(/\\([\\`*{}\[\]()#+\-.!_>])/g, '$1');
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

function stripTableOfContents(markdown: string): string {
  const lines = markdown.split('\n');
  const result: string[] = [];
  let skipping = false;

  for (const line of lines) {
    if (!skipping && line.trim() === '## Table of Contents') {
      skipping = true;
      continue;
    }

    if (skipping) {
      if (/^##\s+/.test(line)) {
        skipping = false;
        result.push(line);
      }
      continue;
    }

    result.push(line);
  }

  return result.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export const FEC: React.FC = () => {
  const guideContent = React.useMemo(() => stripTableOfContents(userGuideContent), []);

  /** Single source of truth: heading plain-text → stable slug id */
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
          title,
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
        <a href={src} target="_blank" rel="noopener noreferrer" className="block my-4">
          <img
            src={src}
            alt={alt ?? ''}
            className="w-auto h-auto max-w-full rounded-lg border border-border-color shadow-sm"
            style={{ imageRendering: 'auto' }}
            loading="eager"
          />
        </a>
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
  }, [idMap]);

  return (
    <div className="pt-14 lg:pt-32">
      <SEOHead
        title="FEC User Guide | Klepka"
        description="Flow Email Composer (FEC) user guide for Salesforce administrators and end users."
        canonicalPath="/fec"
      />

      <section className="pb-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <h1 className="text-3xl sm:text-4xl mb-4 text-violet">
              Flow Email Composer
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
            <nav aria-label="FEC user guide bookmarks">
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

    </div>
  );
};
