import React from 'react';
import { usePortalData } from '@/app/hooks/use-portal-data';
import { usePortalUser } from '@/app/hooks/use-portal-user';
import {
  derivePhase,
  isUnlocked,
  visibleSections,
  type PortalPhase,
  type PortalSection,
} from '@/app/lib/portal-phase';

interface PhaseState {
  phase: PortalPhase;
  /** True once the account has ever won an opportunity — the portal never narrows again. */
  unlocked: boolean;
  sections: PortalSection[];
  can: (section: PortalSection) => boolean;
}

/** Which portal this client gets right now: phase ∩ role. */
export function usePortalPhase(): PhaseState {
  const { snapshot } = usePortalData();
  const { user } = usePortalUser();

  return React.useMemo(() => {
    if (!snapshot || !user) {
      return { phase: 'onboarding' as PortalPhase, unlocked: false, sections: [], can: () => false };
    }
    const phase = derivePhase(snapshot.account, snapshot.opportunities);
    const sections = visibleSections(phase, user.role, user.module_access);
    return {
      phase,
      unlocked: isUnlocked(snapshot.account, snapshot.opportunities),
      sections,
      can: (section: PortalSection) => sections.includes(section),
    };
  }, [snapshot, user]);
}
