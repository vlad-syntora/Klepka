import React from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { EditorToolbar } from './EditorToolbar';
import { articleExtensions } from '@/app/lib/tiptap-extensions';
import type { ArticleBody } from '@/app/lib/articles-types';

interface RichTextEditorProps {
  initialContent: ArticleBody;
  onChange: (body: ArticleBody) => void;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ initialContent, onChange }) => {
  const editor = useEditor({
    extensions: articleExtensions,
    content: initialContent,
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        class: 'article-body focus:outline-none min-h-96 p-4 sm:p-6',
      },
    },
    onUpdate: ({ editor: instance }) => onChange(instance.getJSON()),
  });

  if (!editor) return null;

  return (
    <div className="bg-card border border-border-color rounded-lg shadow-sm">
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
};
