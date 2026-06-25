import { afterEach, describe, expect, it } from 'vitest';
import { useAutoPhaseStore } from '../../src/stores/autophase-store';

// Loose builders — the store does not validate shape, and tests are outside the
// tsc include (src/** only), so we only fill the fields the feed logic reads.
const task = (id: string, status: string, assignee?: string) =>
  ({ id, title: `Task ${id}`, status, priority: 'medium', assignee }) as never;
const phase = (id: string, status: string, tasks: unknown[]) =>
  ({ id, name: `Phase ${id}`, status, tasks }) as never;

describe('auto phase store', () => {
  afterEach(() => {
    useAutoPhaseStore.setState({
      phases: [],
      activePhaseId: null,
      overallPercent: 0,
      autonomous: false,
      title: null,
      status: 'idle',
      lastEvent: null,
      lastError: null,
      feed: [],
      progress: null,
    });
  });

  it('setState patches each field individually', () => {
    useAutoPhaseStore.getState().setState({ phases: [{ id: 'p1', label: 'Thinking', status: 'active' }] });
    expect(useAutoPhaseStore.getState().phases).toHaveLength(1);
  });

  it('setState preserves unspecified fields', () => {
    useAutoPhaseStore.setState({ phases: [{ id: 'p1', label: 'Thinking', status: 'active' }], autonomous: true });
    useAutoPhaseStore.getState().setState({ title: 'My Title', status: 'running' });
    // autonomous should still be true (not reset)
    expect(useAutoPhaseStore.getState().title).toBe('My Title');
    expect(useAutoPhaseStore.getState().autonomous).toBe(true);
    expect(useAutoPhaseStore.getState().status).toBe('running');
  });

  it('stores lifecycle and progress metadata', () => {
    useAutoPhaseStore.getState().setState({
      status: 'running',
      lastEvent: 'progress',
      progress: { totalPhases: 4, completed: 2, failed: 0, totalTasks: 8, completedTasks: 3, failedTasks: 0 },
    });
    const s = useAutoPhaseStore.getState();
    expect(s.status).toBe('running');
    expect(s.lastEvent).toBe('progress');
    expect(s.progress?.completedTasks).toBe(3);
  });

  it('does not emit feed entries on the first snapshot (no prior status)', () => {
    useAutoPhaseStore.getState().setState({
      phases: [phase('p1', 'running', [task('t1', 'pending')])],
    });
    expect(useAutoPhaseStore.getState().feed).toHaveLength(0);
  });

  it('derives a "started" feed entry when a task goes pending → in_progress', () => {
    const s = useAutoPhaseStore.getState();
    s.setState({ phases: [phase('p1', 'running', [task('t1', 'pending')])] });
    s.setState({ phases: [phase('p1', 'running', [task('t1', 'in_progress', 'Curie')])] });
    const feed = useAutoPhaseStore.getState().feed;
    expect(feed).toHaveLength(1);
    expect(feed[0]?.kind).toBe('started');
    expect(feed[0]?.text).toContain('Curie');
  });

  it('derives "completed" and "failed" entries, newest-first', () => {
    const s = useAutoPhaseStore.getState();
    s.setState({ phases: [phase('p1', 'running', [task('t1', 'in_progress'), task('t2', 'in_progress')])] });
    s.setState({ phases: [phase('p1', 'running', [task('t1', 'completed'), task('t2', 'in_progress')])] });
    s.setState({ phases: [phase('p1', 'running', [task('t1', 'completed'), task('t2', 'failed')])] });
    const feed = useAutoPhaseStore.getState().feed;
    expect(feed).toHaveLength(2);
    // Newest first: the failure (last transition) sits ahead of the completion.
    expect(feed[0]?.kind).toBe('failed');
    expect(feed[1]?.kind).toBe('completed');
  });

  it('emits a "wave" entry when a phase completes', () => {
    const s = useAutoPhaseStore.getState();
    s.setState({ phases: [phase('p1', 'running', [task('t1', 'completed')])] });
    s.setState({ phases: [phase('p1', 'completed', [task('t1', 'completed')])] });
    const feed = useAutoPhaseStore.getState().feed;
    expect(feed.some((e) => e.kind === 'wave')).toBe(true);
  });

  it('caps the feed at 60 entries', () => {
    const s = useAutoPhaseStore.getState();
    // Seed 70 tasks as in_progress, then flip them all to completed at once.
    const seed = Array.from({ length: 70 }, (_, i) => task(`t${i}`, 'in_progress'));
    s.setState({ phases: [phase('p1', 'running', seed)] });
    const done = Array.from({ length: 70 }, (_, i) => task(`t${i}`, 'completed'));
    s.setState({ phases: [phase('p1', 'running', done)] });
    expect(useAutoPhaseStore.getState().feed).toHaveLength(60);
  });

  it('clear resets all fields', () => {
    useAutoPhaseStore.setState({
      phases: [{ id: 'p1', label: 'Thinking', status: 'active' }],
      activePhaseId: 'p1',
      overallPercent: 50,
      autonomous: true,
      title: 'Test',
      status: 'failed',
      lastEvent: 'failed',
      lastError: 'boom',
      progress: { totalPhases: 1, completed: 0, failed: 1, totalTasks: 2, completedTasks: 1, failedTasks: 1 },
    });
    useAutoPhaseStore.getState().clear();
    const s = useAutoPhaseStore.getState();
    expect(s.phases).toEqual([]);
    expect(s.activePhaseId).toBeNull();
    expect(s.overallPercent).toBe(0);
    expect(s.autonomous).toBe(false);
    expect(s.title).toBeNull();
    expect(s.status).toBe('idle');
    expect(s.lastEvent).toBeNull();
    expect(s.lastError).toBeNull();
    expect(s.progress).toBeNull();
    expect(s.feed).toEqual([]);
  });
});
