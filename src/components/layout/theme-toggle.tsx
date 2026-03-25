"use client";

import type { MouseEvent } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

type ViewTransitionCapableDocument = Document & {
  startViewTransition?: (callback: () => void) => {
    finished: Promise<void>;
  };
};

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();

  function setThemeWithDroplet(event: MouseEvent<HTMLButtonElement>) {
    const nextTheme = resolvedTheme === "dark" ? "light" : "dark";
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const viewTransitionDocument = document as ViewTransitionCapableDocument;

    if (prefersReducedMotion || !viewTransitionDocument.startViewTransition) {
      setTheme(nextTheme);
      return;
    }

    const root = document.documentElement;
    const x = event.clientX || window.innerWidth / 2;
    const y = event.clientY || window.innerHeight / 2;
    const maxX = Math.max(x, window.innerWidth - x);
    const maxY = Math.max(y, window.innerHeight - y);
    const radius = Math.hypot(maxX, maxY);

    root.style.setProperty("--theme-transition-x", `${x}px`);
    root.style.setProperty("--theme-transition-y", `${y}px`);
    root.style.setProperty("--theme-transition-radius", `${radius}px`);
    root.classList.add("theme-transition-active");

    const transition = viewTransitionDocument.startViewTransition(() => {
      setTheme(nextTheme);
    });

    transition.finished.finally(() => {
      root.classList.remove("theme-transition-active");
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={setThemeWithDroplet}
      aria-label="Toggle theme"
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  );
}
