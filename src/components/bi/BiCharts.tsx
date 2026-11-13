import React, { useState } from 'react';

export interface TrendPoint {
  label: string;
  value: number;
  secondaryLabel?: string;
}

export function BiTrendAreaChart({
  title,
  subtitle,
  data,
  threshold,
  unit = '%',
}: {
  title: string;
  subtitle: string;
  data: TrendPoint[];
  threshold?: number;
  unit?: string;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const width = 680;
  const height = 250;
  const pad = { top: 28, right: 28, bottom: 40, left: 52 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  if (!data.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
        <div className="h-52 flex items-center justify-center text-xs text-slate-400">
          No trend sessions recorded for the selected filters.
        </div>
      </div>
    );
  }

  const minVal = 40;
  const maxVal = 100;
  const xFor = (i: number) =>
    data.length === 1 ? pad.left + innerW / 2 : pad.left + (i / (data.length - 1)) * innerW;
  const yFor = (val: number) =>
    pad.top + innerH - ((Math.max(minVal, Math.min(maxVal, val)) - minVal) / (maxVal - minVal)) * innerH;

  const points = data.map((d, i) => `${xFor(i)},${yFor(d.value)}`).join(' ');
  const areaPath = `M ${xFor(0)},${pad.top + innerH} L ${data
    .map((d, i) => `${xFor(i)},${yFor(d.value)}`)
    .join(' L ')} L ${xFor(data.length - 1)},${pad.top + innerH} Z`;

  const activePoint = hoveredIdx !== null ? data[hoveredIdx] : null;
  const avgVal = Math.round((data.reduce((s, d) => s + d.value, 0) / data.length) * 10) / 10;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-4 text-xs tabular-nums">
          {activePoint ? (
            <div className="bg-slate-900 text-white px-3 py-1.5 rounded-md">
              <span className="font-mono font-semibold">{activePoint.value}{unit}</span>
              <span className="text-slate-300 mx-1.5">·</span>
              <span>{activePoint.label}</span>
              {activePoint.secondaryLabel && (
                <span className="text-slate-300 ml-1.5">({activePoint.secondaryLabel})</span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 text-slate-600">
              <span>
                Period Avg: <strong className="font-mono text-slate-900">{avgVal}{unit}</strong>
              </span>
              <span>·</span>
              <span>
                Latest: <strong className="font-mono text-blue-700">{data[data.length - 1].value}{unit}</strong>
              </span>
            </div>
          )}
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
        <defs>
          <linearGradient id="biAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1D4ED8" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {[40, 55, 75, 90, 100].map((tick) => {
          const y = yFor(tick);
          return (
            <g key={tick}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={y}
                y2={y}
                stroke={tick === threshold ? '#D97706' : '#E2E8F0'}
                strokeDasharray={tick === threshold ? '5 4' : undefined}
                strokeWidth={tick === threshold ? 1.5 : 1}
              />
              <text
                x={pad.left - 10}
                y={y + 4}
                textAnchor="end"
                className="fill-slate-500 text-[11px] font-mono"
              >
                {tick}{unit}
              </text>
            </g>
          );
        })}

        {threshold !== undefined && (
          <text
            x={width - pad.right}
            y={yFor(threshold) - 6}
            textAnchor="end"
            className="fill-amber-700 text-[11px] font-medium"
          >
            Min Policy Target ({threshold}%)
          </text>
        )}

        <path d={areaPath} fill="url(#biAreaGrad)" />
        <polyline
          fill="none"
          stroke="#1D4ED8"
          strokeWidth={2.5}
          strokeLinejoin="round"
          points={points}
        />

        {data.map((d, i) => {
          const cx = xFor(i);
          const cy = yFor(d.value);
          const isHovered = hoveredIdx === i;
          return (
            <g
              key={d.label + i}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="cursor-pointer"
            >
              <rect x={cx - 20} y={pad.top} width={40} height={innerH} fill="transparent" />
              {isHovered && (
                <line
                  x1={cx}
                  x2={cx}
                  y1={pad.top}
                  y2={pad.top + innerH}
                  stroke="#94A3B8"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                />
              )}
              <circle
                cx={cx}
                cy={cy}
                r={isHovered ? 5.5 : 4}
                fill={d.value < (threshold || 0) ? '#DC2626' : '#1D4ED8'}
                stroke="#FFFFFF"
                strokeWidth={2}
              />
              <text
                x={cx}
                y={cy - 10}
                textAnchor="middle"
                className="fill-slate-700 text-[10px] font-mono font-medium"
              >
                {d.value}%
              </text>
              <text
                x={cx}
                y={height - 10}
                textAnchor="middle"
                className="fill-slate-500 text-[11px] font-mono"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export interface GroupedBarItem {
  label: string;
  subLabel?: string;
  primaryValue: number;
  secondaryValue?: number;
}

export function BiGroupedBarChart({
  title,
  subtitle,
  primaryName,
  secondaryName,
  data,
  unit = '%',
}: {
  title: string;
  subtitle: string;
  primaryName: string;
  secondaryName?: string;
  data: GroupedBarItem[];
  unit?: string;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const width = 640;
  const height = 260;
  const pad = { top: 28, right: 20, bottom: 52, left: 48 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  if (!data.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
        <div className="h-52 flex items-center justify-center text-xs text-slate-400">
          No records match current filters.
        </div>
      </div>
    );
  }

  const slotW = innerW / data.length;
  const barW = secondaryName ? Math.min(24, slotW * 0.28) : Math.min(36, slotW * 0.45);
  const yFor = (val: number) => pad.top + innerH - (Math.min(100, Math.max(0, val)) / 100) * innerH;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-blue-700 inline-block" />
            {primaryName}
          </span>
          {secondaryName && (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
              {secondaryName}
            </span>
          )}
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = yFor(tick);
          return (
            <g key={tick}>
              <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="#E2E8F0" strokeWidth={1} />
              <text x={pad.left - 10} y={y + 4} textAnchor="end" className="fill-slate-500 text-[11px] font-mono">
                {tick}{unit}
              </text>
            </g>
          );
        })}

        {data.map((d, i) => {
          const center = pad.left + slotW * i + slotW / 2;
          const y1 = yFor(d.primaryValue);
          const h1 = pad.top + innerH - y1;
          const y2 = d.secondaryValue !== undefined ? yFor(d.secondaryValue) : 0;
          const h2 = d.secondaryValue !== undefined ? pad.top + innerH - y2 : 0;

          return (
            <g
              key={d.label + i}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              className="cursor-pointer"
            >
              {hoverIdx === i && (
                <rect
                  x={pad.left + slotW * i + 4}
                  y={pad.top}
                  width={slotW - 8}
                  height={innerH}
                  fill="#F8FAFC"
                  rx={4}
                />
              )}
              <rect
                x={secondaryName ? center - barW - 3 : center - barW / 2}
                y={y1}
                width={barW}
                height={h1}
                fill="#1D4ED8"
                rx={3}
              />
              <text
                x={secondaryName ? center - barW / 2 - 3 : center}
                y={y1 - 6}
                textAnchor="middle"
                className="fill-slate-700 text-[10px] font-mono font-medium"
              >
                {d.primaryValue}
              </text>

              {secondaryName && d.secondaryValue !== undefined && (
                <>
                  <rect
                    x={center + 3}
                    y={y2}
                    width={barW}
                    height={h2}
                    fill="#16A34A"
                    rx={3}
                  />
                  <text
                    x={center + barW / 2 + 3}
                    y={y2 - 6}
                    textAnchor="middle"
                    className="fill-emerald-800 text-[10px] font-mono font-medium"
                  >
                    {d.secondaryValue}
                  </text>
                </>
              )}

              <text
                x={center}
                y={height - 26}
                textAnchor="middle"
                className="fill-slate-800 text-[11px] font-semibold"
              >
                {d.label}
              </text>
              {d.subLabel && (
                <text
                  x={center}
                  y={height - 11}
                  textAnchor="middle"
                  className="fill-slate-500 text-[10px] font-mono"
                >
                  {d.subLabel}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function BiDonutBreakdownChart({
  title,
  subtitle,
  centerLabel,
  centerValue,
  segments,
}: {
  title: string;
  subtitle: string;
  centerLabel: string;
  centerValue: string | number;
  segments: { label: string; value: number; color: string }[];
}) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const radius = 58;
  const circumference = 2 * Math.PI * radius;

  let cumulativeOffset = 0;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="text-xs text-slate-500 mt-0.5 mb-5">{subtitle}</p>

      <div className="flex flex-col sm:flex-row items-center gap-6">
        <div className="relative w-44 h-44 shrink-0">
          <svg viewBox="0 0 156 156" className="w-full h-full -rotate-90">
            <circle cx={78} cy={78} r={radius} fill="none" stroke="#F1F5F9" strokeWidth={18} />
            {total > 0 &&
              segments.map((seg, idx) => {
                const segLength = (seg.value / total) * circumference;
                const offset = cumulativeOffset;
                cumulativeOffset += segLength;
                return (
                  <circle
                    key={seg.label}
                    cx={78}
                    cy={78}
                    r={radius}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth={activeIdx === idx ? 22 : 18}
                    strokeDasharray={`${segLength} ${circumference}`}
                    strokeDashoffset={-offset}
                    className="transition-all duration-150 cursor-pointer"
                    onMouseEnter={() => setActiveIdx(idx)}
                    onMouseLeave={() => setActiveIdx(null)}
                  />
                );
              })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <span className="text-2xl font-semibold text-slate-900 tabular-nums font-display">
              {activeIdx !== null ? segments[activeIdx].value : centerValue}
            </span>
            <span className="text-[11px] text-slate-500 max-w-[96px] truncate">
              {activeIdx !== null ? segments[activeIdx].label.split(' ')[0] : centerLabel}
            </span>
          </div>
        </div>

        <div className="flex-1 w-full space-y-2.5">
          {segments.map((seg, idx) => {
            const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0;
            return (
              <div
                key={seg.label}
                onMouseEnter={() => setActiveIdx(idx)}
                onMouseLeave={() => setActiveIdx(null)}
                className={`flex items-center justify-between gap-3 text-xs py-1.5 px-2.5 rounded-md transition-colors cursor-pointer ${
                  activeIdx === idx ? 'bg-slate-100' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: seg.color }} />
                  <span className="text-slate-700 font-medium truncate">{seg.label}</span>
                </div>
                <div className="font-mono tabular-nums text-slate-900 shrink-0">
                  {seg.value} <span className="text-slate-400">({pct}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function BiHorizontalWorkloadChart({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: {
    name: string;
    roleNote: string;
    theoryHours: number;
    labHours: number;
    maxHours: number;
    syllabusPct: number;
  }[];
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-blue-700 inline-block" />
            Theory Hrs
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-slate-600 inline-block" />
            Lab Hrs
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {items.map((item) => {
          const total = item.theoryHours + item.labHours;
          const cap = Math.max(item.maxHours, total, 1);
          const theoryPct = (item.theoryHours / cap) * 100;
          const labPct = (item.labHours / cap) * 100;
          return (
            <div key={item.name} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <span className="font-medium text-slate-900">{item.name}</span>
                  <span className="text-slate-400 mx-1.5">·</span>
                  <span className="text-slate-500">{item.roleNote}</span>
                </div>
                <div className="font-mono tabular-nums text-slate-700 shrink-0">
                  {total}/{item.maxHours} hrs <span className="text-slate-400">·</span>{' '}
                  <span className="text-emerald-700 font-medium">{item.syllabusPct}% syllabus</span>
                </div>
              </div>
              <div className="h-2.5 w-full bg-slate-100 rounded-sm overflow-hidden flex">
                <div className="bg-blue-700 h-full" style={{ width: `${theoryPct}%` }} />
                <div className="bg-slate-600 h-full" style={{ width: `${labPct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
