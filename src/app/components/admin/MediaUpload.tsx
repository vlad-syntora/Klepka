import React from 'react';
import { ImagePlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { uploadMedia } from '@/app/lib/admin-api';

interface MediaUploadProps {
  label: string;
  value: string | null;
  folder: 'covers' | 'avatars';
  onChange: (url: string | null) => void;
}

export const MediaUpload: React.FC<MediaUploadProps> = ({ label, value, folder, onChange }) => {
  const [uploading, setUploading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      onChange(await uploadMedia(file, folder));
    } catch (error) {
      toast.error('Upload failed', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  return (
    <div>
      <span className="block text-sm mb-2 text-violet">{label}</span>

      {value ? (
        <div className="relative w-fit">
          <img
            src={value}
            alt={label}
            className={`rounded-lg border border-border-color object-cover ${
              folder === 'avatars' ? 'w-20 h-20' : 'w-full max-w-sm aspect-video'
            }`}
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-1 shadow"
            aria-label={`Remove ${label}`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border-color rounded-lg text-grey hover:border-violet hover:text-violet transition-colors disabled:opacity-50 ${
            folder === 'avatars' ? 'w-20 h-20' : 'w-full max-w-sm aspect-video'
          }`}
        >
          <ImagePlus className="w-6 h-6" />
          <span className="text-xs">{uploading ? 'Uploading...' : 'Upload image'}</span>
        </button>
      )}

      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
    </div>
  );
};
