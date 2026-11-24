import Link from "next/link";
import { cn } from "@/lib/utils";

/** Canvas for work screens: wider than PageBody so boards and calendars get the room. */
export function ScreenFrame({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mx-auto flex w-full max-w-[1440px] flex-col gap-5 px-4 py-5 sm:px-6 md:px-8 md:py-6", className)} {...props} />;
}

/**
 * Title row: the object's name as the h1, its parent as a quiet link before it (not an eyebrow
 * label: it is real navigation), and the screen's actions on the right.
 */
export function ScreenHeader({
  title,
  context,
  eyebrowHref,
  color,
  meta,
  actions,
}: {
  title: React.ReactNode;
  context?: React.ReactNode;
  eyebrowHref?: string;
  color?: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        {context && (
          <p className="mb-1 flex items-center gap-1.5 text-13 text-fg-muted">
            {color && <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />}
            {eyebrowHref ? (
              <Link href={eyebrowHref} className="truncate rounded-xs hover:text-fg hover:underline focus-visible:outline-2 focus-visible:outline-ring">
                {context}
              </Link>
            ) : (
              <span className="truncate">{context}</span>
            )}
          </p>
        )}
        <h1 className="flex min-h-8 items-center gap-2.5 text-24 font-semibold tracking-[-0.015em] text-fg">
          {!context && color && <span aria-hidden className="size-3 shrink-0 rounded-[4px]" style={{ backgroundColor: color }} />}
          <span className="min-w-0 truncate">{title}</span>
        </h1>
        {meta && <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-13 text-fg-muted">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
