import type { JSONContent } from '@tiptap/core';

export interface TocItem {
  id: string;
  level: number;
  title: string;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
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
    return count === 0 ? base : `${base}-${count + 1}`;
  };
}

function headingText(node: JSONContent): string {
  if (!node.content) return '';
  return node.content
    .map((child) => (child.type === 'text' ? (child.text ?? '') : headingText(child)))
    .join('');
}

function isTocHeading(node: JSONContent): boolean {
  const level = node.attrs?.level as number | undefined;
  return node.type === 'heading' && level !== undefined && level >= 2 && level <= 4;
}

/** Returns a copy of the doc with deterministic ids assigned to h2-h4 nodes. */
export function injectHeadingIds(doc: JSONContent): JSONContent {
  const nextSlug = createSlugger();

  const walk = (node: JSONContent): JSONContent => {
    const copy: JSONContent = { ...node };
    if (isTocHeading(node)) {
      copy.attrs = { ...node.attrs, id: nextSlug(headingText(node)) };
    }
    if (node.content) {
      copy.content = node.content.map(walk);
    }
    return copy;
  };

  return walk(doc);
}

/** Extracts the article map from a doc processed by injectHeadingIds. */
export function extractToc(doc: JSONContent): TocItem[] {
  const items: TocItem[] = [];

  const walk = (node: JSONContent) => {
    if (isTocHeading(node) && node.attrs?.id) {
      items.push({
        id: node.attrs.id as string,
        level: node.attrs.level as number,
        title: headingText(node),
      });
    }
    node.content?.forEach(walk);
  };

  walk(doc);
  return items;
}
