import React from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { BookOpen, CalendarPlus, ExternalLink, FileText, Film, Presentation } from 'lucide-react';
import { usePortalData } from '@/app/hooks/use-portal-data';
import { usePortalPhase } from '@/app/hooks/use-portal-phase';
import { getDocumentUrl } from '@/app/lib/portal-api';
import { listPublishedArticles } from '@/app/lib/articles-api';
import { formatDate, prettyName } from '@/app/lib/portal-format';
import { KlepkaTeamWidget } from '@/app/components/portal/KlepkaTeamWidget';
import { PHASE_BLURB, PHASE_LABELS } from '@/app/lib/portal-phase';
import { RESOURCE_KIND_LABELS, type PortalResource } from '@/app/lib/portal-types';
import type { ArticleListItem as Article } from '@/app/lib/articles-types';
import {
  EmptyState,
  PortalButton,
  PortalCard,
  StatusTag,
} from '@/app/components/portal/PortalUi';

const KIND_ICON: Record<string, React.ElementType> = {
  presentation: Presentation,
  document: FileText,
  video: Film,
  link: ExternalLink,
  article: BookOpen,
};

const ResourceRow: React.FC<{ resource: PortalResource }> = ({ resource }) => {
  const Icon = KIND_ICON[resource.kind] ?? ExternalLink;

  const open = async () => {
    if (resource.article?.slug) {
      window.open(`/articles/${resource.article.slug}`, '_blank', 'noopener');
      return;
    }
    if (resource.url) {
      window.open(resource.url, '_blank', 'noopener');
      return;
    }
    if (resource.file_path) {
      try {
        window.open(await getDocumentUrl(resource.file_path), '_blank', 'noopener');
      } catch (cause) {
        toast.error('Could not open', { description: cause instanceof Error ? cause.message : undefined });
      }
    }
  };

  return (
    <li>
      <button
        type="button"
        onClick={open}
        className="-mx-2 flex w-full items-start gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-portal-tint/60"
      >
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-portal-tint text-violet">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {resource.title || resource.article?.title}
            </span>
            <StatusTag tone="violet">{RESOURCE_KIND_LABELS[resource.kind]}</StatusTag>
          </span>
          {(resource.description || resource.article?.excerpt) && (
            <span className="mt-0.5 block text-sm text-grey">
              {resource.description || resource.article?.excerpt}
            </span>
          )}
        </span>
      </button>
    </li>
  );
};

export const PortalStart: React.FC = () => {
  const { snapshot } = usePortalData();
  const { phase } = usePortalPhase();
  const [articles, setArticles] = React.useState<Article[]>([]);

  React.useEffect(() => {
    listPublishedArticles(1)
      .then(({ items }) => setArticles(items.slice(0, 4)))
      .catch(() => setArticles([]));
  }, []);

  if (!snapshot) return null;

  const { account, resources, meetings, intake, klepkaTeam, projects } = snapshot;
  const curated = resources.filter((resource) => resource.kind !== 'article');
  const curatedArticles = resources.filter((resource) => resource.kind === 'article');
  const nextCall = meetings
    .filter((meeting) => ['requested', 'confirmed'].includes(meeting.status))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
  const openIntake = intake.filter((item) => item.owner_side === 'client' && item.status !== 'approved');

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-gradient-to-br from-violet to-[#9C63C9] px-6 py-6 text-white shadow-sm">
        <div className="text-xs uppercase tracking-widest text-white/80">{PHASE_LABELS[phase]}</div>
        <h2 className="mt-1 text-xl font-semibold">Welcome, {account.name}</h2>
        <p className="mt-1.5 max-w-2xl text-sm text-white/90">{PHASE_BLURB[phase]}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/portal/calls">
            <PortalButton className="bg-white text-violet hover:bg-accent-yellow">
              <CalendarPlus className="h-4 w-4" />
              {nextCall ? 'Manage your calls' : 'Book an intro call'}
            </PortalButton>
          </Link>
          {openIntake.length > 0 && (
            <Link to="/portal/intake">
              <PortalButton className="border border-white/60 bg-transparent text-white hover:bg-white/15">
                {openIntake.length} item{openIntake.length > 1 ? 's' : ''} need your input
              </PortalButton>
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <PortalCard title="Your materials" description="Everything we've prepared for this stage.">
            {curated.length === 0 ? (
              <EmptyState
                title="Nothing here yet"
                description="Your Klepka contact will share presentations and documents as you go."
              />
            ) : (
              <ul className="divide-y divide-border-color">
                {curated.map((resource) => (
                  <ResourceRow key={resource.id} resource={resource} />
                ))}
              </ul>
            )}
          </PortalCard>

          <PortalCard
            title="Worth reading"
            description="Hand-picked for you, plus the latest from our blog."
          >
            {curatedArticles.length > 0 && (
              <ul className="mb-2 divide-y divide-border-color">
                {curatedArticles.map((resource) => (
                  <ResourceRow key={resource.id} resource={resource} />
                ))}
              </ul>
            )}
            {articles.length === 0 && curatedArticles.length === 0 ? (
              <EmptyState title="No articles yet" />
            ) : (
              <ul className="divide-y divide-border-color">
                {articles.map((article) => (
                  <li key={article.id}>
                    <a
                      href={`/articles/${article.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-portal-tint/60"
                    >
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-portal-tint text-violet">
                        <BookOpen className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{article.title}</span>
                        <span className="mt-0.5 block text-sm text-grey">{article.excerpt}</span>
                        <span className="mt-0.5 block text-xs text-grey">{formatDate(article.published_at)}</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </PortalCard>
        </div>

        <div className="space-y-5">
          <PortalCard title="How this works">
            <ol className="space-y-3 text-sm">
              {(
                [
                  ['Getting started', 'Explore the material and meet the team.'],
                  ['Information gathering', 'We collect what we need to scope the work.'],
                  ['Proposal', 'You review, comment and accept — or ask for changes.'],
                  ['Delivery', 'Milestones, hours and invoices, tracked here.'],
                ] as const
              ).map(([title, blurb], index) => {
                const order = ['onboarding', 'discovery', 'proposal', 'delivery'];
                const current = order.indexOf(phase) === index;
                const done = order.indexOf(phase) > index;
                return (
                  <li key={title} className="flex gap-3">
                    <span
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        done
                          ? 'bg-violet text-white'
                          : current
                            ? 'border-2 border-violet bg-white text-violet'
                            : 'bg-slate-100 text-grey'
                      }`}
                    >
                      {done ? '✓' : index + 1}
                    </span>
                    <span>
                      <span className={current ? 'block font-semibold' : 'block font-medium'}>{title}</span>
                      <span className="block text-xs text-grey">{blurb}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </PortalCard>

          <PortalCard title="Your Klepka contact">
            <p className="text-sm font-medium">
              {account.owner ? prettyName(account.owner.full_name) : 'Being assigned'}
            </p>
            {account.owner?.title && <p className="text-xs text-grey">{account.owner.title}</p>}
            <Link to="/portal/calls" className="mt-3 block">
              <PortalButton variant="secondary" className="w-full">
                <CalendarPlus className="h-4 w-4" /> Book time
              </PortalButton>
            </Link>
          </PortalCard>

          <KlepkaTeamWidget klepkaTeam={klepkaTeam} projects={projects} />
        </div>
      </div>
    </div>
  );
};
