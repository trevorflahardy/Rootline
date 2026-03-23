"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <TooltipProvider>
        {children}
        <Toaster
          richColors
          position="bottom-right"
          toastOptions={{
            className: "glass-card glass-light border-[var(--glass-border-subtle)] backdrop-blur-xl",
            style: {
              background: "var(--glass-bg)",
              borderLeft: "3px solid var(--primary)",
            },
          }}
        />
      </TooltipProvider>
    </NextThemesProvider>
  );
}
