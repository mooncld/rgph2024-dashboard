"use client";

import { useEffect, useRef } from "react";
import maplibregl, { type ExpressionSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import gsap from "gsap";
import type { ScaleResult } from "@/lib/color-scale";
import { formatNumber, formatPercent } from "@/lib/utils";

interface FeatureValue {
  geo_code: string;
  geo_name: string;
  value: number | null;
  exact_value: number | null;
  percentage: number | null;
}

interface ChoroplethMapProps {
  geojsonUrl: string;
  values: FeatureValue[];
  scale: ScaleResult;
  onSelect: (geoCode: string, geoName: string) => void;
  isRate: boolean;
}

const MOROCCO_CENTER: [number, number] = [-7.5, 29.5];

export function ChoroplethMap({ geojsonUrl, values, scale, onSelect, isRate }: ChoroplethMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors",
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm", paint: { "raster-opacity": 0.35 } }],
      },
      center: MOROCCO_CENTER,
      zoom: 4.6,
      attributionControl: false,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }));

    popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8 });

    map.on("load", () => {
      map.addSource("choropleth", { type: "geojson", data: geojsonUrl });

      map.addLayer({
        id: "choropleth-fill",
        type: "fill",
        source: "choropleth",
        paint: {
          "fill-color": "#334155",
          "fill-opacity": 0.85,
        },
      });
      map.addLayer({
        id: "choropleth-line",
        type: "line",
        source: "choropleth",
        paint: { "line-color": "rgba(255,255,255,0.5)", "line-width": 0.6 },
      });
      map.addLayer({
        id: "choropleth-hover-line",
        type: "line",
        source: "choropleth",
        paint: { "line-color": "#ffffff", "line-width": 2.5 },
        filter: ["==", "geo_code", ""],
      });

      map.on("mousemove", "choropleth-fill", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const f = e.features?.[0];
        if (!f) return;
        const code = f.properties?.geo_code as string;
        map.setFilter("choropleth-hover-line", ["==", "geo_code", code]);
        const match = values.find((v) => v.geo_code === code);
        const name = match?.geo_name ?? f.properties?.shapeName ?? "—";
        const valueText = match
          ? isRate
            ? `${formatPercent(match.percentage)} — ${formatNumber(match.exact_value)}`
            : formatNumber(match.exact_value)
          : "Non disponible";
        popupRef.current
          ?.setLngLat(e.lngLat)
          .setHTML(`<div style="font:600 12px system-ui;padding:2px 4px"><div>${name}</div><div style="opacity:.7;font-weight:400">${valueText}</div></div>`)
          .addTo(map);
      });
      map.on("mouseleave", "choropleth-fill", () => {
        map.getCanvas().style.cursor = "";
        map.setFilter("choropleth-hover-line", ["==", "geo_code", ""]);
        popupRef.current?.remove();
      });
      map.on("click", "choropleth-fill", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const code = f.properties?.geo_code as string;
        const match = values.find((v) => v.geo_code === code);
        onSelect(code, match?.geo_name ?? (f.properties?.shapeName as string) ?? code);
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geojsonUrl]);

  // Repaint fill colors whenever values/scale change (without recreating the map)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const applyPaint = () => {
      if (!map.getLayer("choropleth-fill")) return;
      // A ["match", input, fallback] expression (no label/output pairs) is
      // invalid in MapLibre — fall back to a flat color while data is empty
      // (e.g. mid-fetch or a filter combination with no results).
      if (values.length === 0) {
        map.setPaintProperty("choropleth-fill", "fill-color", "#334155");
        return;
      }
      const expr: ExpressionSpecification = ["match", ["get", "geo_code"]];
      for (const v of values) {
        expr.push(v.geo_code, scale.colorFor(v.value));
      }
      expr.push("#334155");
      map.setPaintProperty("choropleth-fill", "fill-color", expr);
    };
    if (map.isStyleLoaded()) applyPaint();
    else map.once("load", applyPaint);
  }, [values, scale]);

  useEffect(() => {
    if (containerRef.current) {
      gsap.fromTo(containerRef.current, { opacity: 0, scale: 0.98 }, { opacity: 1, scale: 1, duration: 0.7, ease: "power3.out" });
    }
  }, []);

  return <div ref={containerRef} className="h-full w-full rounded-2xl overflow-hidden" />;
}
