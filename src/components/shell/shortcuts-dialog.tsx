"use client";

import { useSyncExternalStore } from "react";
import { isMac } from "@/lib/utils";
import { Dialog, DialogBody, DialogContent } from "@/ui/dialog";
import { KbdCombo } from "@/ui/kbd";
import { GOTO, useShell } from "./shell-context";

const noopSubscribe = () => () => {};
function useModKey() {
  return useSyncExternalStore(noopSubscribe, () => (isMac() ? "⌘" : "Ctrl"), () => "Ctrl");
}

export function ShortcutsDialog() {
  const { shortcutsOpen, setShortcutsOpen } = useShell();
  const mod = useModKey();
  const groups: { title: string; rows: { label: string; keys: string[] }[] }[] = [
    {
      title: "General",
      rows: [
        { label: "Open command menu", keys: [mod, "K"] },
        { label: "Search tasks", keys: ["/"] },
        { label: "Create task", keys: ["C"] },
        { label: "Show or hide sidebar", keys: ["["] },
        { label: "Switch light and dark theme", keys: ["Shift", "T"] },
        { label: "Show keyboard shortcuts", keys: ["?"] },
      ],
    },
    {
      title: "Go to",
      rows: Object.entries(GOTO).map(([k, v]) => ({ label: v.label, keys: ["G", k.toUpperCase()] })),
    },
  ];

  return (
    <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
      <DialogContent title="Keyboard shortcuts" size="md">
        <DialogBody className="grid gap-6 pb-5 sm:grid-cols-2">
          {groups.map((g) => (
            <section key={g.title}>
              <h3 className="pb-2 text-12 font-medium text-fg-muted">{g.title}</h3>
              <dl className="flex flex-col">
                {g.rows.map((r) => (
                  <div
                    key={r.label}
                    className="flex h-8 items-center justify-between gap-4 border-b border-border-subtle last:border-0"
                  >
                    <dt className="text-13 text-fg">{r.label}</dt>
                    <dd>
                      <KbdCombo keys={r.keys} />
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
