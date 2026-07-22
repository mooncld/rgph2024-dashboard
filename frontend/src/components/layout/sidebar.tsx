"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { LayoutDashboard, Map, SlidersHorizontal, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AuthorCard } from "./author-card";

const NAV_ITEMS = [
  { href: "/", label: "Vue exécutive", icon: LayoutDashboard },
  { href: "/carte", label: "Module SIG", icon: Map },
  { href: "/explorateur", label: "Explorateur universel", icon: SlidersHorizontal },
  { href: "/visualisations", label: "Visualisations", icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col gap-6 border-r border-white/5 p-5 overflow-y-auto">
      <Link href="/" className="flex items-center gap-2 px-1">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-accent to-accent-2 flex items-center justify-center text-white font-bold text-sm shadow-lg">
          R24
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">RGPH 2024</p>
          <p className="text-xs text-muted">Plateforme analytique</p>
        </div>
      </Link>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} className="relative">
              {active && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-accent/15 to-accent-2/10 border border-accent/20"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
              <div
                className={cn(
                  "relative z-10 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "text-foreground" : "text-muted hover:text-foreground"
                )}
              >
                <item.icon size={18} strokeWidth={2} />
                {item.label}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        <AuthorCard />
        <div className="glass-panel rounded-xl p-3 text-xs text-muted leading-relaxed">
          Recensement Général de la Population et de l&apos;Habitat 2024 — Haut-Commissariat au Plan.
        </div>
      </div>
    </aside>
  );
}
