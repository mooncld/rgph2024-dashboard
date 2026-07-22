"use client";

import ReactECharts from "echarts-for-react";
import { useTheme } from "@/components/theme-provider";

interface RadarChartProps {
  indicators: { name: string; max: number }[];
  selectedValues: number[];
  nationalValues: number[];
  selectedLabel: string;
  height?: number;
}

export function RadarChartPanel({ indicators, selectedValues, nationalValues, selectedLabel, height = 420 }: RadarChartProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const axisColor = isDark ? "#8b93a7" : "#5b6577";

  const option = {
    backgroundColor: "transparent",
    tooltip: { backgroundColor: isDark ? "#111622" : "#ffffff", borderColor: isDark ? "#282e3f" : "#e2e8f4", textStyle: { color: isDark ? "#eef1f8" : "#0b1120" } },
    legend: { data: [selectedLabel, "Moyenne nationale"], textStyle: { color: axisColor }, bottom: 0 },
    radar: {
      indicator: indicators,
      splitLine: { lineStyle: { color: isDark ? "#1f2433" : "#e9edf5" } },
      splitArea: { areaStyle: { color: isDark ? ["rgba(255,255,255,0.02)", "rgba(255,255,255,0.04)"] : ["rgba(0,0,0,0.02)", "rgba(0,0,0,0.04)"] } },
      axisName: { color: axisColor, fontSize: 11 },
      axisLine: { lineStyle: { color: isDark ? "#282e3f" : "#e2e8f4" } },
    },
    series: [
      {
        type: "radar",
        data: [
          { value: selectedValues, name: selectedLabel, areaStyle: { color: "rgba(91,140,255,0.25)" }, lineStyle: { color: "#5b8cff" }, itemStyle: { color: "#5b8cff" } },
          { value: nationalValues, name: "Moyenne nationale", areaStyle: { color: "rgba(167,139,250,0.15)" }, lineStyle: { color: "#a78bfa", type: "dashed" }, itemStyle: { color: "#a78bfa" } },
        ],
      },
    ],
  };

  return <ReactECharts option={option} style={{ height }} />;
}
