"use client";

import { MessagesSquare } from "lucide-react";
import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/empty-state";
import { Kbd } from "@/ui/kbd";
import { openMessagesDialog } from "./stores";

/** Right pane with nothing open (desktop only; phones show the list full width). */
export function MessagesIndex() {
  return (
    <div className="hidden h-full flex-col items-center justify-center md:flex">
      <EmptyState
        icon={MessagesSquare}
        title="Pick a conversation"
        description={
          <>
            Choose a channel or direct message on the left, or start a new one. Press <Kbd>Alt</Kbd> <Kbd>↓</Kbd> to
            step through conversations.
          </>
        }
        action={
          <>
            <Button variant="primary" onClick={() => openMessagesDialog("dm")}>
              New message
            </Button>
            <Button onClick={() => openMessagesDialog("channel")}>Create a channel</Button>
          </>
        }
      />
    </div>
  );
}
