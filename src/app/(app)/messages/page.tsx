import { MessagesSquare } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/ui/empty-state";

export const metadata: Metadata = { title: "Messages" };

export default function MessagesPage() {
  return (
    <div className="hidden h-full items-center justify-center md:flex">
      <EmptyState
        icon={MessagesSquare}
        title="Pick a conversation"
        description="Choose a channel or direct message on the left to read and reply."
      />
    </div>
  );
}
