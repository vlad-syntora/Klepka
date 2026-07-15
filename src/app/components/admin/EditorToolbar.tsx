import React from 'react';
import type { Editor } from '@tiptap/react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Highlighter,
  ImagePlus,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Palette,
  Quote,
  Redo2,
  SquareCode,
  Strikethrough,
  Table as TableIcon,
  Underline as UnderlineIcon,
  Undo2,
  Youtube as YoutubeIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { uploadMedia } from '@/app/lib/admin-api';

interface EditorToolbarProps {
  editor: Editor;
}

const FONT_FAMILIES = [
  { label: 'Default', value: '' },
  { label: 'Inter', value: 'Inter, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: '"Times New Roman", serif' },
  { label: 'Courier New', value: '"Courier New", monospace' },
  { label: 'Arial', value: 'Arial, sans-serif' },
];

const FONT_SIZES = ['', '12px', '14px', '16px', '18px', '20px', '24px', '30px'];

const ToolbarButton: React.FC<{
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}> = ({ onClick, active, disabled, label, children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    title={label}
    className={`p-2 rounded-md transition-colors disabled:opacity-40 ${
      active ? 'bg-violet text-white' : 'text-foreground hover:bg-violet/10 hover:text-violet'
    }`}
  >
    {children}
  </button>
);

const Divider = () => <div className="w-px h-6 bg-border-color mx-1 self-center" />;

function UrlPopover({
  label,
  icon,
  active,
  initialUrl,
  onApply,
}: {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  initialUrl?: string;
  onApply: (url: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [url, setUrl] = React.useState('');

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setUrl(initialUrl ?? '');
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          className={`p-2 rounded-md transition-colors ${
            active ? 'bg-violet text-white' : 'text-foreground hover:bg-violet/10 hover:text-violet'
          }`}
        >
          {icon}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onApply(url.trim());
            setOpen(false);
          }}
          className="flex gap-2"
        >
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://..."
            aria-label={`${label} URL`}
            className="flex-1 px-3 py-1.5 border border-border-color rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-violet/40"
          />
          <button type="submit" className="px-3 py-1.5 bg-violet text-white rounded-md text-sm">
            Apply
          </button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({ editor }) => {
  const imageInputRef = React.useRef<HTMLInputElement>(null);

  const currentHeading = [2, 3, 4].find((level) => editor.isActive('heading', { level }));
  const blockValue = currentHeading ? `h${currentHeading}` : 'p';

  const handleImageFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadMedia(file, 'inline');
      editor.chain().focus().setImage({ src: url }).run();
    } catch (error) {
      toast.error('Image upload failed', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      event.target.value = '';
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border-color p-2 bg-off-white rounded-t-lg sticky top-0 z-10">
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        label="Undo"
      >
        <Undo2 className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        label="Redo"
      >
        <Redo2 className="w-4 h-4" />
      </ToolbarButton>

      <Divider />

      <Select
        value={blockValue}
        onValueChange={(value) => {
          const chain = editor.chain().focus();
          if (value === 'p') chain.setParagraph().run();
          else chain.toggleHeading({ level: Number(value.slice(1)) as 2 | 3 | 4 }).run();
        }}
      >
        <SelectTrigger className="w-32 h-8 bg-card" size="sm" aria-label="Text style">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="p">Paragraph</SelectItem>
          <SelectItem value="h2">Heading 2</SelectItem>
          <SelectItem value="h3">Heading 3</SelectItem>
          <SelectItem value="h4">Heading 4</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={(editor.getAttributes('textStyle').fontFamily as string | undefined) ?? ''}
        onValueChange={(value) => {
          const chain = editor.chain().focus();
          if (value) chain.setFontFamily(value).run();
          else chain.unsetFontFamily().run();
        }}
      >
        <SelectTrigger className="w-36 h-8 bg-card" size="sm" aria-label="Font family">
          <SelectValue placeholder="Font" />
        </SelectTrigger>
        <SelectContent>
          {FONT_FAMILIES.map((font) => (
            <SelectItem key={font.label} value={font.value || 'default'}>
              {font.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={(editor.getAttributes('textStyle').fontSize as string | undefined) ?? ''}
        onValueChange={(value) => {
          const chain = editor.chain().focus();
          if (value && value !== 'default') chain.setFontSize(value).run();
          else chain.unsetFontSize().run();
        }}
      >
        <SelectTrigger className="w-24 h-8 bg-card" size="sm" aria-label="Font size">
          <SelectValue placeholder="Size" />
        </SelectTrigger>
        <SelectContent>
          {FONT_SIZES.map((size) => (
            <SelectItem key={size || 'default'} value={size || 'default'}>
              {size || 'Default'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Divider />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        label="Bold"
      >
        <Bold className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        label="Italic"
      >
        <Italic className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive('underline')}
        label="Underline"
      >
        <UnderlineIcon className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive('strike')}
        label="Strikethrough"
      >
        <Strikethrough className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive('code')}
        label="Inline code"
      >
        <Code className="w-4 h-4" />
      </ToolbarButton>

      <label
        className="p-2 rounded-md transition-colors text-foreground hover:bg-violet/10 hover:text-violet cursor-pointer"
        title="Text color"
      >
        <Palette className="w-4 h-4" />
        <input
          type="color"
          className="sr-only"
          aria-label="Text color"
          onChange={(event) => editor.chain().focus().setColor(event.target.value).run()}
        />
      </label>
      <label
        className={`p-2 rounded-md transition-colors cursor-pointer ${
          editor.isActive('highlight')
            ? 'bg-violet text-white'
            : 'text-foreground hover:bg-violet/10 hover:text-violet'
        }`}
        title="Highlight"
      >
        <Highlighter className="w-4 h-4" />
        <input
          type="color"
          defaultValue="#F9EDBD"
          className="sr-only"
          aria-label="Highlight color"
          onChange={(event) =>
            editor.chain().focus().toggleHighlight({ color: event.target.value }).run()
          }
        />
      </label>

      <Divider />

      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        active={editor.isActive({ textAlign: 'left' })}
        label="Align left"
      >
        <AlignLeft className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        active={editor.isActive({ textAlign: 'center' })}
        label="Align center"
      >
        <AlignCenter className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        active={editor.isActive({ textAlign: 'right' })}
        label="Align right"
      >
        <AlignRight className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        active={editor.isActive({ textAlign: 'justify' })}
        label="Justify"
      >
        <AlignJustify className="w-4 h-4" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
        label="Bullet list"
      >
        <List className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
        label="Numbered list"
      >
        <ListOrdered className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')}
        label="Blockquote"
      >
        <Quote className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        active={editor.isActive('codeBlock')}
        label="Code block"
      >
        <SquareCode className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        label="Horizontal rule"
      >
        <Minus className="w-4 h-4" />
      </ToolbarButton>

      <Divider />

      <UrlPopover
        label="Link"
        icon={<LinkIcon className="w-4 h-4" />}
        active={editor.isActive('link')}
        initialUrl={(editor.getAttributes('link').href as string | undefined) ?? ''}
        onApply={(url) => {
          const chain = editor.chain().focus();
          if (!url) chain.unsetLink().run();
          else chain.extendMarkRange('link').setLink({ href: url }).run();
        }}
      />

      <ToolbarButton onClick={() => imageInputRef.current?.click()} label="Insert image">
        <ImagePlus className="w-4 h-4" />
      </ToolbarButton>
      <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageFile} className="hidden" />

      <UrlPopover
        label="YouTube video"
        icon={<YoutubeIcon className="w-4 h-4" />}
        onApply={(url) => {
          if (url) editor.chain().focus().setYoutubeVideo({ src: url }).run();
        }}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Table"
            title="Table"
            className={`p-2 rounded-md transition-colors ${
              editor.isActive('table')
                ? 'bg-violet text-white'
                : 'text-foreground hover:bg-violet/10 hover:text-violet'
            }`}
          >
            <TableIcon className="w-4 h-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem
            onClick={() =>
              editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
            }
          >
            Insert table
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!editor.isActive('table')}
            onClick={() => editor.chain().focus().addRowAfter().run()}
          >
            Add row
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!editor.isActive('table')}
            onClick={() => editor.chain().focus().addColumnAfter().run()}
          >
            Add column
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!editor.isActive('table')}
            onClick={() => editor.chain().focus().deleteRow().run()}
          >
            Delete row
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!editor.isActive('table')}
            onClick={() => editor.chain().focus().deleteColumn().run()}
          >
            Delete column
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!editor.isActive('table')}
            onClick={() => editor.chain().focus().deleteTable().run()}
          >
            Delete table
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
