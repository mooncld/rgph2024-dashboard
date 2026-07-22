"use client";

import ReactECharts from "echarts-for-react";
import { useTheme } from "@/components/theme-provider";

interface RankingBarChartProps {
  data: { name: string; value: number; code: string }[];
  isRate: boolean;
  selectedCode?: string | null;
  onSelect?: (code: string, name: string) => void;
  height?: number;
}

export function RankingBarChart({ data, isRate, selectedCode, onSelect, height = 420 }: RankingBarChartProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const sorted = [...data].sort((a, b) => a.value - b.value).slice(-20);

  const option = {
    backgroundColor: "transparent",
    grid: { left: 8, right: 24, top: 8, bottom: 8, containLabel: true },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      valueFormatter: (v: number) => `${v.toLocaleString("fr-FR")}${isRate ? "%" : ""}`,
      backgroundColor: isDark ? "#111622" : "#ffffff",
      borderColor: isDark ? "#282e3f" : "#e2e8f4",
      textStyle: { color: isDark ? "#eef1f8" : "#0b1120" },
    },
    xAxis: {
      type: "value",
      axisLabel: { color: isDark ? "#8b93a7" : "#5b6577", formatter: (v: number) => `${v}${isRate ? "%" : ""}` },
      splitLine: { lineStyle: { color: isDark ? "#1f2433" : "#e9edf5" } },
    },
    yAxis: {
      type: "category",
      data: sorted.map((d) => d.name),
      axisLabel: { color: isDark ? "#c7cddb" : "#334155", fontSize: 11 },
      axisLine: { lineStyle: { color: isDark ? "#282e3f" : "#e2e8f4" } },
    },
    series: [
      {
        type: "bar",
        data: sorted.map((d) => ({
          value: d.value,
          itemStyle: { color: d.code === selectedCode ? "#f59e0b" : "#5b8cff", borderRadius: [0, 6, 6, 0] },
        })),
        barMaxWidth: 18,
      },
    ],
  };

  return (
    <ReactECharts
      option={option}
      style={{ height }}
      onEvents={{
        click: (params: { dataIndex: number }) => {
          const item = sorted[params.dataIndex];
          if (item && onSelect) onSelect(item.code, item.name);
        },
      }}
    />
  );
}
