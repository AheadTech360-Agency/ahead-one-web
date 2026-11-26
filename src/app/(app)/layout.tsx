import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { MessagesDialogs } from "@/features/messages/dialogs";
import { LiveNotificationToasts } from "@/features/notifications/live-toasts";
import { PushLoginPrompt, PushSync } from "@/features/push/push-controls";
import { ConnectionBanner, UnreadIndicator } from "@/features/realtime/connection-ui";
import { RealtimeProvider } from "@/features/realtime/provider";
import { Skeleton } from "@/ui/skeleton";

/**
 * The shell reads the URL (active nav, breadcrumbs), which Cache Components treats as
 * runtime data on dynamic routes, so it streams in behind a frame-shaped fallback.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <RealtimeProvider>
        <AppShell>
          {children}
          <MessagesDialogs />
          <LiveNotificationToasts />
          <ConnectionBanner />
          <UnreadIndicator />
          <PushSync />
          <PushLoginPrompt />
        </AppShell>
      </RealtimeProvider>
    </Suspense>
  );
}

function ShellFallback() {
  return (
    <div className="flex h-dvh bg-bg" role="status" aria-label="Loading AheadOne">
      <div className="hidden w-[var(--sidebar-w)] shrink-0 flex-col gap-2 p-3 md:flex" aria-hidden>
        <div className="flex items-center gap-2 px-1 pb-3">
          <Skeleton className="size-6 rounded-sm" />
          <Skeleton className="h-3 w-28" />
        </div>
        {[60, 52, 44].map((w, i) => (
          <Skeleton key={i} className="mx-1 h-3" style={{ width: `${w}%` }} />
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-[var(--topbar-h)]" />
        <div className="flex-1 border-t border-border bg-surface md:mb-2 md:mr-2 md:rounded-lg md:border" />
      </div>
    </div>
  );
}
