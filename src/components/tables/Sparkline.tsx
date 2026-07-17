interface SparklinePoint {
  actual: number;
  optimal: number;
}

interface SparklineProps {
  points: SparklinePoint[];
  width?: number;
  height?: number;
}

/** Season trend of actual vs optimal points — optimal in the de-emphasis tone, actual in the accent. */
export function Sparkline({ points, width = 560, height = 120 }: SparklineProps) {
  if (points.length === 0) return null;

  const padding = 8;
  const maxValue = Math.max(1, ...points.map((p) => Math.max(p.actual, p.optimal)));
  const stepX = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;

  const toXY = (value: number, index: number) => {
    const x = padding + index * stepX;
    const y = height - padding - (value / maxValue) * (height - padding * 2);
    return `${x},${y}`;
  };

  const optimalPath = points.map((p, i) => toXY(p.optimal, i)).join(" ");
  const actualPath = points.map((p, i) => toXY(p.actual, i)).join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      role="img"
      aria-label="Season trend of actual vs. potential points"
    >
      <polyline points={optimalPath} fill="none" stroke="var(--text-dim)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" opacity={0.6} />
      <polyline points={actualPath} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
