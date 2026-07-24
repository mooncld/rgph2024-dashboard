"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { GeoPicker } from "@/components/geo/geo-picker";
import { AgePyramidChart } from "@/components/charts/age-pyramid-chart";
import { TreemapChart } from "@/components/charts/treemap-chart";
import { RadarChartPanel } from "@/components/charts/radar-chart";
import { useIndicatorCatalog } from "@/lib/indicators";
import { cn } from "@/lib/utils";

export default function VisualisationsPage() {
  const { rates, breakdowns, loading: catalogLoading } = useIndicatorCatalog();
  const [geo, setGeo] = useState({ geoCode: "NATIONAL", geoName: "Maroc", geoLevel: "National" });
  const [milieu, setMilieu] = useState<"ensemble" | "urbain" | "rural">("ensemble");
  const [breakdownCategory, setBreakdownCategory] = useState<string | null>(null);

  const [pyramid, setPyramid] = useState<{ band: string; hommes: number; femmes: number }[]>([]);
  const [treemapData, setTreemapData] = useState<{ sublabel: string; percentage: number; exact_value: number | null }[]>([]);
  const [radarSelected, setRadarSelected] = useState<number[]>([]);
  const [radarNational, setRadarNational] = useState<number[]>([]);
  const [loading, setLoading] = useState({ pyramid: true, treemap: true, radar: true });

  const breakdown = breakdowns.find((b) => b.category === breakdownCategory) ?? breakdowns[0];

  useEffect(() => {
    setLoading((l) => ({ ...l, pyramid: true }));
    api
      .agePyramid(geo.geoCode, milieu)
      .then(setPyramid)
      .finally(() => setLoading((l) => ({ ...l, pyramid: false })));
  }, [geo.geoCode, milieu]);

  useEffect(() => {
    if (!breakdown) return;
    setLoading((l) => ({ ...l, treemap: true }));
    api
      .breakdown(breakdown.category, geo.geoCode, milieu, "ensemble", breakdown.group)
      .then(setTreemapData)
      .finally(() => setLoading((l) => ({ ...l, treemap: false })));
  }, [breakdown, geo.geoCode, milieu]);

  useEffect(() => {
    if (rates.length === 0) return;
    setLoading((l) => ({ ...l, radar: true }));
    Promise.all(
      rates.map((r) =>
        Promise.all([
          api.explore({ category: r.category, is_rate: true, geo: [geo.geoCode], milieu }),
          api.explore({ category: r.category, is_rate: true, geo: ["NATIONAL"], milieu }),
        ])
      )
    )
      .then((results) => {
        setRadarSelected(results.map(([sel]) => sel.percentage ?? 0));
        setRadarNational(results.map(([, nat]) => nat.percentage ?? 0));
      })
      .finally(() => setLoading((l) => ({ ...l, radar: false })));
  }, [rates, geo.geoCode, milieu]);

  const radarIndicators = useMemo(() => rates.map((r) => ({ name: r.category.replace(/\s*\(%\)$/, ""), max: 100 })), [rates]);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <motion.h1 initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Visualisations <span className="text-gradient">avancées</span> — {geo.geoName}
          </motion.h1>
          <p className="text-sm text-muted mt-1">Pyramide des âges, composition et profil comparatif.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="glass-panel flex rounded-full p-1 text-sm">
            {(["ensemble", "urbain", "rural"] as const).map((m) => (
              <button key={m} onClick={() => setMilieu(m)} className={cn("rounded-full px-3 py-1.5 capitalize transition-colors", milieu === m ? "bg-accent text-white" : "text-muted")}>
                {m}
              </button>
            ))}
          </div>
          <GeoPicker value={geo} onChange={setGeo} />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="glass-panel rounded-2xl p-4">
          <p className="text-sm font-medium mb-3">Pyramide des âges</p>
          {loading.pyramid ? (
            <div className="h-[460px] flex items-center justify-center text-sm text-muted">Chargement…</div>
          ) : (
            <AgePyramidChart data={pyramid} />
          )}
        </div>

        <div className="glass-panel rounded-2xl p-4">
          <p className="text-sm font-medium mb-3">Profil comparatif — {geo.geoName} vs Maroc</p>
          {loading.radar || radarIndicators.length === 0 ? (
            <div className="h-[420px] flex items-center justify-center text-sm text-muted">Chargement…</div>
          ) : (
            <RadarChartPanel
              indicators={radarIndicators}
              selectedValues={radarSelected}
              nationalValues={radarNational}
              selectedLabel={geo.geoName}
            />
          )}
        </div>

        <div className="glass-panel rounded-2xl p-4 xl:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium">Composition — {breakdown?.category}</p>
            <select
              value={breakdown?.category ?? ""}
              onChange={(e) => setBreakdownCategory(e.target.value)}
              disabled={catalogLoading}
              className="rounded-full bg-foreground/5 px-4 py-1.5 text-sm outline-none cursor-pointer max-w-[280px]"
            >
              <optgroup label="Population">
                {breakdowns.filter((b) => b.group === "population").map((b) => (
                  <option key={b.category} value={b.category}>
                    {b.category}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Ménages / Logement">
                {breakdowns.filter((b) => b.group === "menages").map((b) => (
                  <option key={b.category} value={b.category}>
                    {b.category}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
          {loading.treemap ? (
            <div className="h-[420px] flex items-center justify-center text-sm text-muted">Chargement…</div>
          ) : treemapData.length === 0 ? (
            <div className="h-[420px] flex items-center justify-center text-sm text-muted">Aucune donnée disponible.</div>
          ) : (
            <TreemapChart data={treemapData} />
          )}
        </div>
      </div>
    </div>
  );
}
