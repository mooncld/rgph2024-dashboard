export interface IndicatorDef {
  key: string;
  label: string;
  category: string;
  group: "population" | "menages";
  isRate: boolean;
}

export const INDICATORS: IndicatorDef[] = [
  { key: "population", label: "Population légale", category: "Population légale", group: "population", isRate: false },
  {
    key: "population_municipale",
    label: "Population (par sexe / milieu)",
    category: "Population municipale",
    group: "population",
    isRate: false,
  },
  { key: "menages", label: "Ménages", category: "Ménages", group: "menages", isRate: false },
  { key: "chomage", label: "Taux de chômage", category: "Taux de chômage (%)", group: "population", isRate: true },
  {
    key: "analphabetisme",
    label: "Taux d'analphabétisme (15 ans et +)",
    category: "Taux d'analphabétisme des 15 ans et plus (%)",
    group: "population",
    isRate: true,
  },
  { key: "activite", label: "Taux d'activité", category: "Taux d'activité des 15 ans et plus (%)", group: "population", isRate: true },
  {
    key: "scolarisation",
    label: "Taux de scolarisation (6-11 ans)",
    category: "Taux de scolarisation des 6-11 ans en 2023/2024 (%)",
    group: "population",
    isRate: true,
  },
  { key: "handicap", label: "Taux de prévalence du handicap", category: "Taux de prévalence du handicap (%)", group: "population", isRate: true },
];

export const LEVELS = [
  { key: "Région", label: "Région" },
  { key: "Préfecture/Province", label: "Préfecture / Province" },
  { key: "Commune/Arrondissement", label: "Commune" },
];

// Indicators with no Homme/Femme breakdown in the source data.
export function hasNoSexeBreakdown(indicator: IndicatorDef): boolean {
  return indicator.key === "population" || indicator.group === "menages";
}
