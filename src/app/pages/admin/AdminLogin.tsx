import React from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { SEOHead } from '../../components/SEOHead';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { getSupabase, isSupabaseConfigured } from '@/app/lib/supabase';
import { GoogleButton } from '@/app/components/portal/GoogleButton';
import { EmailLinkForm } from '@/app/components/portal/EmailLinkForm';
import logoPurple from '../../../assets/85bd7ec43f69e1c0fc0ed1f1121c7466d87fd6c5.png';

export const AdminLogin: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isSupabaseConfigured()) {
      toast.error('Supabase is not configured.');
      return;
    }

    setSubmitting(true);
    const { error } = await getSupabase().auth.signInWithPassword({ email, password });
    setSubmitting(false);

    if (error) {
      toast.error('Sign in failed', { description: error.message });
      return;
    }
    navigate('/admin/articles');
  };

  return (
    <div className="min-h-screen bg-off-white flex items-center justify-center px-4">
      <SEOHead title="Admin Sign In" description="Klepka admin panel" noindex />

      <div className="w-full max-w-sm bg-card border border-border-color rounded-lg shadow-sm p-8">
        <img src={logoPurple} alt="KLEPKA" className="h-10 w-auto mx-auto mb-6" />
        <h1 className="text-xl text-violet text-center mb-6">Admin Sign In</h1>

        <GoogleButton redirectPath="/admin" />

        <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wide text-grey">
          <span className="h-px flex-1 bg-border-color" />
          or
          <span className="h-px flex-1 bg-border-color" />
        </div>

        <EmailLinkForm redirectPath="/admin" />

        <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wide text-grey">
          <span className="h-px flex-1 bg-border-color" />
          with a password
          <span className="h-px flex-1 bg-border-color" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
      </div>
    </div>
  );
};
