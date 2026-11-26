import { cn } from "@/lib/utils";
import type { TeamTotals } from "@/lib/api/types";
import { formatCount, weekDelta } from "../lib/logic";
import { DeltaChip } from "./primitives";

type Item = { key: string; label: string; value: number; caption: React.ReactNode; tone?: "danger" | "good" };

function items(t: TeamTotals, scoped: boolean): Item[] {
  const d = weekDelta(t.completed_7d, t.completed_prev_7d);
  return [
    { key: "open", label: "Open tasks", value: t.open_tasks, caption: scoped ? "In this client" : "Across all clients" },
    {
      key: "overdue",
      label: "Overdue",
      value: t.overdue_tasks,
      tone: t.overdue_tasks > 0 ? "danger" : undefined,
      caption: t.overdue_tasks > 0 ? "Past their due date" : "Nothing late",
    },
    {
      key: "done",
      label: "Completed this week",
      value: t.completed_7d,
      tone: t.completed_7d > 0 ? "good" : undefined,
      caption: <DeltaChip delta={d} />,
    },
    { key: "projects", label: "Active projects", value: t.active_projects, caption: `${t.members} ${t.members === 1 ? "member" : "members"}` },
  ];
}

const figure = "figure font-medium tracking-[-0.02em] tabular";
const toneClass = (tone: Item["tone"], v: number) =>
  tone === "danger" ? "text-danger-text" : tone === "good" ? "text-success-text" : v === 0 ? "text-fg-faint" : "text-fg";

/** Operations board: one ruled strip of four figures. Compact, scannable left to right. */
export function KpiStrip({ totals, scoped, className }: { totals: TeamTotals; scoped: boolean; className?: string }) {
  return (
    <dl className={cn("m-0 grid grid-cols-2 overflow-hidden rounded-md border border-border bg-surface lg:grid-cols-4", className)}>
      {items(totals, scoped).map((k, i) => (
        <div key={k.key} className={cn("flex min-h-[104px] flex-col justify-between p-4", i % 2 === 1 && "border-l border-border-subtle", i >= 2 && "border-t border-border-subtle lg:border-t-0", i > 0 && "lg:border-l lg:border-border-subtle")}>
          <dt className="text-12 font-medium text-fg-muted">{k.label}</dt>
          <dd className="m-0">
            <span className={cn(figure, "block text-[32px] leading-9", toneClass(k.tone, k.value))}>{formatCount(k.value)}</span>
            <span className="block truncate text-12 text-fg-muted">{k.caption}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Executive overview: tonal tiles on a 2x2 grid beside the trend. */
export function KpiTiles({ totals, scoped, className }: { totals: TeamTotals; scoped: boolean; className?: string }) {
  return (
    <dl className={cn("m-0 grid grid-cols-2 gap-3", className)}>
      {items(totals, scoped).map((k) => (
        <div key={k.key} className="flex min-h-[112px] flex-col justify-between rounded-md bg-surface-sunken p-4">
          <dt className="text-12 font-medium text-fg-muted">{k.label}</dt>
          <dd className="m-0">
            <span className={cn(figure, "block text-[30px] leading-9", toneClass(k.tone, k.value))}>{formatCount(k.value)}</span>
            <span className="block truncate text-12 text-fg-muted">{k.caption}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
