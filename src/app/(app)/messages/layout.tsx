import { ConversationsPane } from "./conversations-pane";

/** Split pane: conversation list on the left, the open conversation on the right. */
export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid h-full md:grid-cols-[280px_minmax(0,1fr)]">
      <ConversationsPane />
      <div className="min-h-0 min-w-0">{children}</div>
    </div>
  );
}
