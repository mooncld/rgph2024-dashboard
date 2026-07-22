"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Info } from "lucide-react";
import { AnimatedCounter } from "./animated-counter";
import { cn, formatPercent } from "@/lib/utils";

interface KpiCardProps {
  icon: LucideIcon;
  title: string;
  exactValue: number | null;
  percentage?: number | null;
  calculationMethod?: string;
  accent?: "accent" | "accent-2" | "accent-3" | "success" | "warning" | "danger";
  index?: number;
}

const ACCENT_GRADIENTS: Record<string, string> = {
  accent: "from-accent to-accent-2",
  "accent-2": "from-accent-2 to-accent-3",
  "accent-3": "from-accent-3 to-accent",
  success: "from-success to-accent-3",
  warning: "from-warning to-danger",
  danger: "from-danger to-accent-2",
};

export function KpiCard({ icon: Icon, title, exactValue, percentage, calculationMethod, accent = "accent", index = 0 }: KpiCardProps) {
  const [showMethod, setShowMethod] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -4 }}
      className="glass-panel relative rounded-2xl p-5 flex flex-col gap-3 overflow-hidden group"
    >
      <div
        className={cn(
          "absolute -top-10 -right-10 h-28 w-28 rounded-full bg-gradient-to-br opacity-20 blur-2xl transition-opacity group-hover:opacity-35",
          ACCENT_GRADIENTS[accent]
        )}
      />
      <div className="flex items-start justify-between relative z-10">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg", ACCENT_GRADIENTS[accent])}>
          <Icon size={20} strokeWidth={2.25} />
        </div>
        {calculationMethod && (
          <button
            onClick={() => setShowMethod((v) => !v)}
            className="text-muted hover:text-foreground transition-colors"
            aria-label="Méthode de calcul"
          >
            <Info size={16} />
          </button>
        )}
      </div>

      <div className="relative z-10">
        <p className="text-sm text-muted font-medium">{title}</p>
        <div className="text-2xl font-semibold tracking-tight mt-1 tabular-nums">
          {exactValue !== null ? <AnimatedCounter value={exactValue} /> : "—"}
        </div>
        {percentage !== null && percentage !== undefined && (
          <p className="text-sm text-muted mt-0.5 tabular-nums">{formatPercent(percentage)}</p>
        )}
      </div>

      {showMethod && calculationMethod && (
        <motion.p
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="relative z-10 text-xs text-muted leading-relaxed border-t border-white/10 pt-2 mt-1"
        >
          {calculationMethod}
        </motion.p>
      )}
    </motion.div>
  );
}
