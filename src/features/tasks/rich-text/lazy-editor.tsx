"use client";

import dynamic from "next/dynamic";
import type { ComponentProps, Ref } from "react";
import { cn } from "@/lib/utils";
import type { RichTextEditor as Impl, RichTextEditorHandle } from "./editor";

export type { RichTextEditorHandle };

type Props = ComponentProps<typeof Impl> & { ref?: Ref<RichTextEditorHandle> };

/**
 * Tiptap and ProseMirror are about 150 KB of gzipped JavaScript that only task screens need, so
 * the editor loads on demand. The placeholder has the editor's minimum height, so nothing shifts
 * when it arrives. `preloadEditor()` starts the download on intent (hovering a task).
 */
const load = () => import("./editor").then((m) => m.RichTextEditor);

export const RichTextEditor = dynamic(load, {
  ssr: false,
  loading: () => <div aria-hidden className={cn("min-h-10 animate-pulse rounded-xs bg-active/50")} />,
}) as unknown as (props: Props) => React.ReactElement;

export function preloadEditor() {
  void load();
}
