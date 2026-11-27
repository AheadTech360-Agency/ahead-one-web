import { BrandMark } from "@/ui/brand-mark";

/*
 * Signed-in pages that are not part of the app shell (the OAuth consent screen). The proxy sends a
 * signed-out visitor to /login?next=<this page>, and the login form returns them here through
 * safeNext. No sidebar, no realtime, nothing that reads workspace data.
 */
export default function FocusLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="flex items-center gap-2.5 px-5 py-4 sm:px-8">
        <BrandMark className="size-6" />
        <span className="font-display text-16 font-semibold tracking-[-0.01em] text-fg">AheadOne</span>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-12 pt-2 sm:items-center sm:pt-0">{children}</main>
    </div>
  );
}
