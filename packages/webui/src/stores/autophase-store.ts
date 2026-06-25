import { create } from 'zustand';
import type { PhaseItem } from '@/components/PhasePanel';
import type { SddBoardFeedEntry } from './sdd-board-store';

// ── AutoPhase Store ────────────────────────────────────────────────────────

export type AutoPhaseStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'stopped';

/** Cap on the live activity feed (newest-first). */
const FEED_CAP = 60;

/**
 * Derive feed entries by diffing the previous phase snapshot against the next.
 * AutoPhase broadcasts whole-board state (not granular events), so we
 * reconstruct the "what just happened" ticker client-side from task status
 * transitions — no backend/WS-protocol change required. Reuses the SDD feed
 * entry shape so SddActivityFeed renders it unchanged.
 */
function deriveFeed(prev: PhaseItem[], next: PhaseItem[], now: number): SddBoardFeedEntry[] {
  const prevStatus = new Map<string, string>();
  for (const p of prev) for (const t of p.tasks ?? []) prevStatus.set(t.id, t.status);

  const out: SddBoardFeedEntry[] = [];
  for (const p of next) {
    for (const t of p.tasks ?? []) {
      const before = prevStatus.get(t.id);
      if (before === undefined || before === t.status) continue;
      if (t.status === 'in_progress') {
        out.push({ ts: now, kind: 'started', agentName: t.assignee, text: `${t.assignee ?? 'Agent'} started “${t.title}”` });
      } else if (t.status === 'completed') {
        out.push({ ts: now, kind: 'completed', agentName: t.assignee, text: `Completed “${t.title}”` });
      } else if (t.status === 'failed') {
        out.push({ ts: now, kind: 'failed', agentName: t.assignee, text: `Failed “${t.title}”` });
      }
    }
  }
  // Phase-level completion as a "wave" line.
  const prevPhase = new Map(prev.map((p) => [p.id, p.status]));
  for (const p of next) {
    const b = prevPhase.get(p.id);
    if (b && b !== p.status && p.status === 'completed') {
      out.push({ ts: now, kind: 'wave', text: `Phase “${p.name}” completed` });
    }
  }
  return out;
}

/** A persisted kanban board (one AutoPhase graph JSON per board on disk). */
export interface AutoPhaseBoardSummary {
  id: string;
  title: string;
  updatedAt: number;
  status: string;
}

interface AutoPhaseState {
  phases: PhaseItem[];
  activePhaseId: string | null;
  overallPercent: number;
  autonomous: boolean;
  title: string | null;
  status: AutoPhaseStatus;
  lastEvent: string | null;
  lastError: string | null;
  /** All persisted boards for this project (from autophase.list). */
  graphs: AutoPhaseBoardSummary[];
  /** Live activity feed (newest-first), derived client-side from state diffs. */
  feed: SddBoardFeedEntry[];
  progress: {
    totalPhases: number;
    completed: number;
    failed: number;
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
  } | null;

  setState: (s: {
    phases?: PhaseItem[] | undefined;
    activePhaseId?: string | null | undefined;
    overallPercent?: number | undefined;
    autonomous?: boolean | undefined;
    title?: string | null | undefined;
    status?: AutoPhaseStatus | undefined;
    lastEvent?: string | null | undefined;
    lastError?: string | null | undefined;
    graphs?: AutoPhaseBoardSummary[] | undefined;
    progress?: AutoPhaseState['progress'] | undefined;
  }) => void;
  clear: () => void;
}

export const useAutoPhaseStore = create<AutoPhaseState>()((set) => ({
  phases: [],
  activePhaseId: null,
  overallPercent: 0,
  autonomous: false,
  title: null,
  status: 'idle',
  lastEvent: null,
  lastError: null,
  graphs: [],
  feed: [],
  progress: null,

  setState: (patch) =>
    set((prev) => {
      // Accumulate the activity feed only when a fresh phase array arrives.
      let feed = prev.feed;
      if (patch.phases) {
        const events = deriveFeed(prev.phases, patch.phases, Date.now());
        if (events.length) feed = [...events.reverse(), ...prev.feed].slice(0, FEED_CAP);
      }
      return {
        phases: patch.phases ?? prev.phases,
        activePhaseId: patch.activePhaseId !== undefined ? patch.activePhaseId : prev.activePhaseId,
        overallPercent: patch.overallPercent ?? prev.overallPercent,
        autonomous: patch.autonomous ?? prev.autonomous,
        title: patch.title !== undefined ? patch.title : prev.title,
        status: patch.status ?? prev.status,
        lastEvent: patch.lastEvent !== undefined ? patch.lastEvent : prev.lastEvent,
        lastError: patch.lastError !== undefined ? patch.lastError : prev.lastError,
        graphs: patch.graphs ?? prev.graphs,
        feed,
        progress: patch.progress !== undefined ? patch.progress : prev.progress,
      };
    }),
  clear: () =>
    set({
      phases: [],
      activePhaseId: null,
      overallPercent: 0,
      autonomous: false,
      title: null,
      status: 'idle',
      lastEvent: null,
      lastError: null,
      graphs: [],
      feed: [],
      progress: null,
    }),
}));
