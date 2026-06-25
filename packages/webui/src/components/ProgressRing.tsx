/**
 * ProgressRing — circular SVG progress indicator with a violet→cyan gradient.
 *
 * Extracted from SddBoardView so the SDD board, the AutoPhase board, and the
 * AutoPhase side panel all render the same ring. The gradient id is suffixed
 * so multiple rings on one page don't collide on the <defs> id.
 */
export function ProgressRing({
  pct,
  size = 64,
  id = 'pr',
}: {
  pct: number;
  size?: number;
  id?: string;
}): React.ReactElement {
  const stroke = size >= 56 ? 6 : 5;
  const r = size / 2 - stroke;
  const c = 2 * Math.PI * r;
  const off = c - (Math.max(0, Math.min(100, pct)) / 100) * c;
  const gradId = `ring-grad-${id}`;
  return (
    <div className="relative shrink-0" style={{ height: size, width: size }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        style={{ height: size, width: size }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="hsl(215 28% 22%)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16,1,0.3,1)' }}
        />
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
      </svg>
      <div
        className="absolute inset-0 flex items-center justify-center font-bold text-foreground"
        style={{ fontSize: size >= 56 ? 13 : 11 }}
      >
        {Math.round(pct)}%
      </div>
    </div>
  );
}
