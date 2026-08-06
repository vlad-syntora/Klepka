import React from 'react';
import { usePortalPhase } from '@/app/hooks/use-portal-phase';
import { PortalPipeline } from '@/app/pages/portal/PortalPipeline';
import { PortalProject } from '@/app/pages/portal/PortalProject';
import { cn } from '@/app/components/ui/utils';

type HubTab = 'pipeline' | 'project';

/**
 * Client-facing "Project Tracker" home. Pipeline & Offers and the Project Tracker used to be two
 * separate pages; they're now two tabs here. Which tabs appear depends on the account's phase and
 * role (a prospect in Proposal only gets Pipeline & Offers; a delivery client gets both). When only
 * one tab is available the tab bar is hidden and its content shows on its own.
 */
export const PortalProjectHub: React.FC = () => {
  const { can } = usePortalPhase();
  const showPipeline = can('pipeline');
  const showProject = can('project');

  const tabs: { key: HubTab; label: string }[] = [
    ...(showPipeline ? [{ key: 'pipeline' as const, label: 'Pipeline & Offers' }] : []),
    ...(showProject ? [{ key: 'project' as const, label: 'Project Tracker' }] : []),
  ];

  // This page carries the old opportunity page's identity, so land on Pipeline & Offers when it's
  // available and fall back to the Project Tracker only when there's no pipeline to show.
  const [tab, setTab] = React.useState<HubTab>(showPipeline ? 'pipeline' : 'project');

  // Keep the active tab valid if entitlements resolve after the first render.
  React.useEffect(() => {
    if (tab === 'project' && !showProject) setTab(showPipeline ? 'pipeline' : 'project');
    if (tab === 'pipeline' && !showPipeline) setTab(showProject ? 'project' : 'pipeline');
  }, [showPipeline, showProject, tab]);

  if (tabs.length === 0) return null;

  return (
    <div className="space-y-2">
      {tabs.length > 1 && (
        <div className="-mb-px flex gap-1 overflow-x-auto border-b border-border-color">
          {tabs.map((entry) => (
            <button
              key={entry.key}
              onClick={() => setTab(entry.key)}
              className={cn(
                'whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors',
                tab === entry.key
                  ? 'border-violet font-medium text-violet'
                  : 'border-transparent text-grey hover:text-foreground',
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>
      )}

      {tab === 'pipeline' && showPipeline ? <PortalPipeline /> : null}
      {tab === 'project' && showProject ? <PortalProject /> : null}
    </div>
  );
};
