import { describe, expect, it } from 'vitest';
import { phasesToFlow } from '../../src/lib/autophase-flow';
import type { PhaseItem } from '../../src/components/PhasePanel';

// Loose builders — phasesToFlow reads only a handful of fields, and tests are
// outside the tsc include, so fixtures stay minimal.
const task = (id: string, status: string, assignee?: string) =>
  ({ id, title: `Task ${id}`, status, priority: 'medium', assignee }) as never;
const phase = (id: string, name: string, tasks: unknown[]) =>
  ({ id, name, status: 'running', tasks }) as unknown as PhaseItem;

describe('phasesToFlow', () => {
  it('maps each phase to a column carrying its task short ids', () => {
    const { columns } = phasesToFlow([
      phase('p1', 'Design', [task('a', 'completed')]),
      phase('p2', 'Build', [task('b', 'pending'), task('c', 'pending')]),
    ]);
    expect(columns).toHaveLength(2);
    expect(columns[0]).toEqual({ label: 'Design', taskIds: ['t01'] });
    expect(columns[1]).toEqual({ label: 'Build', taskIds: ['t02', 't03'] });
  });

  it('assigns sequential synthetic short ids across phases', () => {
    const { tasks } = phasesToFlow([
      phase('p1', 'A', [task('a', 'pending')]),
      phase('p2', 'B', [task('b', 'pending')]),
    ]);
    expect(tasks.map((t) => t.shortId)).toEqual(['t01', 't02']);
    expect(tasks.map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('passes status through as displayStatus and assignee as agentName', () => {
    const { tasks } = phasesToFlow([phase('p1', 'A', [task('a', 'in_progress', 'Turing')])]);
    expect(tasks[0]?.displayStatus).toBe('in_progress');
    expect(tasks[0]?.agentName).toBe('Turing');
  });

  it('draws a single inter-phase spine edge (first-of-phase ← last-of-prev)', () => {
    const { tasks } = phasesToFlow([
      phase('p1', 'A', [task('a', 'completed'), task('b', 'completed')]), // t01, t02
      phase('p2', 'B', [task('c', 'pending'), task('d', 'pending')]), // t03, t04
    ]);
    const byShort = new Map(tasks.map((t) => [t.shortId, t]));
    // First task of phase 2 depends on the last task of phase 1; nothing else does.
    expect(byShort.get('t03')?.deps).toEqual(['t02']);
    expect(byShort.get('t04')?.deps).toEqual([]);
    expect(byShort.get('t01')?.deps).toEqual([]);
  });

  it('handles empty phases without crashing and skips the spine across them', () => {
    const { columns, tasks } = phasesToFlow([
      phase('p1', 'A', [task('a', 'completed')]), // t01
      phase('p2', 'Empty', []),
      phase('p3', 'C', [task('c', 'pending')]), // t02
    ]);
    expect(columns[1]).toEqual({ label: 'Empty', taskIds: [] });
    const byShort = new Map(tasks.map((t) => [t.shortId, t]));
    // Phase C's first task chains back to phase A's last task (the empty phase
    // contributes no node, so the spine bridges it).
    expect(byShort.get('t02')?.deps).toEqual(['t01']);
  });

  it('returns empty columns/tasks for no phases', () => {
    expect(phasesToFlow([])).toEqual({ columns: [], tasks: [] });
  });
});
