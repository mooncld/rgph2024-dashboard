"use client";

import ReactECharts from "echarts-for-react";
import { useTheme } from "@/components/theme-provider";

interface AgePyramidChartProps {
  data: { band: string; hommes: number; femmes: number }[];
  height?: number;
}

export function AgePyramidChart({ data, height = 460 }: AgePyramidChartProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const axisColor = isDark ? "#8b93a7" : "#5b6577";
  const gridColor = isDark ? "#1f2433" : "#e9edf5";

  const option = {
    backgroundColor: "transparent",
    animationDuration: 900,
    animationEasing: "cubicOut",
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      valueFormatter: (v: number) => Math.abs(v).toLocaleString("fr-FR"),
      backgroundColor: isDark ? "#111622" : "#ffffff",
      borderColor: isDark ? "#282e3f" : "#e2e8f4",
      textStyle: { color: isDark ? "#eef1f8" : "#0b1120" },
    },
    legend: { data: ["Hommes", "Femmes"], textStyle: { color: axisColor }, top: 0 },
    grid: { left: 8, right: 24, top: 36, bottom: 8, containLabel: true },
    xAxis: {
      type: "value",
      axisLabel: { color: axisColor, formatter: (v: number) => Math.abs(v).toLocaleString("fr-FR") },
      splitLine: { lineStyle: { color: gridColor } },
    },
    yAxis: {
      type: "category",
      data: data.map((d) => d.band),
      axisLabel: { color: axisColor, fontSize: 11 },
      axisLine: { lineStyle: { color: isDark ? "#282e3f" : "#e2e8f4" } },
    },
    series: [
      {
        name: "Hommes",
        type: "bar",
        stack: "total",
        data: data.map((d) => -d.hommes),
        itemStyle: { color: "#5b8cff" },
        barMaxWidth: 16,
      },
      {
        name: "Femmes",
        type: "bar",
        stack: "total",
        data: data.map((d) => d.femmes),
        itemStyle: { color: "#f472b6" },
        barMaxWidth: 16,
      },
    ],
  };

  return <ReactECharts option={option} style={{ height }} />;
}
