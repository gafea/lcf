"use client";

import L from "leaflet";
import { useEffect, useRef, useState } from "react";
import { type RoutePoint } from "./route-api";

const hongKongCenter: RoutePoint = [22.3193, 114.1694];

function getCssVariable(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

async function fetchDrivingRoute(points: RoutePoint[]): Promise<RoutePoint[]> {
  if (points.length < 2) {
    return points;
  }
  // Convert RoutePoint [lat, lng] to OSRM format: lng,lat;lng,lat...
  const coordsString = points.map(([lat, lng]) => `${lng},${lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`OSRM returned HTTP ${res.status}`);
    }
    const data = await res.json();
    if (data.code === "Ok" && data.routes && data.routes.length > 0) {
      const geometry = data.routes[0].geometry;
      if (geometry && geometry.type === "LineString" && Array.isArray(geometry.coordinates)) {
        // geometry.coordinates is an array of [lng, lat]
        return geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng] as RoutePoint);
      }
    }
  } catch (error) {
    console.error("Error fetching driving route from OSRM:", error);
  }
  return points; // Fallback to the original coordinates if request fails
}

export function RouteMap({
  path,
  startLabel,
  endLabel,
  startCoords,
  endCoords,
  pinningMode,
  onConfirmLocation,
  onCancelPinning,
}: {
  path: RoutePoint[];
  startLabel: string;
  endLabel: string;
  startCoords: RoutePoint | null;
  endCoords: RoutePoint | null;
  pinningMode: "start" | "end" | null;
  onConfirmLocation: (coords: RoutePoint) => void;
  onCancelPinning: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const overlayRef = useRef<L.LayerGroup | null>(null);
  const [renderedPath, setRenderedPath] = useState<RoutePoint[]>([]);

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
    if (path.length === 0) {
      setRenderedPath([]);
      return;
    }

    let active = true;
    const loadRoute = async () => {
      const drivingRoute = await fetchDrivingRoute(path);
      if (active) {
        setRenderedPath(drivingRoute);
      }
    };
    loadRoute();

    return () => {
      active = false;
    };
  }, [path]);

  useEffect(() => {
    const map = mapRef.current;
    const overlay = overlayRef.current;

    if (!map || !overlay) {
      return;
    }

    overlay.clearLayers();

    // Determine what points we are rendering
    const startPoint = path.length > 0 ? path[0] : startCoords;
    const endPoint = path.length > 0 ? path[path.length - 1] : endCoords;

    if (!startPoint && !endPoint && path.length === 0) {
      map.setView(hongKongCenter, 11);
      return;
    }

    // Use the OSRM driving route if it has loaded, otherwise fall back to drawing the original path
    const pathToDraw = renderedPath.length > 0 ? renderedPath : path;

    if (pathToDraw.length > 0) {
      L.polyline(pathToDraw, {
        color: getCssVariable("--route-line", "#005fb8"),
        weight: 4,
        opacity: 0.9,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(overlay);
    }

    if (startPoint) {
      const startIcon = L.divIcon({
        className: "route-pin-icon",
        html: '<span class="route-pin-shape route-pin-start-shape"><span class="route-pin-dot"></span></span>',
        iconSize: [18, 18],
        iconAnchor: [9, 18],
      });

      const startMarker = L.marker(startPoint, { icon: startIcon }).addTo(overlay);
      startMarker.bindTooltip(startLabel || "Starting Location", {
        permanent: true,
        direction: "top",
        offset: [0, -10],
        className: "route-label route-label-start",
        opacity: 1,
      });
    }

    if (endPoint) {
      const endIcon = L.divIcon({
        className: "route-pin-icon",
        html: '<span class="route-pin-shape"><span class="route-pin-dot"></span></span>',
        iconSize: [18, 18],
        iconAnchor: [9, 18],
      });

      const endMarker = L.marker(endPoint, { icon: endIcon }).addTo(overlay);
      endMarker.bindTooltip(endLabel || "Drop-off Point", {
        permanent: true,
        direction: "bottom",
        offset: [0, 12],
        className: "route-label route-label-end",
        opacity: 1,
      });
    }

    // Fit bounds to all shown features
    const boundsPoints: L.LatLngExpression[] = [];
    if (pathToDraw.length > 0) {
      boundsPoints.push(...pathToDraw);
    } else {
      if (startPoint) boundsPoints.push(startPoint);
      if (endPoint) boundsPoints.push(endPoint);
    }

    if (boundsPoints.length > 0) {
      const routeBounds = L.latLngBounds(boundsPoints);
      map.fitBounds(routeBounds, { padding: [24, 24], maxZoom: 15 });
    }

    requestAnimationFrame(() => {
      map.invalidateSize();
    });
  }, [path, renderedPath, startLabel, endLabel, startCoords, endCoords]);

  return (
    <div className="relative w-full h-full" style={{ minHeight: "70vh" }}>
      <div ref={containerRef} className="app-map" />

      {pinningMode && (
        <>
          {/* Static Center Pin Overlay */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -100%)",
              zIndex: 1000,
              pointerEvents: "none",
            }}
          >
            <span className={`route-pin-shape ${pinningMode === "start" ? "route-pin-start-shape" : ""}`}>
              <span className="route-pin-dot"></span>
            </span>
          </div>

          {/* Floating Confirm/Cancel Overlay Banner */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-white px-4 py-2.5 rounded-lg shadow-lg border border-[#d7dbe0] flex items-center gap-3 w-[90%] max-w-[360px] justify-between">
            <span className="text-xs font-semibold text-gray-700 whitespace-nowrap">
              Select {pinningMode === "start" ? "Starting Location" : "Drop-off Point"}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const map = mapRef.current;
                  if (map) {
                    const center = map.getCenter();
                    onConfirmLocation([center.lat, center.lng]);
                  }
                }}
                className="app-button app-button-primary h-7 px-2.5 py-0 text-xs font-bold"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={onCancelPinning}
                className="app-button app-button-secondary h-7 px-2.5 py-0 text-xs font-bold"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
