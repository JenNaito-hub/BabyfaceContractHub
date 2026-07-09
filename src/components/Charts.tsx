"use client";

import { formatVND } from "@/lib/calculations";

type Datum = { label: string; value: number };

const PALETTE = ["#D7F205", "#1A1A1A", "#E8553A", "#8BAE00", "#5B5B5B", "#F2B705", "#2D6A4F"];

export function BarChart({
  data,
  valueFormatter = (v) => String(v),
}: {
  data: Datum[];
  valueFormatter?: (v: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-dark/40">Chưa có dữ liệu</p>;
  }
  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.label}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="max-w-[60%] truncate font-medium">{d.label}</span>
            <span className="font-semibold text-dark/70">{valueFormatter(d.value)}</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-dark/5">
            <div
              className="h-full rounded-full bg-lime"
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DonutChart({ data }: { data: Datum[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return <p className="py-8 text-center text-sm text-dark/40">Chưa có dữ liệu</p>;
  }

  const radius = 60;
  const stroke = 26;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const segments = data
    .filter((d) => d.value > 0)
    .map((d, i) => {
      const fraction = d.value / total;
      const dash = fraction * circumference;
      const seg = {
        color: PALETTE[i % PALETTE.length],
        dash,
        gap: circumference - dash,
        offset: -offset,
        label: d.label,
        value: d.value,
        pct: Math.round(fraction * 100),
      };
      offset += dash;
      return seg;
    });

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg width="160" height="160" viewBox="0 0 160 160">
        <g transform="translate(80,80) rotate(-90)">
          {segments.map((s, i) => (
            <circle
              key={i}
              r={radius}
              cx="0"
              cy="0"
              fill="transparent"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={`${s.dash} ${s.gap}`}
              strokeDashoffset={s.offset}
            />
          ))}
        </g>
        <text
          x="80"
          y="80"
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-dark font-display text-lg font-extrabold"
        >
          {total}
        </text>
      </svg>
      <ul className="space-y-1.5 text-sm">
        {segments.map((s, i) => (
          <li key={i} className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ backgroundColor: s.color }}
            />
            <span className="max-w-[160px] truncate">{s.label}</span>
            <span className="text-dark/50">
              {s.value} ({s.pct}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export { formatVND };
