import { cn } from "@/lib/utils";

/** Screen title row: a noun h1, an optional one-line description, real actions only. */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-x-4 gap-y-3", className)}>
      <div className="min-w-0">
        <h1 className="text-20 font-semibold tracking-[-0.01em] text-fg">{title}</h1>
        {description && <p className="mt-0.5 text-13 text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Standard canvas padding inside the sheet. */
export function PageBody({
  className,
  width = "wide",
  ...props
}: React.ComponentProps<"div"> & { width?: "wide" | "narrow" }) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 py-5 sm:px-6 md:px-8 md:py-6",
        width === "wide" ? "max-w-[1200px]" : "max-w-[880px]",
        className,
      )}
      {...props}
    />
  );
}

/** A titled block on a page. The heading names the block; the frame stays when it is empty. */
export function Panel({
  title,
  meta,
  children,
  className,
}: {
  title: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col rounded-md border border-border bg-surface", className)}>
      <div className="flex h-11 items-center justify-between gap-3 border-b border-border-subtle px-4">
        <h2 className="text-14 font-semibold text-fg">{title}</h2>
        {meta && <div className="text-12 text-fg-muted">{meta}</div>}
      </div>
      {children}
    </section>
  );
}
