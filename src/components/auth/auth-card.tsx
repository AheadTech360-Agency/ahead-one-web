import { cn } from "@/lib/utils";

/** Card used by every auth screen: an h1, one line of context, the form, an optional footer. */
export function AuthCard({
  title,
  description,
  children,
  footer,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <>
      <section className={cn("rounded-lg border border-border bg-surface p-6", className)}>
        <h1 className="text-20 font-semibold tracking-[-0.01em] text-fg">{title}</h1>
        {description && <p className="mt-1 text-13 text-fg-muted">{description}</p>}
        <div className="mt-5">{children}</div>
      </section>
      {footer && <div className="mt-4 text-center text-13 text-fg-muted">{footer}</div>}
    </>
  );
}

export function FormError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-sm bg-danger-subtle px-3 py-2 text-13 text-danger-text">
      {children}
    </p>
  );
}

export function FormNotice({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="rounded-sm bg-accent-subtle px-3 py-2 text-13 text-accent-text">
      {children}
    </p>
  );
}

export function ConfigMissing() {
  return (
    <FormError>
      Sign-in isn&apos;t configured for this environment. Set NEXT_PUBLIC_SUPABASE_URL and
      NEXT_PUBLIC_SUPABASE_ANON_KEY.
    </FormError>
  );
}
