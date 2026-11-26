"use client";

import { format } from "date-fns";
import { useId, useMemo } from "react";
import type { DayCount } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { chartPoints } from "../lib/logic";

/*
 * 14 days of completed tasks as one area and line. Inline SVG (stretched, with non-scaling
 * strokes) behind an HTML layer that carries the hover and focus targets, so labels stay crisp at
 * any width. No chart library. Loaded on demand with next/dynamic.
 */

const W = 1000;

export default function TrendChart({ data, height = 120, hero = false }: { data: DayCount[]; height?: number; hero?: boolean }) {
  const gid = useId().replace(/:/g, "");
  const h = height;
  const values = useMemo(() => data.map((d) => d.count), [data]);
  const max = Math.max(1, ...values);
  const pts = useMemo(() => chartPoints(values, W, h, 6), [values, h]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = pts.length ? `${line} L${W},${h} L0,${h} Z` : "";
  const total = values.reduce((a, b) => a + b, 0);
  const n = data.length;

  return (
    <figure className="m-0" aria-label={`Tasks completed per day over the last ${n} days, ${total} in total`}>
      <div className="relative" style={{ height: h }}>
        <svg viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden>
          <defs>
            <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--chart-2)" stopOpacity={hero ? 0.32 : 0.24} />
              <stop offset="1" stopColor="var(--chart-2)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 0.5, 1].map((t) => (
            <line
              key={t}
              x1="0"
              x2={W}
              y1={6 + (h - 12) * t}
              y2={6 + (h - 12) * t}
              stroke="var(--border)"
              strokeWidth="1"
              strokeDasharray={t === 1 ? undefined : "2 5"}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {area && <path d={area} fill={`url(#${gid})`} />}
          {line && (
            <path d={line} fill="none" stroke="var(--chart-2)" strokeWidth={hero ? 2.5 : 2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          )}
        </svg>
        <span className="absolute left-0 top-0 -translate-y-1/2 bg-surface pr-1 text-11 text-fg-faint tabular">{max}</span>
        <ol className="absolute inset-0 m-0 grid list-none p-0" style={{ gridTemplateColumns: `repeat(${n || 1}, minmax(0, 1fr))` }}>
          {data.map((d, i) => {
            const p = pts[i]!;
            const last = i === n - 1;
            return (
              <li
                key={d.date}
                tabIndex={0}
                aria-label={`${format(new Date(`${d.date}T12:00:00`), "EEE d MMM")}: ${d.count} completed`}
                className="group relative outline-none"
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border-strong opacity-0 transition-opacity duration-[var(--dur-fast)] group-hover:opacity-100 group-focus-visible:opacity-100",
                  )}
                />
                <span
                  aria-hidden
                  className={cn(
                    "absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-chart-2 transition-opacity duration-[var(--dur-fast)]",
                    last ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
                  )}
                  style={{ left: "50%", top: p.y }}
                />
                <span
                  role="tooltip"
                  className={cn(
                    "pointer-events-none absolute top-0 z-[var(--z-sticky)] -translate-y-full whitespace-nowrap rounded-sm bg-fg px-2 py-1 text-12 text-surface opacity-0 shadow-popover transition-opacity duration-[var(--dur-fast)] group-hover:opacity-100 group-focus-visible:opacity-100",
                    i < 3 ? "left-0" : i > n - 4 ? "right-0" : "left-1/2 -translate-x-1/2",
                  )}
                >
                  {format(new Date(`${d.date}T12:00:00`), "EEE d MMM")}: <b className="tabular">{d.count}</b>
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="mt-2 flex justify-between text-11 text-fg-faint tabular" aria-hidden>
        {data.length > 0 ? (
          <>
            <span>{format(new Date(`${data[0]!.date}T12:00:00`), "d MMM")}</span>
            <span>{format(new Date(`${data[Math.floor(n / 2)]!.date}T12:00:00`), "d MMM")}</span>
            <span className="font-medium text-fg-muted">Today</span>
          </>
        ) : null}
      </div>
    </figure>
  );
}
