import type { Metadata } from "next";
import { MessagesIndex } from "@/features/messages/messages-index";

export const metadata: Metadata = { title: "Messages" };

export default function MessagesPage() {
  return <MessagesIndex />;
}
