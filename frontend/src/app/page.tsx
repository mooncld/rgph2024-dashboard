"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, Home, Briefcase, GraduationCap, Building2, Trees, Venus, Mars, Sparkles } from "lucide-react";
import { api, type ExecutiveKpis } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { KpiCard } from "@/components/kpi/kpi-card";
import { GeoPicker } from "@/components/geo/geo-picker";

export default function ExecutiveViewPage() {
  const { geo } = useAppStore();
  const [kpis, setKpis] = useState<ExecutiveKpis | null>(null);
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .executiveKpis(geo.geoCode)
      .then(setKpis)
      .finally(() => setLoading(false));

    if (geo.geoCode !== "NATIONAL") {
      api
        .insights("Taux de chômage (%)", geo.geoCode)
        .then((r) => setInsight((r as { insight?: string }).insight ?? null))
        .catch(() => setInsight(null));
    } else {
      setInsight(null);
    }
  }, [geo.geoCode]);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl sm:text-3xl font-semibold tracking-tight"
          >
            Vue exécutive <span className="text-gradient">— {geo.geoName}</span>
          </motion.h1>
          <p className="text-sm text-muted mt-1">Recensement Général de la Population et de l&apos;Habitat 2024</p>
        </div>
        <GeoPicker />
      </div>

      {insight && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel mb-6 flex items-start gap-3 rounded-2xl p-4"
        >
          <Sparkles size={18} className="text-accent-2 mt-0.5 shrink-0" />
          <p className="text-sm leading-relaxed">{insight}</p>
        </motion.div>
      )}

      {loading || !kpis ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="glass-panel h-32 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            index={0}
            icon={Users}
            title="Population totale"
            exactValue={kpis.population_totale.exact_value}
            calculationMethod={kpis.population_totale.calculation_method}
            accent="accent"
          />
          <KpiCard
            index={1}
            icon={Home}
            title="Ménages"
            exactValue={kpis.menages.exact_value}
            calculationMethod={kpis.menages.calculation_method}
            accent="accent-3"
          />
          <KpiCard
            index={2}
            icon={Briefcase}
            title="Chômeurs (taux de chômage)"
            exactValue={kpis.taux_chomage.exact_value}
            percentage={kpis.taux_chomage.percentage}
            calculationMethod={kpis.taux_chomage.calculation_method}
            accent="warning"
          />
          <KpiCard
            index={3}
            icon={GraduationCap}
            title="Alphabétisation (15 ans et +)"
            exactValue={kpis.taux_alphabetisation.exact_value}
            percentage={kpis.taux_alphabetisation.percentage}
            calculationMethod={kpis.taux_alphabetisation.calculation_method}
            accent="success"
          />
          <KpiCard
            index={4}
            icon={Building2}
            title="Population urbaine"
            exactValue={kpis.population_urbaine.exact_value}
            calculationMethod={kpis.population_urbaine.calculation_method}
            accent="accent"
          />
          <KpiCard
            index={5}
            icon={Trees}
            title="Population rurale"
            exactValue={kpis.population_rurale.exact_value}
            calculationMethod={kpis.population_rurale.calculation_method}
            accent="accent-3"
          />
          <KpiCard
            index={6}
            icon={Mars}
            title="Hommes"
            exactValue={kpis.hommes.exact_value}
            calculationMethod={kpis.hommes.calculation_method}
            accent="accent-2"
          />
          <KpiCard
            index={7}
            icon={Venus}
            title="Femmes"
            exactValue={kpis.femmes.exact_value}
            calculationMethod={kpis.femmes.calculation_method}
            accent="danger"
          />
        </div>
      )}
    </div>
  );
}
