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

export function RouteMap({ path, startLabel, endLabel }: { path: RoutePoint[]; startLabel: string; endLabel: string }) {
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

    const startPoint = path[0];
    const endPoint = path[path.length - 1];
    const routeBounds = L.latLngBounds(path);

    L.polyline(path, {
      color: getCssVariable("--route-line", "#005fb8"),
      weight: 4,
      opacity: 0.9,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(overlay);

    const startCircle = L.circleMarker(startPoint, {
      radius: 9,
      color: getCssVariable("--route-marker", "#004c93"),
      weight: 3,
      fillColor: getCssVariable("--route-marker", "#004c93"),
      fillOpacity: 1,
    }).addTo(overlay);

    startCircle.bindTooltip(startLabel, {
      permanent: true,
      direction: "top",
      offset: [0, -10],
      className: "route-label route-label-start",
      opacity: 1,
    });

    const endIcon = L.divIcon({
      className: "route-pin-icon",
      html: '<span class="route-pin-shape"><span class="route-pin-dot"></span></span>',
      iconSize: [18, 18],
      iconAnchor: [9, 18],
    });

    const endMarker = L.marker(endPoint, { icon: endIcon }).addTo(overlay);
    endMarker.bindTooltip(endLabel, {
      permanent: true,
      direction: "bottom",
      offset: [0, 12],
      className: "route-label route-label-end",
      opacity: 1,
    });

    map.fitBounds(routeBounds, { padding: [24, 24] });
    requestAnimationFrame(() => {
      map.invalidateSize();
    });
  }, [path, startLabel, endLabel]);

  return <div ref={containerRef} className="app-map" />;
}
