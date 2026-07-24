"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Download, FileSpreadsheet, FileText, Sparkles, X } from "lucide-react";
import { api, type ChoroplethFeatureValue, type KpiValue } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { cn, formatNumber, formatPercent } from "@/lib/utils";
import { useIndicatorCatalog, LEVELS, hasNoSexeBreakdown, findEntry } from "@/lib/indicators";
import { RankingBarChart } from "@/components/charts/ranking-bar-chart";
import { GeoPicker } from "@/components/geo/geo-picker";

const DEFAULT_CATEGORY = "Taux de chômage (%)";

export default function ExplorateurPage() {
  const { milieu, sexe, setMilieu, setSexe } = useAppStore();
  const { rates, counts, loading: catalogLoading } = useIndicatorCatalog();
  const options = useMemo(() => [...rates, ...counts], [rates, counts]);

  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const [levelKey, setLevelKey] = useState("Préfecture/Province");
  const [parent, setParent] = useState<{ code: string; name: string } | null>(null);
  const [ageMin, setAgeMin] = useState<string>("");
  const [ageMax, setAgeMax] = useState<string>("");
  const [ranking, setRanking] = useState<ChoroplethFeatureValue[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<{ code: string; name: string } | null>(null);
  const [selectedKpi, setSelectedKpi] = useState<KpiValue | null>(null);
  const [insight, setInsight] = useState<string | null>(null);

  const indicator = findEntry(options, category) ?? options[0];
  const effectiveSexe = indicator && hasNoSexeBreakdown(indicator) ? "ensemble" : sexe;
  const ageActive = ageMin !== "";

  useEffect(() => {
    if (!indicator) return;
    setLoading(true);
    setSelected(null);
    setSelectedKpi(null);
    api
      .choropleth({ category: indicator.category, level: levelKey, parent_code: parent?.code, milieu, sexe: effectiveSexe, group: indicator.group })
      .then(setRanking)
      .catch(() => setRanking([]))
      .finally(() => setLoading(false));
  }, [indicator, levelKey, parent?.code, milieu, effectiveSexe]);

  useEffect(() => {
    if (!selected || !indicator) return;
    const body = {
      category: indicator.category,
      group: indicator.group,
      is_rate: indicator.is_rate,
      geo: [selected.code],
      milieu,
      sexe: effectiveSexe,
      age_min: ageActive ? Number(ageMin) : null,
      age_max: ageMax !== "" ? Number(ageMax) : null,
    };
    api.explore(body).then(setSelectedKpi).catch(() => setSelectedKpi(null));

    if (indicator.is_rate) {
      api
        .insights(indicator.category, selected.code, milieu, effectiveSexe)
        .then((r) => setInsight((r as { insight?: string }).insight ?? null))
        .catch(() => setInsight(null));
    } else {
      setInsight(null);
    }
  }, [selected, indicator, milieu, effectiveSexe, ageActive, ageMin, ageMax]);

  const chartData = useMemo(
    () => ranking.filter((r) => r.value !== null).map((r) => ({ name: r.geo_name, value: r.value as number, code: r.geo_code })),
    [ranking]
  );

  async function handleExport(format: "csv" | "excel" | "pdf") {
    const rows = ranking.map((r) => ({
      unité: r.geo_name,
      valeur: r.value,
      effectif_exact: r.exact_value,
      pourcentage: r.percentage,
    }));
    await api.exportData(rows, format, `RGPH 2024 — ${indicator?.category ?? ""}`);
  }

  return (
    <div className="mx-auto max-w-7xl">
      <motion.h1 initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="text-2xl sm:text-3xl font-semibold tracking-tight mb-1">
        Explorateur <span className="text-gradient">universel</span>
      </motion.h1>
      <p className="text-sm text-muted mb-6">Combinez indicateur, géographie, sexe, milieu et âge — les résultats se recalculent en temps réel.</p>

      <div className="glass-panel rounded-2xl p-4 mb-6 flex flex-wrap items-center gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          disabled={catalogLoading}
          className="rounded-full bg-foreground/5 px-4 py-2 text-sm outline-none cursor-pointer max-w-[260px]"
        >
          {rates.length > 0 && (
            <optgroup label="Taux (%)">
              {rates.map((i) => (
                <option key={i.category} value={i.category}>
                  {i.category}
                </option>
              ))}
            </optgroup>
          )}
          {counts.length > 0 && (
            <optgroup label="Effectifs">
              {counts.map((i) => (
                <option key={i.category} value={i.category}>
                  {i.category}
                </option>
              ))}
            </optgroup>
          )}
        </select>

        <select value={levelKey} onChange={(e) => setLevelKey(e.target.value)} className="rounded-full bg-foreground/5 px-4 py-2 text-sm outline-none cursor-pointer">
          {LEVELS.map((l) => (
            <option key={l.key} value={l.key}>
              {l.label}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1">
          <GeoPicker
            value={parent ? { geoCode: parent.code, geoName: parent.name, geoLevel: "" } : { geoCode: "NATIONAL", geoName: "Maroc (national)", geoLevel: "National" }}
            onChange={(g) => setParent(g.geoCode === "NATIONAL" ? null : { code: g.geoCode, name: g.geoName })}
            placeholder="Restreindre à une région/province…"
          />
          {parent && (
            <button onClick={() => setParent(null)} className="text-muted hover:text-foreground rounded-full p-1.5" title="Retirer la restriction géographique">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex rounded-full bg-foreground/5 p-1 text-sm">
          {(["ensemble", "urbain", "rural"] as const).map((m) => (
            <button key={m} onClick={() => setMilieu(m)} className={cn("rounded-full px-3 py-1.5 capitalize transition-colors", milieu === m ? "bg-accent text-white" : "text-muted")}>
              {m}
            </button>
          ))}
        </div>

        <div className={cn("flex rounded-full bg-foreground/5 p-1 text-sm", indicator && hasNoSexeBreakdown(indicator) && "opacity-40 pointer-events-none")}>
          {(["ensemble", "masculin", "feminin"] as const).map((s) => (
            <button key={s} onClick={() => setSexe(s)} className={cn("rounded-full px-3 py-1.5 transition-colors", sexe === s ? "bg-accent text-white" : "text-muted")}>
              {s === "ensemble" ? "Ensemble" : s === "masculin" ? "Hommes" : "Femmes"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 rounded-full bg-foreground/5 px-3 py-1.5 text-sm">
          <span className="text-muted">Âge</span>
          <input
            type="number"
            value={ageMin}
            onChange={(e) => setAgeMin(e.target.value)}
            placeholder="min"
            className="w-14 bg-transparent outline-none"
          />
          <span className="text-muted">–</span>
          <input
            type="number"
            value={ageMax}
            onChange={(e) => setAgeMax(e.target.value)}
            placeholder="max"
            className="w-14 bg-transparent outline-none"
          />
          {ageActive && (
            <button onClick={() => { setAgeMin(""); setAgeMax(""); }} className="text-muted hover:text-foreground">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {ageActive && (
        <div className="glass-panel rounded-xl px-4 py-2.5 mb-4 text-xs text-muted">
          Avec un filtre d&apos;âge, le résultat affiché est l&apos;effectif de population dans cette tranche — les données RGPH ne ventilent pas les
          autres indicateurs (chômage, alphabétisation…) par tranche d&apos;âge précise.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <div className="glass-panel rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium">
              Classement — {indicator?.category} {parent ? `dans ${parent.name}` : "(national)"}
            </p>
            <div className="flex items-center gap-1.5">
              <button onClick={() => handleExport("csv")} className="text-muted hover:text-foreground p-1.5 rounded-lg hover:bg-foreground/5" title="Export CSV">
                <Download size={15} />
              </button>
              <button onClick={() => handleExport("excel")} className="text-muted hover:text-foreground p-1.5 rounded-lg hover:bg-foreground/5" title="Export Excel">
                <FileSpreadsheet size={15} />
              </button>
              <button onClick={() => handleExport("pdf")} className="text-muted hover:text-foreground p-1.5 rounded-lg hover:bg-foreground/5" title="Export PDF">
                <FileText size={15} />
              </button>
            </div>
          </div>
          {loading ? (
            <div className="h-[420px] flex items-center justify-center text-sm text-muted">Chargement…</div>
          ) : chartData.length === 0 ? (
            <div className="h-[420px] flex items-center justify-center text-sm text-muted">Aucune donnée pour cette combinaison de filtres.</div>
          ) : (
            <RankingBarChart data={chartData} isRate={indicator?.is_rate ?? false} selectedCode={selected?.code} onSelect={(code, name) => setSelected({ code, name })} />
          )}
        </div>

        <div className="flex flex-col gap-4">
          {selected ? (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-2xl p-4">
              <p className="text-sm font-semibold mb-2">{selected.name}</p>
              {selectedKpi ? (
                <>
                  <p className="text-2xl font-semibold tabular-nums">
                    {indicator?.is_rate && !ageActive ? formatPercent(selectedKpi.percentage) : formatNumber(selectedKpi.exact_value)}
                  </p>
                  {indicator?.is_rate && !ageActive && <p className="text-sm text-muted tabular-nums">{formatNumber(selectedKpi.exact_value)} exactement</p>}
                  <p className="text-xs text-muted mt-2 leading-relaxed">{selectedKpi.calculation_method}</p>
                </>
              ) : (
                <p className="text-sm text-muted">Chargement…</p>
              )}
              {insight && (
                <div className="flex items-start gap-2 rounded-xl bg-accent/10 p-3 mt-3">
                  <Sparkles size={14} className="text-accent-2 mt-0.5 shrink-0" />
                  <p className="text-xs leading-relaxed">{insight}</p>
                </div>
              )}
            </motion.div>
          ) : (
            <div className="glass-panel rounded-2xl p-4 text-sm text-muted">Cliquez une barre du classement pour voir le détail exact.</div>
          )}

          <div className="glass-panel rounded-2xl p-4 text-xs text-muted leading-relaxed">
            <p className="font-medium text-foreground mb-1">Astuce</p>
            Utilisez le sélecteur géographique pour restreindre le classement (ex. comparer uniquement les provinces d&apos;une région), puis
            combinez avec le sexe, le milieu ou une tranche d&apos;âge.
          </div>
        </div>
      </div>
    </div>
  );
}
