"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import React, { useState } from "react";
import { Toaster } from "~/components/ui/sonner";

import { trpc } from "~/trpc/client";
import { createTRPCHttpBatchClientClient } from "~/trpc/create-client";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnMount: true,
      staleTime: Infinity,
    },
  },
});

export const GlobalProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [createTRPCHttpBatchClientClient()],
    }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <NextThemesProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem
        disableTransitionOnChange
      >
        <trpc.Provider queryClient={queryClient} client={trpcClient}>
          {children}
          {/* Lift bottom toasts above the floating VelocityAI assistant launcher
              (size-14 at bottom-6) so the persistent unverified-email prompt
              doesn't sit behind it. */}
          <Toaster offset={{ bottom: "96px", right: "24px" }} />
        </trpc.Provider>
      </NextThemesProvider>
    </QueryClientProvider>
  );
};
