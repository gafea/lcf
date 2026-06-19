"use client";

import L from "leaflet";
import { useEffect, useRef } from "react";
import { type RoutePoint } from "./route-api";

const hongKongCenter: RoutePoint = [22.3193, 114.1694];

function getCssVariable(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function RouteMap({ path }: { path: RoutePoint[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const overlayRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = L.map(containerRef.current, {
      zoomControl: true,
    }).setView(hongKongCenter, 11);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    overlayRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    requestAnimationFrame(() => {
      map.invalidateSize();
    });

    return () => {
      overlayRef.current?.remove();
      overlayRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const overlay = overlayRef.current;

    if (!map || !overlay) {
      return;
    }

    overlay.clearLayers();

    if (path.length === 0) {
      map.setView(hongKongCenter, 11);
      return;
    }

    const lineColor = getCssVariable("--route-line", "#005fb8");
    const markerColor = getCssVariable("--route-marker", "#004c93");
    const polyline = L.polyline(path, {
      color: lineColor,
      weight: 4,
    }).addTo(overlay);

    path.forEach((point, idx) => {
      const icon = L.divIcon({
        className: "route-number-icon",
        html: `<div class="num">${idx + 1}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
      });

      L.marker(point, { icon }).addTo(overlay);
    });

    map.fitBounds(polyline.getBounds(), { padding: [24, 24] });
    requestAnimationFrame(() => {
      map.invalidateSize();
    });
  }, [path]);

  return <div ref={containerRef} className="app-map" />;
}
