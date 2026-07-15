import StarterKit from '@tiptap/starter-kit';
import { Heading } from '@tiptap/extension-heading';
import { TextStyle, Color, FontFamily, FontSize } from '@tiptap/extension-text-style';
import { Highlight } from '@tiptap/extension-highlight';
import { TextAlign } from '@tiptap/extension-text-align';
import { Image } from '@tiptap/extension-image';
import { Youtube } from '@tiptap/extension-youtube';
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
import type { AnyExtension } from '@tiptap/core';

// Heading with a persisted id attribute so TOC anchors survive JSON -> HTML rendering.
const HeadingWithId = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute('id'),
        renderHTML: (attributes) => (attributes.id ? { id: attributes.id } : {}),
      },
    };
  },
}).configure({ levels: [2, 3, 4] });

// Single source of truth for the editor and the public renderer.
export const articleExtensions: AnyExtension[] = [
  StarterKit.configure({
    heading: false,
    link: {
      openOnClick: false,
      autolink: true,
      HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
    },
  }),
  HeadingWithId,
  TextStyle,
  Color,
  FontFamily,
  FontSize,
  Highlight.configure({ multicolor: true }),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Image.configure({ inline: false }),
  Youtube.configure({ nocookie: true, width: 640, height: 360 }),
  Table.configure({ resizable: false }),
  TableRow,
  TableHeader,
  TableCell,
];
