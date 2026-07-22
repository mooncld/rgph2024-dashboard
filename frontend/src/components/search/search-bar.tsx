"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, Sparkles, TrendingUp, Clock, X } from "lucide-react";
import { api, type SearchResponse } from "@/lib/api";
import { cn, formatNumber, formatPercent } from "@/lib/utils";

const HISTORY_KEY = "rgph-search-history";

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.searchSuggestions().then(setSuggestions).catch(() => setSuggestions([]));
    try {
      const stored = JSON.parse(window.localStorage.getItem(HISTORY_KEY) ?? "[]");
      if (Array.isArray(stored)) setHistory(stored);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function runSearch(q: string) {
    if (!q.trim()) return;
    setLoading(true);
    setOpen(true);
    try {
      const res = await api.search(q);
      setResult(res);
      const nextHistory = [q, ...history.filter((h) => h !== q)].slice(0, 6);
      setHistory(nextHistory);
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
    } catch {
      setResult({ query: q, understood: false, message: "Erreur de connexion à l'API." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => e.key === "Enter" && runSearch(query)}
          placeholder="Ex: Taux de chômage des femmes dans la région Souss-Massa…"
          className="glass-panel w-full rounded-full py-3 pl-11 pr-10 text-sm outline-none focus:ring-2 focus:ring-accent/50 transition-shadow"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setResult(null);
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="glass-panel-solid absolute z-50 mt-2 w-full rounded-2xl p-4 max-h-[70vh] overflow-y-auto"
          >
            {loading && <p className="text-sm text-muted px-1">Recherche en cours…</p>}

            {!loading && result && (
              <div className="mb-4">
                {result.understood ? (
                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between gap-4">
                      <p className="text-sm text-muted">{result.result?.label}</p>
                      {result.result?.percentage != null && (
                        <span className="text-sm font-semibold text-accent">{formatPercent(result.result.percentage)}</span>
                      )}
                    </div>
                    <p className="text-3xl font-semibold tabular-nums">
                      {result.result?.exact_value != null ? formatNumber(result.result.exact_value) : "—"}
                    </p>
                    {result.result?.calculation_method && (
                      <p className="text-xs text-muted leading-relaxed">{result.result.calculation_method}</p>
                    )}
                    {result.insight?.insight && (
                      <div className="flex items-start gap-2 rounded-xl bg-accent/10 p-3 mt-2">
                        <Sparkles size={16} className="text-accent mt-0.5 shrink-0" />
                        <p className="text-xs leading-relaxed">{result.insight.insight}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted">{result.message}</p>
                )}
              </div>
            )}

            {!result && history.length > 0 && (
              <div className="mb-3">
                <p className="text-xs uppercase tracking-wide text-muted mb-2 flex items-center gap-1">
                  <Clock size={12} /> Historique
                </p>
                <div className="flex flex-col gap-1">
                  {history.map((h) => (
                    <button
                      key={h}
                      onClick={() => {
                        setQuery(h);
                        runSearch(h);
                      }}
                      className="text-left text-sm rounded-lg px-2 py-1.5 hover:bg-foreground/5 transition-colors"
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-xs uppercase tracking-wide text-muted mb-2 flex items-center gap-1">
                <TrendingUp size={12} /> Suggestions
              </p>
              <div className="flex flex-col gap-1">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setQuery(s);
                      runSearch(s);
                    }}
                    className={cn(
                      "text-left text-sm rounded-lg px-2 py-1.5 hover:bg-foreground/5 transition-colors",
                      "text-foreground/90"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
