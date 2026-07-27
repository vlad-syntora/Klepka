import React from 'react';
import { X } from 'lucide-react';
import { Badge } from '../ui/badge';

interface TagInputProps {
  label: string;
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

export const TagInput: React.FC<TagInputProps> = ({ label, value, onChange, placeholder }) => {
  const [draft, setDraft] = React.useState('');

  const addDraft = () => {
    const tag = draft.trim().toLowerCase();
    if (tag && !value.includes(tag)) {
      onChange([...value, tag]);
    }
    setDraft('');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addDraft();
    } else if (event.key === 'Backspace' && !draft && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div>
      <span className="block text-sm mb-2 text-violet">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 bg-card border border-border-color rounded-lg focus-within:ring-2 focus-within:ring-violet/40">
        {value.map((tag) => (
          <Badge key={tag} variant="outline" className="text-violet border-violet/30 gap-1">
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((t) => t !== tag))}
              aria-label={`Remove ${tag}`}
              className="hover:text-destructive"
            >
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addDraft}
          placeholder={value.length === 0 ? placeholder : undefined}
          aria-label={label}
          className="flex-1 min-w-24 bg-transparent focus:outline-none text-sm py-1"
        />
      </div>
    </div>
  );
};
