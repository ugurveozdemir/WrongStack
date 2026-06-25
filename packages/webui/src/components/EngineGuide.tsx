/**
 * EngineGuide — explains the two autonomous build engines side by side so users
 * know which to reach for. Surfaced on the empty/start states of the AutoPhase
 * view, the SDD wizard, and the SDD live board, and behind the "?" header
 * popovers. Content is grounded in the actual engines (PhaseOrchestrator vs
 * SddParallelRun + SddSupervisor).
 */
import { Brain, GitBranch, Layers, Rocket, Workflow } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Row {
  axis: string;
  autophase: string;
  sdd: string;
}

const ROWS: Row[] = [
  {
    axis: 'Input',
    autophase: 'A free-text goal → one-shot LLM plan',
    sdd: 'Interactive Q&A → an approved spec',
  },
  {
    axis: 'Structure',
    autophase: 'Phases, each holding its own tasks',
    sdd: 'A flat dependency DAG (no phases)',
  },
  {
    axis: 'Execution',
    autophase: 'Phase by phase; tasks within a phase',
    sdd: 'Continuous dependency scheduler, real multi-agent fleet, one git worktree per task',
  },
  {
    axis: 'Verify',
    autophase: 'Per-phase gate (typecheck/lint) + repair agent',
    sdd: 'Per-task gate from acceptance + re-verify after merge',
  },
  { axis: 'Oversight', autophase: 'Repair loop', sdd: 'Supervisor agent (see below)' },
  {
    axis: 'Lifecycle',
    autophase: 'start · pause · resume · stop · save',
    sdd: 'new · approve · execute · clean · rollback · split',
  },
  {
    axis: 'Best for',
    autophase: '“Give it a goal, let it plan & run.”',
    sdd: '“Shape a spec together, then watch a fleet build it.”',
  },
];

export function EngineGuide({ className }: { className?: string }): React.ReactElement {
  return (
    <div className={cn('rounded-xl border border-border bg-card/60 p-4', className)}>
      <div className="mb-3 flex items-center gap-2">
        <Workflow className="h-4 w-4 text-violet-400" />
        <h3 className="text-sm font-semibold text-foreground">AutoPhase vs SDD Project</h3>
      </div>

      {/* Two engine headers */}
      <div className="mb-3 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
            <Rocket className="h-3.5 w-3.5" /> AutoPhase
          </div>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            Autonomous, phase-by-phase build from a single goal. Fastest path from idea to running
            code.
          </p>
        </div>
        <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-orange-600 dark:text-orange-300">
            <Layers className="h-3.5 w-3.5" /> SDD Project
          </div>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            Spec-first, reviewed at each gate, executed by a real multi-agent fleet with per-task
            verification.
          </p>
        </div>
      </div>

      {/* Comparison table */}
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-muted/50 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
              <th className="px-2.5 py-1.5 font-medium">Aspect</th>
              <th className="px-2.5 py-1.5 font-medium text-primary">AutoPhase</th>
              <th className="px-2.5 py-1.5 font-medium text-orange-600 dark:text-orange-300">
                SDD Project
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.axis} className="border-t border-border align-top">
                <td className="px-2.5 py-1.5 font-medium text-foreground">{r.axis}</td>
                <td className="px-2.5 py-1.5 text-muted-foreground">{r.autophase}</td>
                <td className="px-2.5 py-1.5 text-muted-foreground">{r.sdd}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Supervisor callout */}
      <div className="mt-3 flex items-start gap-2 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/5 p-2.5">
        <Brain className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-500 dark:text-fuchsia-400" />
        <div className="text-[11px] leading-snug text-muted-foreground">
          <span className="font-semibold text-foreground">Supervisor agent (SDD only).</span> When a
          task burns through its retries, the supervisor steps in instead of just failing the run.
          It asks the Brain arbiter how to proceed and picks one of:{' '}
          <span className="text-foreground">retry</span> as-is,{' '}
          <span className="text-foreground">reassign</span> to a stronger model,{' '}
          <span className="text-foreground">split</span> the task into smaller sub-tasks, or{' '}
          <span className="text-foreground">fail</span> it. It also recovers deadlocks (re-queuing
          failed blockers) — with an escalation cap so the run can never loop forever. AutoPhase has
          no supervisor; it relies on its per-phase repair loop instead.
        </div>
      </div>

      <p className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
        <GitBranch className="h-3 w-3" /> Both isolate work in git worktrees and merge in dependency
        order.
      </p>
    </div>
  );
}
