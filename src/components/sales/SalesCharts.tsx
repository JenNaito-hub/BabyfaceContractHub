"use client";

import { formatVNDShort } from "@/lib/sales/calc";

export type Datum = { label: string; value: number; color?: string };

/** Cột dọc — hợp cho doanh thu theo ngày (28–31 cột). */
export function ColumnChart({
  data,
  formatValue = formatVNDShort,
  height = 160,
}: {
  data: Datum[];
  formatValue?: (v: number) => string;
  height?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (!data.length) return <p className="py-10 text-center text-sm text-dark/40">Chưa có dữ liệu</p>;

  return (
    <div>
      <div className="flex items-end gap-[3px]" style={{ height }}>
        {data.map((d) => (
          <div key={d.label} className="group relative flex-1">
            <div
              className="w-full rounded-t bg-lime transition group-hover:bg-dark"
              style={{ height: Math.max(2, (d.value / max) * height) }}
            />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-dark px-2 py-1 text-[11px] font-semibold text-paper group-hover:block">
              {d.label.slice(5)} · {formatValue(d.value)}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-dark/40">
        <span>{data[0]?.label.slice(5)}</span>
        <span>Cao nhất {formatValue(max)}</span>
        <span>{data[data.length - 1]?.label.slice(5)}</span>
      </div>
    </div>
  );
}

/** Thanh ngang có nhãn — hợp cho xếp hạng (kênh, cửa hàng, SKU). */
export function RankBar({
  data,
  formatValue = formatVNDShort,
}: {
  data: Datum[];
  formatValue?: (v: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (!data.length) return <p className="py-10 text-center text-sm text-dark/40">Chưa có dữ liệu</p>;

  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.label}>
          <div className="mb-1 flex items-center justify-between gap-3 text-xs">
            <span className="truncate font-medium">{d.label}</span>
            <span className="shrink-0 font-semibold text-dark/70">{formatValue(d.value)}</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-dark/5">
            <div
              className="h-full rounded-full"
              style={{
                width: `${(d.value / max) * 100}%`,
                backgroundColor: d.color ?? "#D7F205",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
