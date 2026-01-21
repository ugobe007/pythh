import React from 'react';

interface PowerScoreSparklineProps {
  data: number[]; // Power scores (e.g., [45, 48, 50, 52, 54, 56, 58])
  width?: number;
  height?: number;
  color?: string;
  showDot?: boolean;
}

/**
 * PowerScoreSparkline - Tiny SVG sparkline (no chart libs)
 * 
 * Shows 7-day Power Score trend with last dot highlighted
 * Perfect for the "daily progress visibility" addiction mechanic
 */
export default function PowerScoreSparkline({
  data,
  width = 80,
  height = 24,
  color = '#10b981', // emerald-500
  showDot = true,
}: PowerScoreSparklineProps) {
  if (!data || data.length === 0) {
    return null;
  }

  // Normalize data to 0-1 range
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1; // Avoid division by zero

  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return { x, y };
  });

  // Generate polyline path
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');

  // Last point for dot
  const lastPoint = points[points.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="inline-block"
      style={{ verticalAlign: 'middle' }}
    >
      {/* Sparkline path */}
      <polyline
        points={points.map(p => `${p.x},${p.y}`).join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Last point dot */}
      {showDot && lastPoint && (
        <circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r="2"
          fill={color}
          stroke="#0a0a0a"
          strokeWidth="1"
        />
      )}
    </svg>
  );
}
