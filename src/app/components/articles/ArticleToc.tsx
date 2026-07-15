import React from 'react';
import type { TocItem } from '@/app/lib/tiptap-toc';

interface ArticleTocProps {
  items: TocItem[];
}

const HEADER_OFFSET = 120;

export const ArticleToc: React.FC<ArticleTocProps> = ({ items }) => {
  const [activeId, setActiveId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (items.length === 0) return;

    const headings = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: `-${HEADER_OFFSET}px 0px -60% 0px` },
    );

    headings.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  const handleClick = React.useCallback((event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    const target = document.getElementById(id);
    if (!target) return;

    const targetTop = target.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
    window.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
    window.history.replaceState(null, '', `#${id}`);
  }, []);

  if (items.length === 0) return null;

  return (
    <aside className="lg:sticky lg:top-28 bg-card border border-border-color rounded-lg p-4 sm:p-5 shadow-sm">
      <h2 className="text-lg text-violet mb-3">In this article</h2>
      <nav aria-label="Article contents">
        <ul className="space-y-2 max-h-[65vh] overflow-auto pr-1">
          {items.map((item) => (
            <li key={item.id} className={item.level === 2 ? '' : item.level === 3 ? 'pl-3' : 'pl-6'}>
              <a
                href={`#${item.id}`}
                onClick={(event) => handleClick(event, item.id)}
                className={`text-sm transition-colors ${
                  activeId === item.id ? 'text-violet' : 'text-text-secondary hover:text-violet'
                }`}
              >
                {item.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
};
