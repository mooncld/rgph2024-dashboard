"use client";

import ReactECharts from "echarts-for-react";
import { useTheme } from "@/components/theme-provider";

const PALETTE = ["#5b8cff", "#a78bfa", "#22d3ee", "#34d399", "#f59e0b", "#f472b6", "#fb7185", "#818cf8"];

interface TreemapChartProps {
  data: { sublabel: string; percentage: number; exact_value: number | null }[];
  height?: number;
}

export function TreemapChart({ data, height = 420 }: TreemapChartProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const option = {
    backgroundColor: "transparent",
    tooltip: {
      formatter: (p: { name: string; value: number; data: { exact: number | null } }) =>
        `<b>${p.name}</b><br/>${p.value}%${p.data.exact ? ` — ${p.data.exact.toLocaleString("fr-FR")}` : ""}`,
      backgroundColor: isDark ? "#111622" : "#ffffff",
      borderColor: isDark ? "#282e3f" : "#e2e8f4",
      textStyle: { color: isDark ? "#eef1f8" : "#0b1120" },
    },
    series: [
      {
        type: "treemap",
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        label: { color: "#fff", fontSize: 12, fontWeight: 600 },
        upperLabel: { show: false },
        itemStyle: { borderRadius: 8, borderWidth: 2, borderColor: isDark ? "#05070d" : "#f4f6fb", gapWidth: 2 },
        data: data.map((d, i) => ({
          name: d.sublabel,
          value: d.percentage,
          exact: d.exact_value,
          itemStyle: { color: PALETTE[i % PALETTE.length] },
        })),
      },
    ],
  };

  return <ReactECharts option={option} style={{ height }} />;
}
