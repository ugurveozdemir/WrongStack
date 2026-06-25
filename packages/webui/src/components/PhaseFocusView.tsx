/**
 * PhaseFocusView — a single phase/column on its own screen.
 *
 * Both boards (SDD topological columns, AutoPhase phases) render their whole
 * DAG at once; this is the drill-down: pick one phase and see only its tasks,
 * its workers, its progress, its dependency edges, and a phase-filtered
 * activity feed. Parametric so the SDD board and the AutoPhase board share it.
 */
import { ArrowLeft, ChevronLeft, ChevronRight, GitBranch, Layers } from 'lucide-react';
import { useMemo } from 'react';
import {
  agentInitials,
  fmtAgo,
  priorityStyle,
  SDD_AGENT_COLORS,
  SDD_FEED_KIND,
  statusStyle,
} from '@/lib/sdd-theme';
import { cn } from '@/lib/utils';
import type { FlowTask } from './SddFlowGraph';
import type { SddBoardFeedEntry } from '@/stores';
import { ProgressRing } from './ProgressRing';

export interface PhaseFocusViewProps {
  /** Phase / column label, e.g. "Phase 2". */
  label: string;
  /** Optional phase-level status badge text (AutoPhase phases have one). */
  statusLabel?: string | undefined;
  statusClass?: string | undefined;
  /** Tasks belonging to this phase. */
  tasks: FlowTask[];
  /** Column position for the "Phase i of n" breadcrumb. */
  index: number;
  total: number;
  /** Full run feed — filtered to this phase's tasks. */
  feed?: SddBoardFeedEntry[] | undefined;
  now: number;
  prevLabel?: string | undefined;
  nextLabel?: string | undefined;
  onPrev?: (() => void) | undefined;
  onNext?: (() => void) | undefined;
  onBack: () => void;
  onTaskClick?: ((taskId: string) => void) | undefined;
}

export function PhaseFocusView({
  label,
  statusLabel,
  statusClass,
  tasks,
  index,
  total,
  feed,
  now,
  prevLabel,
  nextLabel,
  onPrev,
  onNext,
  onBack,
  onTaskClick,
}: PhaseFocusViewProps): React.ReactElement {
  const done = tasks.filter((t) => t.displayStatus === 'completed').length;
  const running = tasks.filter((t) => t.displayStatus === 'in_progress');
  const failed = tasks.filter((t) => t.displayStatus === 'failed').length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  const roster = useMemo(() => {
    const set = new Set<string>();
    for (const t of running) if (t.agentName) set.add(t.agentName);
    return [...set];
  }, [running]);

  // Feed filtered to this phase's tasks (by shortId).
  const phaseFeed = useMemo(() => {
    if (!feed) return [];
    const ids = new Set(tasks.map((t) => t.shortId));
    return feed.filter((e) => e.taskShortId && ids.has(e.taskShortId));
  }, [feed, tasks]);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Breadcrumb + phase navigation */}
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5 shrink-0">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All phases
          </button>
          <Layers className="h-4 w-4 shrink-0 text-violet-400" />
          <h2 className="truncate text-base font-semibold text-foreground">{label}</h2>
          {statusLabel && (
            <span
              className={cn(
                'rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize',
                statusClass,
              )}
            >
              {statusLabel}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            Phase {index + 1} / {total}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!onPrev}
            onClick={onPrev}
            title={prevLabel ? `Previous: ${prevLabel}` : 'No previous phase'}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground enabled:hover:bg-accent/50 enabled:hover:text-foreground disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Prev
          </button>
          <button
            type="button"
            disabled={!onNext}
            onClick={onNext}
            title={nextLabel ? `Next: ${nextLabel}` : 'No next phase'}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground enabled:hover:bg-accent/50 enabled:hover:text-foreground disabled:opacity-40"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* Stats + roster */}
      <div className="flex items-center gap-5 border-b border-border px-4 py-3 shrink-0">
        <ProgressRing pct={pct} id={`focus-${index}`} />
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-3 text-xs">
            <Stat
              label="done"
              value={`${done}/${tasks.length}`}
              color="text-emerald-600 dark:text-emerald-300"
            />
            {running.length > 0 && (
              <Stat
                label="running"
                value={running.length}
                color="text-amber-600 dark:text-amber-300"
              />
            )}
            {failed > 0 && (
              <Stat label="failed" value={failed} color="text-red-600 dark:text-red-300" />
            )}
          </div>
          <div className="flex min-h-[24px] flex-wrap items-center gap-1.5">
            {roster.length === 0 ? (
              <span className="text-[11px] text-muted-foreground">no active workers</span>
            ) : (
              roster.map((a, i) => (
                <span
                  key={a}
                  title={a}
                  className="flex items-center gap-1 rounded-full bg-muted py-0.5 pl-0.5 pr-2"
                >
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
      </div>

      {/* Tasks grid (left) + phase activity (right) */}
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-y-auto p-4">
          {tasks.length === 0 ? (
            <p className="pt-8 text-center text-sm text-muted-foreground">
              No tasks in this phase.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {tasks.map((t) => {
                const st = statusStyle(t.displayStatus);
                const Icon = st.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onTaskClick?.(t.id)}
                    className={cn(
                      'rounded-lg border p-3 text-left transition-colors',
                      st.ring,
                      onTaskClick && 'hover:brightness-110',
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <Icon
                        className={cn(
                          'h-3.5 w-3.5',
                          st.text,
                          t.displayStatus === 'in_progress' && 'animate-spin',
                        )}
                      />
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {t.shortId}
                      </span>
                      <span
                        className={cn(
                          'font-mono text-[10px] font-bold uppercase',
                          priorityStyle(t.priority).text,
                        )}
                      >
                        {t.priority[0]}
                      </span>
                      <span className={cn('ml-auto text-[10px] font-medium', st.text)}>
                        {st.label}
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-3 text-xs leading-snug text-foreground">
                      {t.title}
                    </p>
                    {(t.agentName || t.worktreeBranch || t.deps.length > 0) && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                        {t.agentName && (
                          <span className="flex items-center gap-1">
                            <span
                              className={cn(
                                'flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold text-white',
                                t.displayStatus === 'in_progress' ? 'bg-amber-500' : 'bg-slate-500',
                              )}
                            >
                              {agentInitials(t.agentName)}
                            </span>
                            {t.agentName}
                          </span>
                        )}
                        {t.worktreeBranch && (
                          <span className="flex items-center gap-0.5" title={t.worktreeBranch}>
                            <GitBranch className="h-2.5 w-2.5" />
                            {t.worktreeBranch.replace(/^.*\//, '')}
                          </span>
                        )}
                        {t.deps.length > 0 && (
                          <span className="font-mono">← {t.deps.join(', ')}</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Phase-filtered activity feed */}
        {feed && (
          <aside className="hidden w-72 shrink-0 flex-col border-l border-border bg-card md:flex">
            <div className="border-b border-border px-3 py-2 text-xs font-semibold text-foreground">
              Phase activity
            </div>
            <div className="flex-1 space-y-1 overflow-auto p-2">
              {phaseFeed.length === 0 ? (
                <p className="px-1 pt-4 text-center text-[11px] text-muted-foreground">
                  No activity for this phase yet.
                </p>
              ) : (
                phaseFeed.map((e, i) => {
                  const k = SDD_FEED_KIND[e.kind] ?? SDD_FEED_KIND.started;
                  const Icon = k.icon;
                  return (
                    <div
                      key={`${e.ts}-${i}`}
                      className="flex items-start gap-2 rounded-md px-2 py-1.5 text-[11px] hover:bg-muted"
                    >
                      <Icon className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', k.color)} />
                      <span className="flex-1 leading-snug text-foreground">{e.text}</span>
                      <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground">
                        {fmtAgo(e.ts, now)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        )}
      </div>
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
