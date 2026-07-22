"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { MapPin, ArrowRight } from "lucide-react";
import { ChoroplethMap } from "@/components/map/choropleth-map";
import { api, type ChoroplethFeatureValue, type KpiValue } from "@/lib/api";
import { buildQuantileScale } from "@/lib/color-scale";
import { useAppStore } from "@/lib/store";
import { cn, formatNumber, formatPercent } from "@/lib/utils";
import { INDICATORS, hasNoSexeBreakdown } from "@/lib/indicators";

const LEVELS = [
  { key: "Région", label: "Régions", geojson: "/geojson/morocco_regions.geojson" },
  { key: "Préfecture/Province", label: "Préfectures / Provinces", geojson: "/geojson/morocco_provinces.geojson" },
];

export default function CartePage() {
  const router = useRouter();
  const { setGeo, milieu, sexe, setMilieu, setSexe } = useAppStore();
  const [indicatorKey, setIndicatorKey] = useState("chomage");
  const [levelKey, setLevelKey] = useState(LEVELS[0].key);
  const [values, setValues] = useState<ChoroplethFeatureValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<{ code: string; name: string } | null>(null);
  const [selectedKpi, setSelectedKpi] = useState<KpiValue | null>(null);

  const indicator = INDICATORS.find((i) => i.key === indicatorKey)!;
  const level = LEVELS.find((l) => l.key === levelKey)!;
  // "Population légale" and "Ménages" have no Homme/Femme breakdown in the
  // source data — force "ensemble" for them regardless of the global toggle.
  const effectiveSexe = hasNoSexeBreakdown(indicator) ? "ensemble" : sexe;

  useEffect(() => {
    setLoading(true);
    api
      .choropleth({ category: indicator.category, level: level.key, milieu, sexe: effectiveSexe, group: indicator.group })
      .then(setValues)
      .catch(() => setValues([]))
      .finally(() => setLoading(false));
  }, [indicator.category, indicator.group, level.key, milieu, effectiveSexe]);

  const scale = useMemo(() => buildQuantileScale(values.map((v) => v.value).filter((v): v is number => v !== null)), [values]);

  useEffect(() => {
    if (!selected) return;
    api.explore({
      category: indicator.category,
      group: indicator.group,
      is_rate: indicator.isRate,
      geo: [selected.code],
      milieu,
      sexe: effectiveSexe,
    }).then(setSelectedKpi).catch(() => setSelectedKpi(null));
  }, [selected, indicator.category, indicator.group, indicator.isRate, milieu, effectiveSexe]);

  return (
    <div className="mx-auto max-w-7xl h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <motion.h1 initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Module SIG <span className="text-gradient">— Cartographie interactive</span>
          </motion.h1>
          <p className="text-sm text-muted mt-1">Cliquez une zone pour l&apos;explorer dans la Vue exécutive.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={indicatorKey}
            onChange={(e) => setIndicatorKey(e.target.value)}
            className="glass-panel rounded-full px-4 py-2 text-sm outline-none cursor-pointer"
          >
            {INDICATORS.map((i) => (
              <option key={i.key} value={i.key}>
                {i.label}
              </option>
            ))}
          </select>
          <select
            value={levelKey}
            onChange={(e) => setLevelKey(e.target.value)}
            className="glass-panel rounded-full px-4 py-2 text-sm outline-none cursor-pointer"
          >
            {LEVELS.map((l) => (
              <option key={l.key} value={l.key}>
                {l.label}
              </option>
            ))}
          </select>
          <div className="glass-panel flex rounded-full p-1 text-sm">
            {(["ensemble", "urbain", "rural"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMilieu(m)}
                className={cn("rounded-full px-3 py-1.5 capitalize transition-colors", milieu === m ? "bg-accent text-white" : "text-muted")}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="glass-panel flex rounded-full p-1 text-sm">
            {(["ensemble", "masculin", "feminin"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSexe(s)}
                className={cn("rounded-full px-3 py-1.5 capitalize transition-colors", sexe === s ? "bg-accent text-white" : "text-muted")}
              >
                {s === "ensemble" ? "Ensemble" : s === "masculin" ? "Hommes" : "Femmes"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative flex-1 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 min-h-0">
        <div className="glass-panel rounded-2xl overflow-hidden relative min-h-[400px]">
          {loading && <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/40 text-sm text-muted">Chargement…</div>}
          <ChoroplethMap
            geojsonUrl={level.geojson}
            values={values}
            scale={scale}
            isRate={indicator.isRate}
            onSelect={(code, name) => setSelected({ code, name })}
          />
        </div>

        <div className="flex flex-col gap-4 min-h-0 overflow-y-auto">
          <div className="glass-panel rounded-2xl p-4">
            <p className="text-xs uppercase tracking-wide text-muted mb-3">Légende — {indicator.label}</p>
            <div className="flex flex-col gap-1.5">
              {scale.legend.map((l) => (
                <div key={l.label} className="flex items-center gap-2 text-sm">
                  <span className="h-3 w-3 rounded-sm shrink-0" style={{ background: l.color }} />
                  <span className="text-muted">{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          {selected && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <MapPin size={16} className="text-accent" />
                <p className="font-semibold text-sm">{selected.name}</p>
              </div>
              {selectedKpi ? (
                <>
                  <p className="text-2xl font-semibold tabular-nums">
                    {indicator.isRate ? formatPercent(selectedKpi.percentage) : formatNumber(selectedKpi.exact_value)}
                  </p>
                  {indicator.isRate && <p className="text-sm text-muted tabular-nums">{formatNumber(selectedKpi.exact_value)} exactement</p>}
                  <p className="text-xs text-muted mt-2 leading-relaxed">{selectedKpi.calculation_method}</p>
                </>
              ) : (
                <p className="text-sm text-muted">Chargement…</p>
              )}
              <button
                onClick={() => {
                  setGeo({ geoCode: selected.code, geoName: selected.name, geoLevel: level.key });
                  router.push("/");
                }}
                className="mt-3 flex items-center gap-1.5 text-sm font-medium text-accent hover:gap-2.5 transition-all"
              >
                Explorer cette zone <ArrowRight size={14} />
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
