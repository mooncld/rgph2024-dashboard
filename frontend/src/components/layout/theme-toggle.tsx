"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      className="glass-panel flex h-11 w-11 items-center justify-center rounded-full text-muted hover:text-foreground transition-colors shrink-0"
      aria-label="Basculer le thème"
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
