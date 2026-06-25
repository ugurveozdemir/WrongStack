/**
 * AutoPhaseSidePanel — a right-docked live panel for an active AutoPhase run.
 *
 * Replaces the old top-of-chat WorkspaceDock expansion that grew unbounded and
 * pushed the chat transcript off-screen with no scroll. This panel participates
 * in the app's flex row (it shrinks the chat horizontally, never vertically),
 * has a fixed width, and scrolls internally. It is a compact peek — the full
 * dashboard lives in the 'autophase' main view ("Full view").
 */

import { Maximize2, Pause, Play, Rocket, Square, X, Zap } from 'lucide-react';
import { useMemo } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { agentInitials, AP_PHASE_STATUS, SDD_AGENT_COLORS } from '@/lib/sdd-theme';
import { cn } from '@/lib/utils';
import { useAutoPhaseStore, useUIStore } from '@/stores';
import { ProgressRing } from './ProgressRing';
import { Button } from './ui/button';

export function AutoPhaseSidePanel(): React.ReactElement | null {
  const open = useUIStore((s) => s.autoPhasePanelOpen);
  const setOpen = useUIStore((s) => s.setAutoPhasePanelOpen);
  const setCurrentView = useUIStore((s) => s.setCurrentView);
  const currentView = useUIStore((s) => s.currentView);

  const phases = useAutoPhaseStore((s) => s.phases);
  const overallPercent = useAutoPhaseStore((s) => s.overallPercent);
  const title = useAutoPhaseStore((s) => s.title);
  const status = useAutoPhaseStore((s) => s.status);
  const autonomous = useAutoPhaseStore((s) => s.autonomous);

  const {
    pauseAutoPhase,
    resumeAutoPhase,
    stopAutoPhase,
    toggleAutoPhaseAutonomous,
    selectAutoPhase,
  } = useWebSocket();

  // Live workers across every running phase (in_progress tasks' assignees).
  const workers = useMemo(() => {
    const set = new Set<string>();
    for (const p of phases) {
      for (const t of p.tasks ?? []) {
        if (t.status === 'in_progress' && t.assignee) set.add(t.assignee);
      }
      for (const a of p.assignedAgents) set.add(a);
    }
    return [...set];
  }, [phases]);

  const counts = useMemo(() => {
    let running = 0;
    let done = 0;
    let failed = 0;
    let total = 0;
    for (const p of phases) {
      for (const t of p.tasks ?? []) {
        total++;
        if (t.status === 'in_progress') running++;
        else if (t.status === 'completed') done++;
        else if (t.status === 'failed') failed++;
      }
    }
    return { running, done, failed, total };
  }, [phases]);

  // Nothing to show without a run — keep the panel out of the flex row entirely.
  // Also suppress it on the full AutoPhase view (the board already shows all of
  // this, so the dock would be a redundant duplicate) and during setup.
  if (!open || phases.length === 0 || currentView === 'autophase' || currentView === 'setup') {
    return null;
  }

  const active = status === 'running' || status === 'paused';

  return (
    <aside className="flex w-[340px] shrink-0 flex-col border-l border-border bg-card animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5 shrink-0">
        <div className="flex min-w-0 items-center gap-2">
          <Rocket className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate text-sm font-semibold">{title || 'AutoPhase'}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="Open full AutoPhase view"
            onClick={() => setCurrentView('autophase')}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="Close panel"
            onClick={() => setOpen(false)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Stats + controls */}
      <div className="flex items-center gap-3 border-b border-border px-3 py-2.5 shrink-0">
        <ProgressRing pct={overallPercent} size={52} id="ap-side" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-300">
              {counts.done}/{counts.total}
            </span>
            <span className="text-muted-foreground">done</span>
            {counts.running > 0 && (
              <span className="font-semibold tabular-nums text-amber-600 dark:text-amber-300">
                {counts.running} running
              </span>
            )}
            {counts.failed > 0 && (
              <span className="font-semibold tabular-nums text-red-600 dark:text-red-300">
                {counts.failed} failed
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {active &&
              (status === 'paused' ? (
                <button
                  type="button"
                  onClick={resumeAutoPhase}
                  className="inline-flex items-center gap-1 rounded bg-sky-500/15 px-2 py-0.5 text-[11px] font-medium text-sky-600 dark:text-sky-300 hover:bg-sky-500/25"
                >
                  <Play className="h-3 w-3" /> Resume
                </button>
              ) : (
                <button
                  type="button"
                  onClick={pauseAutoPhase}
                  className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-300 hover:bg-amber-500/25"
                >
                  <Pause className="h-3 w-3" /> Pause
                </button>
              ))}
            {active && (
              <button
                type="button"
                onClick={stopAutoPhase}
                className="inline-flex items-center gap-1 rounded bg-red-500/15 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:text-red-300 hover:bg-red-500/25"
              >
                <Square className="h-3 w-3" /> Stop
              </button>
            )}
            <button
              type="button"
              onClick={() => toggleAutoPhaseAutonomous(!autonomous)}
              title="Toggle autonomous mode"
              className={cn(
                'inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium',
                autonomous
                  ? 'bg-primary/15 text-primary'
                  : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
            >
              <Zap className="h-3 w-3" /> {autonomous ? 'Auto' : 'Manual'}
            </button>
          </div>
        </div>
      </div>

      {/* Live workers */}
      {workers.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-3 py-2 shrink-0">
          {workers.map((w, i) => (
            <span
              key={w}
              title={w}
              className="flex items-center gap-1 rounded-full bg-muted py-0.5 pl-0.5 pr-2"
            >
              <span
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white',
                  SDD_AGENT_COLORS[i % SDD_AGENT_COLORS.length],
                )}
              >
                {agentInitials(w)}
              </span>
              <span className="max-w-[88px] truncate text-[11px] text-foreground">{w}</span>
            </span>
          ))}
        </div>
      )}

      {/* Phase list — the only scrolling region */}
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2.5">
        {phases.map((phase) => {
          const st = AP_PHASE_STATUS[phase.status];
          return (
            <button
              key={phase.id}
              type="button"
              onClick={() => selectAutoPhase(phase.id)}
              className={cn(
                'w-full rounded-lg border p-2.5 text-left transition-colors hover:bg-accent/40',
                st.ring,
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-medium text-foreground">{phase.name}</span>
                <span className={cn('shrink-0 text-[10px] font-medium capitalize', st.text)}>
                  {phase.status}
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>
                  {phase.completedTasks}/{phase.taskCount} tasks
                </span>
                <span>{phase.progressPercent}%</span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full rounded-full transition-all', st.dot)}
                  style={{ width: `${phase.progressPercent}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
