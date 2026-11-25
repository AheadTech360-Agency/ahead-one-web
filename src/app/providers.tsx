"use client";

import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { ThemeProvider } from "next-themes";
import { useState } from "react";
import { makeQueryClient } from "@/lib/api/query-client";
import { createQueryPersister, BUSTER } from "@/lib/cache/persister";
import { PERSIST_MAX_AGE_MS, shouldPersistQuery } from "@/lib/cache/policy";
import { CacheScopeGuard } from "@/lib/cache/scope-guard";
import { Toaster } from "@/ui/toaster";
import { TooltipProvider } from "@/ui/tooltip";

const persistOptions = {
  maxAge: PERSIST_MAX_AGE_MS,
  buster: BUSTER,
  dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
};

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  const persister = useState(createQueryPersister)[0];
  return (
    <ThemeProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="ahead-one.theme"
    >
      <PersistQueryClientProvider client={queryClient} persistOptions={{ ...persistOptions, persister }}>
        <CacheScopeGuard />
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </PersistQueryClientProvider>
    </ThemeProvider>
  );
}
