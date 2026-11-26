"use client";

import { Check, Minus, ShieldCheck } from "lucide-react";
import { CAPABILITIES, ROLE_NAME, ROLE_ORDER, ROLE_SUMMARY, type Grant, type Role } from "@/lib/permissions/rules";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/ui/tooltip";

const GRANT_LABEL: Record<Grant, string> = { yes: "Yes", scoped: "Limited", no: "No" };

/** "What each role can do", drawn from the same constant the role picker and confirmations use. */
export function PermissionsPanel({ highlight }: { highlight?: Role }) {
  return (
    <section aria-labelledby="perm-h" className="mt-10">
      <h2 id="perm-h" className="flex items-center gap-2 text-14 font-semibold">
        <ShieldCheck className="size-4 text-fg-muted" aria-hidden /> What each role can do
      </h2>
      <p className="mt-1 text-13 text-fg-muted">The API enforces these rules. &quot;Limited&quot; means a yes with a condition, noted on hover.</p>
      <div className="mt-3 overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[640px] border-collapse text-13">
          <thead>
            <tr className="border-b border-border bg-surface-sunken">
              <th scope="col" className="h-10 px-3 text-left text-12 font-normal text-fg-muted">
                Can they&hellip;
              </th>
              {ROLE_ORDER.map((r) => (
                <th key={r} scope="col" className={cn("h-10 w-[104px] px-2 text-center text-12 font-semibold", r === highlight ? "text-accent-text" : "text-fg")}>
                  {ROLE_NAME[r]}
                </th>
              ))}
            </tr>
            <tr className="border-b border-border-subtle">
              <td className="px-3 py-1.5 text-12 text-fg-muted">In one line</td>
              {ROLE_ORDER.map((r) => (
                <td key={r} className="px-2 py-1.5 align-top text-[11px] leading-4 text-fg-muted">
                  {ROLE_SUMMARY[r]}
                </td>
              ))}
            </tr>
          </thead>
          <tbody>
            {CAPABILITIES.map((c) => (
              <tr key={c.id} className="border-b border-border-subtle last:border-b-0 hover:bg-surface-sunken">
                <th scope="row" className="h-10 px-3 text-left font-normal text-fg">
                  {c.label}
                </th>
                {ROLE_ORDER.map((r) => (
                  <td key={r} className="px-2 text-center">
                    <Cell grant={c.grants[r]} note={c.note[r]} label={`${ROLE_NAME[r]}: ${c.label}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Cell({ grant, note, label }: { grant: Grant; note?: string; label: string }) {
  const body =
    grant === "yes" ? (
      <Check className="mx-auto size-4 text-success-text" aria-hidden />
    ) : grant === "no" ? (
      <Minus className="mx-auto size-4 text-fg-faint" aria-hidden />
    ) : (
      <span className="inline-flex rounded-full bg-warning-subtle px-1.5 text-11 font-medium text-warning-text">Limited</span>
    );
  const el = (
    <span tabIndex={note ? 0 : undefined} aria-label={`${label}: ${GRANT_LABEL[grant]}${note ? `. ${note}` : ""}`} className="inline-flex min-h-6 items-center justify-center outline-none focus-visible:outline-2 focus-visible:outline-ring">
      {body}
    </span>
  );
  return note ? <Tooltip content={note}>{el}</Tooltip> : el;
}
