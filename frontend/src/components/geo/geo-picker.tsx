"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, MapPin } from "lucide-react";
import { api, type GeoNode } from "@/lib/api";
import { useAppStore } from "@/lib/store";

interface GeoValue {
  geoCode: string;
  geoName: string;
  geoLevel: string;
}

interface GeoPickerProps {
  /** Controlled mode: pass value + onChange to manage selection locally
   * (e.g. a page-scoped "parent" filter). Omit both to fall back to the
   * shared app-wide geo selection (Vue exécutive). */
  value?: GeoValue;
  onChange?: (geo: GeoValue) => void;
  placeholder?: string;
}

export function GeoPicker({ value, onChange, placeholder = "Rechercher une région, province, commune…" }: GeoPickerProps) {
  const store = useAppStore();
  const geo = value ?? store.geo;
  const setGeo = onChange ?? store.setGeo;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<(GeoNode & { score: number })[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      api.geoSearch(query).then(setResults).catch(() => setResults([]));
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="glass-panel flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
      >
        <MapPin size={16} className="text-accent" />
        {geo.geoName}
        <ChevronDown size={14} className="text-muted" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="glass-panel-solid absolute right-0 z-50 mt-2 w-80 rounded-2xl p-3"
          >
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="w-full rounded-lg bg-foreground/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
            />
            <div className="mt-2 max-h-72 overflow-y-auto flex flex-col gap-0.5">
              <button
                onClick={() => {
                  setGeo({ geoCode: "NATIONAL", geoName: "Maroc", geoLevel: "National" });
                  setOpen(false);
                  setQuery("");
                }}
                className="text-left rounded-lg px-2 py-1.5 text-sm hover:bg-foreground/5 flex items-center justify-between"
              >
                <span>Maroc (national)</span>
                <span className="text-xs text-muted">Tout le pays</span>
              </button>
              {results.map((r) => (
                <button
                  key={r.geo_code}
                  onClick={() => {
                    setGeo({ geoCode: r.geo_code, geoName: r.geo_name, geoLevel: r.geo_level });
                    setOpen(false);
                    setQuery("");
                  }}
                  className="text-left rounded-lg px-2 py-1.5 text-sm hover:bg-foreground/5 flex items-center justify-between"
                >
                  <span>{r.geo_name}</span>
                  <span className="text-xs text-muted">{r.geo_level}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
