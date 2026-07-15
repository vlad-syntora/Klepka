import React from 'react';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '../Button';
import { Input, TextArea } from '../Input';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { postComment } from '@/app/lib/articles-api';
import type { Comment } from '@/app/lib/articles-types';

const IDENTITY_STORAGE_KEY = 'klepka_comment_identity';

const IdentitySchema = z.object({ name: z.string(), email: z.string() });

function loadIdentity(): { name: string; email: string } | null {
  try {
    const raw = window.localStorage.getItem(IDENTITY_STORAGE_KEY);
    return raw ? IdentitySchema.parse(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

interface CommentFormProps {
  articleId: string;
  onPosted: (comment: Comment) => void;
}

export const CommentForm: React.FC<CommentFormProps> = ({ articleId, onPosted }) => {
  const saved = React.useMemo(loadIdentity, []);
  const [name, setName] = React.useState(saved?.name ?? '');
  const [email, setEmail] = React.useState(saved?.email ?? '');
  const [body, setBody] = React.useState('');
  const [website, setWebsite] = React.useState('');
  const [rememberMe, setRememberMe] = React.useState(Boolean(saved));
  const [turnstileToken, setTurnstileToken] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const turnstileRef = React.useRef<TurnstileInstance | null>(null);

  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    if (turnstileSiteKey && !turnstileToken) {
      toast.error('Please complete the verification challenge.');
      return;
    }

    setSubmitting(true);
    try {
      const comment = await postComment({
        articleId,
        name,
        email,
        body,
        turnstileToken: turnstileToken || 'missing',
        website,
      });

      if (rememberMe) {
        window.localStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify({ name, email }));
      } else {
        window.localStorage.removeItem(IDENTITY_STORAGE_KEY);
      }

      setBody('');
      toast.success('Comment posted!');
      onPosted(comment);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to post comment.');
    } finally {
      setTurnstileToken('');
      turnstileRef.current?.reset();
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-xl text-violet">Leave a comment</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={80}
          required
        />
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          maxLength={255}
          required
        />
      </div>

      {/* Honeypot: hidden from real users, bots tend to fill it. */}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label>
          Website
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />
        </label>
      </div>

      <TextArea
        label="Comment"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={4}
        maxLength={5000}
        required
      />

      <div className="flex items-center gap-2">
        <Checkbox
          id="remember-comment-identity"
          checked={rememberMe}
          onCheckedChange={(checked) => setRememberMe(checked === true)}
        />
        <Label htmlFor="remember-comment-identity" className="text-text-secondary cursor-pointer">
          Save my name and email in this browser for the next time I comment.
        </Label>
      </div>

      {turnstileSiteKey && (
        <Turnstile
          ref={turnstileRef}
          siteKey={turnstileSiteKey}
          onSuccess={setTurnstileToken}
          onExpire={() => setTurnstileToken('')}
        />
      )}

      <Button type="submit" disabled={submitting}>
        {submitting ? 'Posting...' : 'Post Comment'}
      </Button>
    </form>
  );
};
