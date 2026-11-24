import { MessagesPane } from "@/features/messages/messages-pane";

/** Split pane: conversation list on the left, the open conversation on the right. */
export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid h-full grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] md:grid-cols-[300px_minmax(0,1fr)]">
      <MessagesPane />
      <div className="min-h-0 min-w-0">{children}</div>
    </div>
  );
}
