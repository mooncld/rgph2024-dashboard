"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { GeoPicker } from "@/components/geo/geo-picker";
import { AgePyramidChart } from "@/components/charts/age-pyramid-chart";
import { TreemapChart } from "@/components/charts/treemap-chart";
import { RadarChartPanel } from "@/components/charts/radar-chart";
import { cn } from "@/lib/utils";

const BREAKDOWN_CATEGORIES = [
  { category: "Type de logement (%)", group: "menages", label: "Type de logement" },
  { category: "Statut d'occupation du logement (%)", group: "menages", label: "Statut d'occupation du logement" },
  { category: "Statut professionnel des actifs occupés de 15 ans et plus (%)", group: "population", label: "Statut professionnel des actifs occupés" },
  { category: "Niveau d'études dans l'enseignement général (%)", group: "population", label: "Niveau d'études" },
  { category: "État matrimonial des 15 ans et plus (%)", group: "population", label: "État matrimonial (15 ans et +)" },
];

const RADAR_INDICATORS = [
  { name: "Chômage", category: "Taux de chômage (%)", max: 40 },
  { name: "Analphabétisme", category: "Taux d'analphabétisme des 15 ans et plus (%)", max: 60 },
  { name: "Activité", category: "Taux d'activité des 15 ans et plus (%)", max: 70 },
  { name: "Scolarisation 6-11 ans", category: "Taux de scolarisation des 6-11 ans en 2023/2024 (%)", max: 100 },
  { name: "Prévalence handicap", category: "Taux de prévalence du handicap (%)", max: 10 },
];

export default function VisualisationsPage() {
  const [geo, setGeo] = useState({ geoCode: "NATIONAL", geoName: "Maroc", geoLevel: "National" });
  const [milieu, setMilieu] = useState<"ensemble" | "urbain" | "rural">("ensemble");
  const [breakdownIdx, setBreakdownIdx] = useState(0);

  const [pyramid, setPyramid] = useState<{ band: string; hommes: number; femmes: number }[]>([]);
  const [treemapData, setTreemapData] = useState<{ sublabel: string; percentage: number; exact_value: number | null }[]>([]);
  const [radarSelected, setRadarSelected] = useState<number[]>([]);
  const [radarNational, setRadarNational] = useState<number[]>([]);
  const [loading, setLoading] = useState({ pyramid: true, treemap: true, radar: true });

  const breakdown = BREAKDOWN_CATEGORIES[breakdownIdx];

  useEffect(() => {
    setLoading((l) => ({ ...l, pyramid: true }));
    api
      .agePyramid(geo.geoCode, milieu)
      .then(setPyramid)
      .finally(() => setLoading((l) => ({ ...l, pyramid: false })));
  }, [geo.geoCode, milieu]);

  useEffect(() => {
    setLoading((l) => ({ ...l, treemap: true }));
    api
      .breakdown(breakdown.category, geo.geoCode, milieu, "ensemble", breakdown.group)
      .then(setTreemapData)
      .finally(() => setLoading((l) => ({ ...l, treemap: false })));
  }, [breakdown.category, breakdown.group, geo.geoCode, milieu]);

  useEffect(() => {
    setLoading((l) => ({ ...l, radar: true }));
    Promise.all(
      RADAR_INDICATORS.map((ind) =>
        Promise.all([
          api.explore({ category: ind.category, is_rate: true, geo: [geo.geoCode], milieu }),
          api.explore({ category: ind.category, is_rate: true, geo: ["NATIONAL"], milieu }),
        ])
      )
    )
      .then((results) => {
        setRadarSelected(results.map(([sel]) => sel.percentage ?? 0));
        setRadarNational(results.map(([, nat]) => nat.percentage ?? 0));
      })
      .finally(() => setLoading((l) => ({ ...l, radar: false })));
  }, [geo.geoCode, milieu]);

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
          {loading.radar ? (
            <div className="h-[420px] flex items-center justify-center text-sm text-muted">Chargement…</div>
          ) : (
            <RadarChartPanel
              indicators={RADAR_INDICATORS.map((r) => ({ name: r.name, max: r.max }))}
              selectedValues={radarSelected}
              nationalValues={radarNational}
              selectedLabel={geo.geoName}
            />
          )}
        </div>

        <div className="glass-panel rounded-2xl p-4 xl:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium">Composition — {breakdown.label}</p>
            <select
              value={breakdownIdx}
              onChange={(e) => setBreakdownIdx(Number(e.target.value))}
              className="rounded-full bg-foreground/5 px-4 py-1.5 text-sm outline-none cursor-pointer"
            >
              {BREAKDOWN_CATEGORIES.map((b, i) => (
                <option key={b.category} value={i}>
                  {b.label}
                </option>
              ))}
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
