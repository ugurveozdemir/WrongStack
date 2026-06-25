import { Activity, AlertTriangle, Cpu, Eraser, HelpCircle, Layers, Pause, Play, RotateCcw, Square, Undo2, X, Zap } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useProviderModels } from '@/hooks/useProviderModels';
import { useWebSocket } from '@/hooks/useWebSocket';
import { agentInitials, fmtDuration, SDD_AGENT_COLORS, SDD_RUN_STATUS } from '@/lib/sdd-theme';
import { cn } from '@/lib/utils';
import { type BoardTaskItem, useSddBoardStore } from '@/stores';
import { EngineGuide } from './EngineGuide';
import { PhaseFocusView } from './PhaseFocusView';
import { ProgressRing } from './ProgressRing';
import { SddActivityFeed } from './SddActivityFeed';
import { type FlowTask, SddFlowGraph } from './SddFlowGraph';
import { SddKanbanView } from './SddKanbanView';
import { SddTaskDrawer } from './SddTaskDrawer';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from './ui/dialog';

/**
 * SddBoardView — the live multi-agent execution show. Renders the run as an
 * animated React Flow DAG (SddFlowGraph) plus a stats header with a progress
 * ring, a live agent roster, and run controls (pause / resume / stop / retry).
 */
export function SddBoardView({ onClose }: { onClose: () => void }): React.ReactElement {
  const { client } = useWebSocket();
  const snapshot = useSddBoardStore((s) => s.snapshot);
  const [now, setNow] = useState(() => Date.now());
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'graph' | 'kanban'>('graph');
  const [focusIdx, setFocusIdx] = useState<number | null>(null);

  useEffect(() => {
    client?.send?.({ type: 'sdd.board.get' });
  }, [client]);

  // Tick for the elapsed clock while a run is active.
  const active = snapshot && (snapshot.status === 'running' || snapshot.status === 'paused');
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    setNow(Date.now());
    return () => clearInterval(id);
  }, [active]);

  const send = useCallback(
    (msg: Parameters<NonNullable<typeof client>['send']>[0]) => client?.send?.(msg),
    [client],
  );

  const flowTasks = useMemo<FlowTask[]>(
    () =>
      (snapshot?.tasks ?? []).map((t: BoardTaskItem) => ({
        id: t.id,
        shortId: t.shortId,
        title: t.title,
        displayStatus: t.displayStatus,
        priority: t.priority,
        deps: t.deps,
        agentName: t.agentName,
        worktreeBranch: t.worktreeBranch,
      })),
    [snapshot?.tasks],
  );

  // Live workers — distinct agents currently on an in_progress task.
  const roster = useMemo(() => {
    const m = new Map<string, { name: string; task: string }>();
    for (const t of snapshot?.tasks ?? []) {
      if (t.displayStatus === 'in_progress' && t.agentName) {
        m.set(t.agentName, { name: t.agentName, task: t.title });
      }
    }
    return [...m.values()];
  }, [snapshot?.tasks]);

  // Click a task → open its detail drawer (not an instant retry).
  const onTaskClick = useCallback((taskId: string) => setSelectedTaskId(taskId), []);
  const onRetry = useCallback(
    (taskId: string) => send({ type: 'sdd.board.retry', payload: { taskId } }),
    [send],
  );
  const onRetryAllFailed = useCallback(
    () => send({ type: 'sdd.board.retry_all_failed', payload: {} }),
    [send],
  );
  // Lifecycle (effective once the run is stopped): sweep worktrees / revert commits.
  const onCleanWorktrees = useCallback(
    () => send({ type: 'sdd.board.cleanup_worktrees', payload: {} }),
    [send],
  );
  const onRollback = useCallback(
    () => send({ type: 'sdd.board.rollback', payload: {} }),
    [send],
  );
  const onReassign = useCallback(
    (taskId: string, agentName: string) => {
      const name = agentName.trim();
      if (name) send({ type: 'sdd.board.reassign', payload: { taskId, agentName: name } });
    },
    [send],
  );
  const onSetModel = useCallback(
    (taskId: string, model: string | undefined, provider?: string | undefined) =>
      send({ type: 'sdd.board.set_task_model', payload: { taskId, model, provider } }),
    [send],
  );
  const onSetVerification = useCallback(
    (taskId: string, verificationCommand: string | undefined) =>
      send({ type: 'sdd.board.set_task_verification', payload: { taskId, verificationCommand } }),
    [send],
  );
  const onCancel = useCallback(
    (taskId: string) => send({ type: 'sdd.board.cancel_task', payload: { taskId } }),
    [send],
  );
  const onDelete = useCallback(
    (taskId: string) => {
      send({ type: 'sdd.board.delete_task', payload: { taskId } });
      setSelectedTaskId(null); // the task is gone — drop the drawer selection
    },
    [send],
  );
  const onSplit = useCallback(
    (taskId: string, subtasks: Array<{ title: string; description: string }>) => {
      send({ type: 'sdd.board.split_task', payload: { taskId, subtasks } });
      setSelectedTaskId(null); // parent becomes a container — close the drawer
    },
    [send],
  );

  // Model catalogue for the per-task picker — fetched only while the drawer is open.
  const modelCandidates = useProviderModels(selectedTaskId !== null);

  const selectedTask = useMemo(
    () => snapshot?.tasks.find((t) => t.id === selectedTaskId) ?? null,
    [snapshot?.tasks, selectedTaskId],
  );

  const p = snapshot?.progress;
  const chains = snapshot?.diagnostics?.deadlockChains ?? [];

  // Per-phase drill-down: a topological column (Start / Phase 1 / …) shown on
  // its own screen. Data comes entirely from the snapshot — no backend call.
  const columns = snapshot?.columns ?? [];
  const focusColumn = focusIdx !== null && focusIdx >= 0 && focusIdx < columns.length ? columns[focusIdx] : null;
  const focusTasks = useMemo(() => {
    if (!focusColumn) return [];
    const ids = new Set(focusColumn.taskIds);
    return flowTasks.filter((t) => ids.has(t.shortId));
  }, [focusColumn, flowTasks]);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* ── Header ── */}
      <header className="sdd-sheen shrink-0 border-b border-border px-4 pb-3 pt-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-orange-400" />
            <h1 className="text-lg font-semibold text-foreground">
              {snapshot?.title ?? 'Live SDD Board'}
            </h1>
            {snapshot && (
              <span
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize',
                  SDD_RUN_STATUS[snapshot.status] ?? SDD_RUN_STATUS.idle,
                )}
              >
                {snapshot.status}
              </span>
            )}
            {snapshot?.defaultModel && (
              <span
                className="flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                title="Run-level default worker model (per-task overrides take precedence)"
              >
                <Cpu className="h-3 w-3 text-violet-400" />
                {snapshot.defaultModel}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Graph ↔ Kanban view toggle */}
            {snapshot && (
              <div className="flex items-center rounded-md border border-border bg-muted p-0.5 text-[11px]">
                {(['graph', 'kanban'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setViewMode(m)}
                    className={cn(
                      'rounded px-2 py-0.5 capitalize transition',
                      viewMode === m
                        ? 'bg-violet-500/25 text-violet-700 dark:text-violet-200'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {m === 'graph' ? 'Graph' : 'Kanban'}
                  </button>
                ))}
              </div>
            )}
            {active && (p?.failed ?? 0) > 0 && (
              <button
                type="button"
                onClick={onRetryAllFailed}
                title="Requeue every failed task to pending"
                className="inline-flex items-center gap-1 rounded-md bg-orange-500/15 px-2.5 py-1 text-xs font-medium text-orange-600 dark:text-orange-300 hover:bg-orange-500/25"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Retry failed ({p?.failed})
              </button>
            )}
            {active && (
              <>
                {snapshot?.status === 'paused' ? (
                  <button
                    type="button"
                    onClick={() => send({ type: 'sdd.board.resume', payload: {} })}
                    className="inline-flex items-center gap-1 rounded-md bg-sky-500/15 px-2.5 py-1 text-xs font-medium text-sky-600 dark:text-sky-300 hover:bg-sky-500/25"
                  >
                    <Play className="h-3.5 w-3.5" /> Resume
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => send({ type: 'sdd.board.pause', payload: {} })}
                    className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-300 hover:bg-amber-500/25"
                  >
                    <Pause className="h-3.5 w-3.5" /> Pause
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => send({ type: 'sdd.board.stop', payload: {} })}
                  className="inline-flex items-center gap-1 rounded-md bg-red-500/15 px-2.5 py-1 text-xs font-medium text-red-600 dark:text-red-300 hover:bg-red-500/25"
                >
                  <Square className="h-3.5 w-3.5" /> Stop
                </button>
              </>
            )}
            {/* Lifecycle controls — shown once the run is stopped/finished (they
                are refused while a run is live). Clean removes the run's git
                worktrees; Rollback reverts its merged commits (history-preserving). */}
            {snapshot && !active && (
              <>
                <button
                  type="button"
                  onClick={onCleanWorktrees}
                  title="Remove the run's git worktrees + wstack/ap branches"
                  className="inline-flex items-center gap-1 rounded-md bg-slate-500/15 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-500/25"
                >
                  <Eraser className="h-3.5 w-3.5" /> Clean worktrees
                </button>
                {(snapshot.mergedCommits?.length ?? 0) > 0 && (
                  <button
                    type="button"
                    onClick={onRollback}
                    title={`Revert ${snapshot.mergedCommits?.length} merged commit(s) on ${snapshot.baseBranch ?? 'the base branch'}`}
                    className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-300 hover:bg-amber-500/25"
                  >
                    <Undo2 className="h-3.5 w-3.5" /> Rollback ({snapshot.mergedCommits?.length})
                  </button>
                )}
              </>
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
        </div>

        {/* stats + roster */}
        {snapshot && p && (
          <div className="mt-2.5 flex items-center gap-5">
            <ProgressRing pct={p.percentComplete} id="sdd-board" />
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3 text-xs">
                <Stat
                  label="done"
                  value={`${p.completed}/${p.total}`}
                  color="text-emerald-600 dark:text-emerald-300"
                />
                {p.inProgress > 0 && (
                  <Stat
                    label="running"
                    value={p.inProgress}
                    color="text-amber-600 dark:text-amber-300"
                  />
                )}
                {p.failed > 0 && (
                  <Stat label="failed" value={p.failed} color="text-red-600 dark:text-red-300" />
                )}
                <Stat
                  label="wave"
                  value={snapshot.wave + 1}
                  color="text-violet-600 dark:text-violet-300"
                />
                {active && snapshot.startedAt > 0 && (
                  <Stat
                    label="elapsed"
                    value={fmtDuration(now - snapshot.startedAt)}
                    color="text-foreground"
                  />
                )}
              </div>
              {/* Live agent roster */}
              <div className="flex min-h-[24px] items-center gap-1.5">
                {roster.length === 0 ? (
                  <span className="text-[11px] text-muted-foreground">no active workers</span>
                ) : (
                  roster.map((a, i) => (
                    <span
                      key={a.name}
                      title={`${a.name} → ${a.task}`}
                      className="flex items-center gap-1 rounded-full bg-muted py-0.5 pl-0.5 pr-2"
                    >
                      <span
                        className={cn(
                          'sdd-agent-live flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white',
                          SDD_AGENT_COLORS[i % SDD_AGENT_COLORS.length],
                        )}
                      >
                        {agentInitials(a.name)}
                      </span>
                      <span className="max-w-[90px] truncate text-[11px] text-foreground">
                        {a.name}
                      </span>
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* deadlock banner */}
      {chains.length > 0 && (
        <div className="flex items-start gap-2 border-b border-rose-500/30 bg-rose-500/5 px-4 py-2 text-xs text-rose-600 dark:text-rose-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-semibold">Deadlock — tasks blocked by failed work:</div>
            {chains.map((c) => (
              <div key={c.blocked} className="font-mono">
                {c.blocked} ← {c.blockedBy.join(', ')}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Phase chips — click a topological column to drill into it. */}
      {snapshot && columns.length > 0 && !focusColumn && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-1.5 shrink-0">
          <span className="mr-1 text-[10px] uppercase tracking-wide text-muted-foreground">phases</span>
          {columns.map((c, i) => (
            <button
              key={`${c.label}-${i}`}
              type="button"
              onClick={() => setFocusIdx(i)}
              title={`Focus ${c.label}`}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:border-violet-500/40 hover:text-foreground"
            >
              <Layers className="h-2.5 w-2.5 text-violet-400" />
              <span className="max-w-[120px] truncate">{c.label}</span>
              <span className="tabular-nums opacity-70">{c.taskIds.length}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Dashboard ── */}
      {focusColumn ? (
        /* Per-phase drill-down (task drawer overlays when a task is picked). */
        <div className="relative flex min-h-0 flex-1">
          <PhaseFocusView
            label={focusColumn.label}
            tasks={focusTasks}
            index={focusIdx as number}
            total={columns.length}
            feed={snapshot?.feed ?? []}
            now={now}
            prevLabel={focusIdx ? columns[(focusIdx as number) - 1]?.label : undefined}
            nextLabel={columns[(focusIdx as number) + 1]?.label}
            onPrev={focusIdx ? () => setFocusIdx((focusIdx as number) - 1) : undefined}
            onNext={(focusIdx as number) < columns.length - 1 ? () => setFocusIdx((focusIdx as number) + 1) : undefined}
            onBack={() => setFocusIdx(null)}
            onTaskClick={onTaskClick}
          />
          {selectedTask && snapshot && (
            <aside className="absolute right-0 top-0 z-10 h-full w-80 border-l border-border bg-card shadow-2xl">
              <SddTaskDrawer
                key={selectedTask.id}
                task={selectedTask}
                allTasks={snapshot.tasks}
                feed={snapshot.feed ?? []}
                now={now}
                modelCandidates={modelCandidates}
                defaultModel={snapshot.defaultModel}
                onClose={() => setSelectedTaskId(null)}
                onRetry={onRetry}
                onReassign={onReassign}
                onSetModel={onSetModel}
                onSetVerification={onSetVerification}
                onCancel={onCancel}
                onDelete={onDelete}
                onSplit={onSplit}
                onSelectTask={setSelectedTaskId}
              />
            </aside>
          )}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <div className="relative min-w-0 flex-1">
            {!snapshot ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 overflow-y-auto p-6 text-sm text-muted-foreground">
                <div className="flex flex-col items-center gap-3">
                  <Zap className="h-10 w-10 text-violet-500/40" />
                  <p className="text-foreground">No active SDD run.</p>
                  <p className="max-w-sm text-center text-xs text-muted-foreground">
                    Start one from the <span className="text-violet-400">New SDD Project</span> wizard,
                    or via <code className="rounded bg-muted px-1">/sdd execute</code> in the CLI —
                    agents appear here live, each working an isolated worktree.
                  </p>
                </div>
                <EngineGuide className="w-full max-w-2xl" />
              </div>
            ) : viewMode === 'graph' ? (
              <>
                <SddFlowGraph tasks={flowTasks} columns={snapshot.columns} onTaskClick={onTaskClick} />
                <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/40 px-2 py-0.5 text-[10px] text-muted-foreground backdrop-blur">
                  click a task for details · use the phase chips above to focus a phase
                </div>
              </>
            ) : (
              <SddKanbanView tasks={snapshot.tasks} selectedId={selectedTaskId} onTaskClick={onTaskClick} />
            )}
          </div>

          {/* Side panel: task detail when one is selected, else the live activity feed. */}
          {snapshot && (
            <aside className="w-80 shrink-0 border-l border-border bg-card">
              {selectedTask ? (
                <SddTaskDrawer
                  key={selectedTask.id}
                  task={selectedTask}
                  allTasks={snapshot.tasks}
                  feed={snapshot.feed ?? []}
                  now={now}
                  modelCandidates={modelCandidates}
                  defaultModel={snapshot.defaultModel}
                  onClose={() => setSelectedTaskId(null)}
                  onRetry={onRetry}
                  onReassign={onReassign}
                  onSetModel={onSetModel}
                  onSetVerification={onSetVerification}
                  onCancel={onCancel}
                  onDelete={onDelete}
                  onSplit={onSplit}
                  onSelectTask={setSelectedTaskId}
                />
              ) : (
                <SddActivityFeed feed={snapshot.feed ?? []} now={now} />
              )}
            </aside>
          )}
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
