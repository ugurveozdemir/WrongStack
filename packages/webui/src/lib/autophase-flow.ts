/**
 * AutoPhase → SDD flow-graph adapter.
 *
 * The SDD show (SddFlowGraph / FlowTask / FlowColumn) is the single DAG
 * renderer. AutoPhase has its own model (PhaseItem with a nested tasks[]), so
 * we map it onto the SDD flow shape: one column per phase (left→right phase
 * order), one FlowTask per task. AutoPhase task status names are a subset of
 * SDD's FlowStatus, so they pass through directly. Short ids are synthesised
 * stably (t01, t02, …) in phase/task order.
 */
import type { PhaseItem } from '@/components/PhasePanel';
import type { FlowColumn, FlowStatus, FlowTask } from '@/components/SddFlowGraph';

export interface AutoPhaseFlow {
  columns: FlowColumn[];
  tasks: FlowTask[];
}

/** Build flow-graph input ({columns, tasks}) from the live phase list. */
export function phasesToFlow(phases: PhaseItem[]): AutoPhaseFlow {
  const columns: FlowColumn[] = [];
  const tasks: FlowTask[] = [];
  const byShort = new Map<string, FlowTask>();
  let seq = 0;
  // Short ids of the previous non-empty phase — AutoPhase phases form a linear
  // chain (each depends on the one before), so we draw a single connector from
  // the previous phase's last task to this phase's first task. That gives the
  // DAG a left→right "spine" instead of disconnected islands, without the
  // clutter of an all-pairs fan-in.
  let prevLastShort: string | null = null;
  for (const phase of phases) {
    const taskIds: string[] = [];
    let firstShort: string | null = null;
    for (const t of phase.tasks ?? []) {
      seq += 1;
      const shortId = `t${String(seq).padStart(2, '0')}`;
      taskIds.push(shortId);
      if (!firstShort) firstShort = shortId;
      const ft: FlowTask = {
        id: t.id,
        shortId,
        title: t.title,
        displayStatus: t.status as FlowStatus,
        priority: t.priority,
        deps: [],
        agentName: t.assignee,
      };
      tasks.push(ft);
      byShort.set(shortId, ft);
    }
    // Connect this phase to the previous one (first-of-this ← last-of-prev).
    if (firstShort && prevLastShort) {
      byShort.get(firstShort)?.deps.push(prevLastShort);
    }
    const last = taskIds[taskIds.length - 1];
    if (last) prevLastShort = last;
    columns.push({ label: phase.name, taskIds });
  }
  return { columns, tasks };
}
