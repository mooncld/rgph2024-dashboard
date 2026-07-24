"use client";

import { useEffect, useMemo, useState } from "react";
import { api, type CatalogEntry } from "@/lib/api";

export const LEVELS = [
  { key: "Région", label: "Région" },
  { key: "Préfecture/Province", label: "Préfecture / Province" },
  { key: "Commune/Arrondissement", label: "Commune" },
];

// A category with no Homme/Femme breakdown in the source data (e.g. "Population
// légale", every Ménages category) — force sexe="ensemble" for it regardless of
// the user's global toggle, otherwise the backend 400s.
export function hasNoSexeBreakdown(entry: Pick<CatalogEntry, "sexe_scopes">): boolean {
  return entry.sexe_scopes.length === 1 && entry.sexe_scopes[0] === "ensemble";
}

let cached: CatalogEntry[] | null = null;
let inflight: Promise<CatalogEntry[]> | null = null;

function loadCatalog(): Promise<CatalogEntry[]> {
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    inflight = api.indicatorCatalog().then((data) => {
      cached = data;
      return data;
    });
  }
  return inflight;
}

/**
 * The full indicator catalog derived from the source workbook (219 columns,
 * every category HCP publishes) — not a hand-picked subset. Split into:
 *  - rates: a single published % with a known base (Taux de chômage (%), ...)
 *  - counts: a standalone headcount (Population légale, Ménages, ...)
 *  - breakdowns: only exists as a set of sublabels (Type de logement (%),
 *    État matrimonial..., Niveau d'études..., Langues..., ...) — meaningful as
 *    a composition (treemap), not as one number.
 */
export function useIndicatorCatalog() {
  const [catalog, setCatalog] = useState<CatalogEntry[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    if (cached) return;
    loadCatalog()
      .then(setCatalog)
      .finally(() => setLoading(false));
  }, []);

  // Stable references across renders — callers put these straight into effect
  // dependency arrays (e.g. to refetch when the selected indicator changes),
  // and a fresh array from .filter() on every render would refire those
  // effects in an infinite loop (each refetch triggers a re-render, which
  // produces a new array, which refires the effect...).
  const rates = useMemo(() => catalog.filter((c) => c.is_rate), [catalog]);
  const counts = useMemo(() => catalog.filter((c) => c.has_standalone && !c.is_rate), [catalog]);
  const breakdowns = useMemo(() => catalog.filter((c) => !c.has_standalone && !c.is_rate), [catalog]);

  return { catalog, rates, counts, breakdowns, loading };
}

export function findEntry(catalog: CatalogEntry[], category: string, group?: string): CatalogEntry | undefined {
  return catalog.find((c) => c.category === category && (!group || c.group === group));
}
