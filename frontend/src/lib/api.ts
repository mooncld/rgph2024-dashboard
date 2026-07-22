const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${path} failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

export interface KpiValue {
  label: string;
  geo_codes: string[];
  milieu: string;
  sexe: string;
  percentage: number | null;
  exact_value: number | null;
  base_label: string | null;
  base_value: number | null;
  calculation_method: string;
  is_estimated?: boolean;
}

export interface ExecutiveKpis {
  geo_code: string;
  population_totale: KpiValue;
  menages: KpiValue;
  taux_chomage: KpiValue;
  taux_alphabetisation: KpiValue;
  population_urbaine: KpiValue;
  population_rurale: KpiValue;
  hommes: KpiValue;
  femmes: KpiValue;
}

export interface GeoNode {
  geo_code: string;
  geo_name: string;
  geo_level: string;
  full_label: string;
}

export interface SearchResponse {
  query: string;
  understood: boolean;
  message?: string;
  parsed?: Record<string, unknown>;
  result?: KpiValue;
  insight?: {
    insight: string | null;
    ranking_insight?: string | null;
    local_value?: number;
    national_value?: number;
    diff?: number;
  } | null;
}

export interface ChoroplethFeatureValue {
  geo_code: string;
  geo_name: string;
  full_label: string;
  value: number | null;
  exact_value: number | null;
  percentage: number | null;
}

export const api = {
  executiveKpis: (geoCode = "NATIONAL") =>
    request<ExecutiveKpis>(`/api/kpi/executive?geo_code=${encodeURIComponent(geoCode)}`),

  geoChildren: (parentCode?: string) =>
    request<{ node?: GeoNode; children: GeoNode[] }>(
      `/api/geo/children${parentCode ? `?parent_code=${encodeURIComponent(parentCode)}` : ""}`
    ),

  geoSearch: (q: string, level?: string) =>
    request<(GeoNode & { score: number })[]>(
      `/api/geo/search?q=${encodeURIComponent(q)}${level ? `&level=${encodeURIComponent(level)}` : ""}`
    ),

  geoPath: (geoCode: string) => request<GeoNode[]>(`/api/geo/path/${encodeURIComponent(geoCode)}`),

  search: (query: string) =>
    request<SearchResponse>("/api/search", { method: "POST", body: JSON.stringify({ query }) }),

  searchSuggestions: () => request<string[]>("/api/search/suggestions"),

  choropleth: (params: { category: string; level: string; parent_code?: string; milieu?: string; sexe?: string; group?: string }) => {
    const qs = new URLSearchParams();
    qs.set("category", params.category);
    qs.set("level", params.level);
    if (params.parent_code) qs.set("parent_code", params.parent_code);
    if (params.milieu) qs.set("milieu", params.milieu);
    if (params.sexe) qs.set("sexe", params.sexe);
    if (params.group) qs.set("group", params.group);
    return request<ChoroplethFeatureValue[]>(`/api/map/choropleth?${qs.toString()}`);
  },

  explore: (body: {
    category: string;
    group?: string;
    is_rate?: boolean;
    geo?: string[];
    include_descendants?: boolean;
    milieu?: string;
    sexe?: string;
    age_min?: number | null;
    age_max?: number | null;
  }) => request<KpiValue>("/api/kpi/explore", { method: "POST", body: JSON.stringify(body) }),

  insights: (category: string, geoCode: string, milieu = "ensemble", sexe = "ensemble") =>
    request(`/api/insights?category=${encodeURIComponent(category)}&geo_code=${encodeURIComponent(geoCode)}&milieu=${milieu}&sexe=${sexe}`),

  indicators: (group?: string) => request(`/api/indicators${group ? `?group=${group}` : ""}`),

  agePyramid: (geoCode = "NATIONAL", milieu = "ensemble") =>
    request<{ band: string; sort_key: number; hommes: number; femmes: number }[]>(
      `/api/kpi/age-pyramid?geo_code=${encodeURIComponent(geoCode)}&milieu=${milieu}`
    ),

  breakdown: (category: string, geoCode = "NATIONAL", milieu = "ensemble", sexe = "ensemble", group = "population") =>
    request<{ sublabel: string; percentage: number; exact_value: number | null }[]>(
      `/api/kpi/breakdown?category=${encodeURIComponent(category)}&geo_code=${encodeURIComponent(geoCode)}&milieu=${milieu}&sexe=${sexe}&group=${group}`
    ),

  async exportData(rows: Record<string, unknown>[], format: "csv" | "excel" | "pdf", title = "RGPH 2024 — Export") {
    const res = await fetch(`${API_URL}/api/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows, format, title }),
    });
    if (!res.ok) throw new Error(`Export failed: ${res.status}`);
    const blob = await res.blob();
    const ext = format === "excel" ? "xlsx" : format;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rgph2024_export.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

export { API_URL };
