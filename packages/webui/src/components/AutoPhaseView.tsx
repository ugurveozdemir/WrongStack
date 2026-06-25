import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAutoPhaseStore, useWorktreeStore } from '@/stores';
import { phasesToFlow } from '@/lib/autophase-flow';
import { agentInitials, apPhaseStatusStyle, SDD_AGENT_COLORS } from '@/lib/sdd-theme';
import { cn } from '@/lib/utils';
import { BoardView } from './BoardView';
import { EngineGuide } from './EngineGuide';
import { PhaseFocusView } from './PhaseFocusView';
import { ProgressRing } from './ProgressRing';
import { SddActivityFeed } from './SddActivityFeed';
import { SddFlowGraph } from './SddFlowGraph';
import { WorktreeGraph } from './WorktreeGraph';
import { WorktreeLanes } from './WorktreeLanes';
import { HelpCircle, Layers, Play, Rocket, X, Zap } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from './ui/dialog';

type ViewMode = 'graph' | 'kanban';

/**
 * AutoPhaseView — the full-screen AutoPhase show, aligned to the SDD board's
 * visual language: a sheen header with a progress ring + live stats + worker
 * roster, an animated React Flow DAG (phases as columns, tasks as nodes) with a
 * Kanban fallback, a live activity feed side panel, and a per-phase drill-down.
 * Start screen (no phases) explains AutoPhase vs SDD before you commit.
 */
export function AutoPhaseView({ onClose }: { onClose: () => void }): React.ReactElement {
  const { client } = useWebSocket();
  const { pauseAutoPhase, resumeAutoPhase, stopAutoPhase } = useWebSocket();
  const phases = useAutoPhaseStore((s) => s.phases);
  const overallPercent = useAutoPhaseStore((s) => s.overallPercent);
  const autonomous = useAutoPhaseStore((s) => s.autonomous);
  const title = useAutoPhaseStore((s) => s.title);
  const status = useAutoPhaseStore((s) => s.status);
  const lastError = useAutoPhaseStore((s) => s.lastError);
  const graphs = useAutoPhaseStore((s) => s.graphs);
  const feed = useAutoPhaseStore((s) => s.feed);

  const worktrees = useWorktreeStore((s) => s.worktrees);
  const baseBranch = useWorktreeStore((s) => s.baseBranch);

  const [goal, setGoal] = useState('');
  const [starting, setStarting] = useState(false);
  const [showGraph, setShowGraph] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('graph');
  const [focusIdx, setFocusIdx] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const hasPhases = phases.length > 0;
  const active = status === 'running' || status === 'paused';

  // Pull the list of persisted boards for this project on mount.
  useEffect(() => {
    client?.send?.({ type: 'autophase.list' });
  }, [client]);

  // Tick the elapsed/relative clocks while a run is active.
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    setNow(Date.now());
    return () => clearInterval(id);
  }, [active]);

  const flow = useMemo(() => phasesToFlow(phases), [phases]);

  // taskId → phase/column index, so clicking a graph node drills into its phase.
  const taskPhaseIndex = useMemo(() => {
    const m = new Map<string, number>();
    const byShort = new Map(flow.tasks.map((t) => [t.shortId, t.id]));
    flow.columns.forEach((c, i) => {
      for (const sid of c.taskIds) {
        const id = byShort.get(sid);
        if (id) m.set(id, i);
      }
    });
    return m;
  }, [flow]);

  const counts = useMemo(() => {
    let running = 0;
    let done = 0;
    let failed = 0;
    let total = 0;
    for (const p of phases)
      for (const t of p.tasks ?? []) {
        total++;
        if (t.status === 'in_progress') running++;
        else if (t.status === 'completed') done++;
        else if (t.status === 'failed') failed++;
      }
    return { running, done, failed, total };
  }, [phases]);

  const roster = useMemo(() => {
    const set = new Set<string>();
    for (const p of phases) for (const t of p.tasks ?? []) if (t.status === 'in_progress' && t.assignee) set.add(t.assignee);
    return [...set];
  }, [phases]);

  const handleStart = useCallback(async () => {
    const g = goal.trim();
    if (!g || starting) return;
    setStarting(true);
    await new Promise((r) => setTimeout(r, 100));
    client?.send?.({ type: 'autophase.start', payload: { title: g, autonomous: true } });
    setStarting(false);
  }, [goal, starting, client]);

  const handleToggleAutonomous = useCallback(() => {
    client?.send?.({ type: 'autophase.toggleAutonomous', payload: {} });
  }, [client]);

  const handleSelectBoard = useCallback(
    (graphId: string) => {
      if (graphId) client?.send?.({ type: 'autophase.load', payload: { graphId } });
    },
    [client],
  );

  // Keep the focused-phase index valid as the phase list changes.
  const focusValid = focusIdx !== null && focusIdx >= 0 && focusIdx < flow.columns.length;
  const focusColumn = focusValid ? flow.columns[focusIdx] : null;
  const focusTasks = useMemo(() => {
    if (!focusColumn) return [];
    const ids = new Set(focusColumn.taskIds);
    return flow.tasks.filter((t) => ids.has(t.shortId));
  }, [focusColumn, flow.tasks]);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <header className="sdd-sheen flex items-center justify-between border-b border-border px-4 pb-2 pt-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <Rocket className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-lg font-semibold">{hasPhases ? title || 'AutoPhase' : 'AutoPhase'}</h1>
            {hasPhases && (
              <p className="text-xs text-muted-foreground">
                {phases.length} phase{phases.length === 1 ? '' : 's'} · {overallPercent}% complete
              </p>
            )}
          </div>
          {hasPhases && (
            <span
              className={cn(
                'rounded border px-2 py-0.5 text-[11px] font-medium capitalize',
                status === 'failed'
                  ? 'border-destructive/40 bg-destructive/10 text-destructive'
                  : status === 'paused' || status === 'stopped'
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                    : status === 'completed'
                      ? 'border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-300'
                      : 'border-primary/30 bg-primary/10 text-primary',
              )}
              title={lastError ?? undefined}
            >
              {status}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Graph ↔ Kanban toggle */}
          {hasPhases && (
            <div className="flex items-center rounded-md border border-border bg-muted p-0.5 text-[11px]">
              {(['graph', 'kanban'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setViewMode(m);
                    setFocusIdx(null);
                  }}
                  className={cn(
                    'rounded px-2 py-0.5 capitalize transition',
                    viewMode === m
                      ? 'bg-primary/20 text-primary'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
          {/* Board selector — every AutoPhase run is a persisted board on disk. */}
          {graphs.length > 0 && (
            <select
              value={hasPhases ? (graphs.find((g) => g.title === title)?.id ?? '') : ''}
              onChange={(e) => handleSelectBoard(e.target.value)}
              title="Switch board"
              className="rounded border border-border bg-card px-2 py-1 text-xs text-foreground"
            >
              <option value="" disabled>
                {graphs.length} board{graphs.length === 1 ? '' : 's'}…
              </option>
              {graphs.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title} · {g.status}
                </option>
              ))}
            </select>
          )}
          {hasPhases && (
            <button
              type="button"
              onClick={handleToggleAutonomous}
              title="Toggle autonomous mode"
              className={cn(
                'inline-flex items-center gap-1 rounded border px-2 py-1 text-xs transition-colors',
                autonomous
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              <Zap className="h-3.5 w-3.5" /> {autonomous ? 'Autonomous' : 'Manual'}
            </button>
          )}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" title="AutoPhase vs SDD">
                <HelpCircle className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogTitle className="sr-only">AutoPhase vs SDD Project</DialogTitle>
              <EngineGuide className="border-0" />
            </DialogContent>
          </Dialog>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {!hasPhases ? (
        /* ── Start screen ── */
        <div className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-2xl space-y-6">
            <div className="space-y-2 text-center">
              <Rocket className="mx-auto h-10 w-10 text-primary/60" />
              <h2 className="text-xl font-semibold">Start a Phase Plan</h2>
              <p className="text-sm text-muted-foreground">
                Describe what you want to build. WrongStack will plan phases and tasks, then execute them —
                watch and steer the run on the board.
              </p>
            </div>

            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. Build a REST API for user management with Express and SQLite..."
              rows={5}
              className="w-full resize-none rounded-lg border border-border bg-card px-4 py-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleStart();
                }
              }}
            />

            <div className="flex items-center gap-3">
              <Button onClick={handleStart} disabled={!goal.trim() || starting} className="flex-1 gap-2">
                <Play className="h-4 w-4" />
                {starting ? 'Starting…' : 'Start AutoPhase'}
              </Button>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              Ctrl+Enter to start · phases run in isolated worktrees with agents picking up tasks
            </p>

            <EngineGuide />
          </div>
        </div>
      ) : focusColumn ? (
        /* ── Per-phase drill-down ── */
        <PhaseFocusView
          label={focusColumn.label}
          statusLabel={phases[focusIdx as number]?.status}
          statusClass={apPhaseStatusStyle(phases[focusIdx as number]?.status ?? 'pending').ring}
          tasks={focusTasks}
          index={focusIdx as number}
          total={flow.columns.length}
          now={now}
          prevLabel={focusIdx ? flow.columns[(focusIdx as number) - 1]?.label : undefined}
          nextLabel={flow.columns[(focusIdx as number) + 1]?.label}
          onPrev={focusIdx ? () => setFocusIdx((focusIdx as number) - 1) : undefined}
          onNext={
            (focusIdx as number) < flow.columns.length - 1
              ? () => setFocusIdx((focusIdx as number) + 1)
              : undefined
          }
          onBack={() => setFocusIdx(null)}
        />
      ) : (
        /* ── Board: graph / kanban + side feed ── */
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Stats + roster + phase chips */}
          <div className="flex items-center gap-5 border-b border-border px-4 py-2.5 shrink-0">
            <ProgressRing pct={overallPercent} id="ap-board" />
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-3 text-xs">
                <Stat label="done" value={`${counts.done}/${counts.total}`} color="text-emerald-600 dark:text-emerald-300" />
                {counts.running > 0 && <Stat label="running" value={counts.running} color="text-amber-600 dark:text-amber-300" />}
                {counts.failed > 0 && <Stat label="failed" value={counts.failed} color="text-red-600 dark:text-red-300" />}
                <Stat label="phases" value={phases.length} color="text-violet-600 dark:text-violet-300" />
              </div>
              <div className="flex min-h-[24px] flex-wrap items-center gap-1.5">
                {roster.length === 0 ? (
                  <span className="text-[11px] text-muted-foreground">no active workers</span>
                ) : (
                  roster.map((a, i) => (
                    <span key={a} title={a} className="flex items-center gap-1 rounded-full bg-muted py-0.5 pl-0.5 pr-2">
                      <span
                        className={cn(
                          'sdd-agent-live flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white',
                          SDD_AGENT_COLORS[i % SDD_AGENT_COLORS.length],
                        )}
                      >
                        {agentInitials(a)}
                      </span>
                      <span className="max-w-[90px] truncate text-[11px] text-foreground">{a}</span>
                    </span>
                  ))
                )}
              </div>
            </div>
            {/* Phase chips — click to drill into one phase. */}
            <div className="ml-auto flex max-w-[40%] flex-wrap items-center justify-end gap-1">
              {phases.map((p, i) => {
                const st = apPhaseStatusStyle(p.status);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setFocusIdx(i)}
                    title={`Focus ${p.name}`}
                    className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium', st.ring, st.text)}
                  >
                    <Layers className="h-2.5 w-2.5" />
                    <span className="max-w-[110px] truncate">{p.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex min-h-0 flex-1">
            <div className="relative min-w-0 flex-1">
              {viewMode === 'graph' ? (
                <>
                  <SddFlowGraph
                    tasks={flow.tasks}
                    columns={flow.columns}
                    onTaskClick={(id) => {
                      const i = taskPhaseIndex.get(id);
                      if (i !== undefined) setFocusIdx(i);
                    }}
                  />
                  <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/40 px-2 py-0.5 text-[10px] text-muted-foreground backdrop-blur">
                    click a task or a phase chip to focus its phase
                  </div>
                </>
              ) : (
                <BoardView />
              )}
            </div>
            <aside className="hidden w-80 shrink-0 border-l border-border bg-card lg:block">
              <SddActivityFeed feed={feed} now={now} />
            </aside>
          </div>

          {/* Run controls strip */}
          {active && (
            <div className="flex items-center gap-2 border-t border-border px-4 py-1.5 shrink-0">
              {status === 'paused' ? (
                <button
                  type="button"
                  onClick={resumeAutoPhase}
                  className="inline-flex items-center gap-1 rounded bg-sky-500/15 px-2.5 py-1 text-xs font-medium text-sky-600 dark:text-sky-300 hover:bg-sky-500/25"
                >
                  Resume
                </button>
              ) : (
                <button
                  type="button"
                  onClick={pauseAutoPhase}
                  className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-300 hover:bg-amber-500/25"
                >
                  Pause
                </button>
              )}
              <button
                type="button"
                onClick={stopAutoPhase}
                className="inline-flex items-center gap-1 rounded bg-red-500/15 px-2.5 py-1 text-xs font-medium text-red-600 dark:text-red-300 hover:bg-red-500/25"
              >
                Stop
              </button>
            </div>
          )}
        </div>
      )}

      {/* Worktree visualization */}
      {worktrees.length > 0 && (
        <div className="border-t bg-card/50 shrink-0">
          <div className="flex items-center justify-end gap-2 px-4 pt-2 text-xs">
            <button
              type="button"
              onClick={() => setShowGraph(false)}
              className={cn(
                'rounded border px-2 py-0.5 transition-colors',
                !showGraph ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              Lanes
            </button>
            <button
              type="button"
              onClick={() => setShowGraph(true)}
              className={cn(
                'rounded border px-2 py-0.5 transition-colors',
                showGraph ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              Graph
            </button>
          </div>
          <div className="px-4 pb-3">
            {showGraph ? (
              <WorktreeGraph worktrees={worktrees} baseBranch={baseBranch} />
            ) : (
              <WorktreeLanes worktrees={worktrees} baseBranch={baseBranch} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <span className="flex items-baseline gap-1">
      <span className={cn('font-semibold tabular-nums', color)}>{value}</span>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
    </span>
  );
}
