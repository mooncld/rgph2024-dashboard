// Sequential 6-class choropleth palette (light -> saturated), colorblind-checked blue->orange ramp.
const PALETTE = ["#e0f2fe", "#93c5fd", "#60a5fa", "#3b82f6", "#f59e0b", "#dc2626"];

export interface ScaleResult {
  breaks: number[];
  colorFor: (value: number | null | undefined) => string;
  legend: { color: string; label: string }[];
}

export function buildQuantileScale(values: number[]): ScaleResult {
  const clean = values.filter((v) => typeof v === "number" && !Number.isNaN(v)).sort((a, b) => a - b);
  if (clean.length === 0) {
    return { breaks: [], colorFor: () => "#334155", legend: [] };
  }
  const n = PALETTE.length;
  const breaks: number[] = [];
  for (let i = 1; i < n; i++) {
    const idx = Math.floor((i / n) * (clean.length - 1));
    breaks.push(clean[idx]);
  }

  function colorFor(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) return "#334155";
    for (let i = 0; i < breaks.length; i++) {
      if (value <= breaks[i]) return PALETTE[i];
    }
    return PALETTE[PALETTE.length - 1];
  }

  const legend = PALETTE.map((color, i) => {
    const lo = i === 0 ? clean[0] : breaks[i - 1];
    const hi = i === breaks.length ? clean[clean.length - 1] : breaks[i];
    const label = i === 0 ? `≤ ${hi.toFixed(1)}` : i === n - 1 ? `> ${lo.toFixed(1)}` : `${lo.toFixed(1)} – ${hi.toFixed(1)}`;
    return { color, label };
  });

  return { breaks, colorFor, legend };
}
