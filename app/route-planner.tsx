"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Clock3, Route, MapPin } from "lucide-react";
import { requestRoutePlan, type RoutePoint } from "./route-api";
import { readRouteHistory, upsertRouteHistoryEntry, clearRouteHistory, type RouteHistoryEntry } from "./route-history";
import type { RouteSummaryItem } from "./route-api";

const RouteMap = dynamic(() => import("./route-map").then((module) => module.RouteMap), { ssr: false });
import { reverseGeocode, searchPlaces, formatAddress, type NominatimSearchResult } from "./geocoding";

export function RoutePlanner() {
  const [startingLocation, setStartingLocation] = useState("");
  const [dropOffPoint, setDropOffPoint] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const [responsePath, setResponsePath] = useState<RoutePoint[]>([]);
  const [responseText, setResponseText] = useState("");
  const [isResponseTextError, setIsResponseTextError] = useState(false);
  const [routeSummaryItems, setRouteSummaryItems] = useState<RouteSummaryItem[]>([]);
  const [routeHistory, setRouteHistory] = useState<RouteHistoryEntry[]>([]);
  const useDebugRouteRef = useRef(false);

  const [startCoords, setStartCoords] = useState<RoutePoint | null>(null);
  const [endCoords, setEndCoords] = useState<RoutePoint | null>(null);
  const [pinningMode, setPinningMode] = useState<"start" | "end" | null>(null);

  const [startSuggestions, setStartSuggestions] = useState<NominatimSearchResult[]>([]);
  const [endSuggestions, setEndSuggestions] = useState<NominatimSearchResult[]>([]);
  const [mapBounds, setMapBounds] = useState<{ west: number; south: number; east: number; north: number } | null>(null);

  const shouldSearchStartRef = useRef(false);
  const shouldSearchEndRef = useRef(false);
  const lastResolvedStartRef = useRef("");
  const lastResolvedEndRef = useRef("");
  const isResolvingStartRef = useRef(false);

  const startContainerRef = useRef<HTMLDivElement | null>(null);
  const endContainerRef = useRef<HTMLDivElement | null>(null);

  function parseCoordinates(str: string): RoutePoint | null {
    const parts = str.split(",").map((p) => Number(p.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) && parts[0] !== 0 && parts[1] !== 0) {
      if (parts[0] >= -90 && parts[0] <= 90 && parts[1] >= -180 && parts[1] <= 180) {
        return [parts[0], parts[1]];
      }
    }
    return null;
  }

  function reset() {
    setStartingLocation("");
    setDropOffPoint("");
    setResponseText("");
    setIsResponseTextError(false);
    setResponsePath([]);
    setRouteSummaryItems([]);
    useDebugRouteRef.current = false;
    setStartCoords(null);
    setEndCoords(null);
    setPinningMode(null);
    setStartSuggestions([]);
    setEndSuggestions([]);
    shouldSearchStartRef.current = false;
    shouldSearchEndRef.current = false;
    lastResolvedStartRef.current = "";
    lastResolvedEndRef.current = "";
  }

  async function submitRouteSearch(origin: string, destination: string, useDebugRoute: boolean) {
    setIsSubmitting(true);
    setIsResponseTextError(false);
    setResponseText("Your route is being calculated...");
    setRouteSummaryItems([]);

    const nextRouteHistory = upsertRouteHistoryEntry(window.localStorage, routeHistory, origin, destination);
    setRouteHistory(nextRouteHistory);

    if (!useDebugRoute) {
      setResponsePath([]);
    }

    try {
      const routeResult = await requestRoutePlan(
        process.env.NEXT_PUBLIC_API_DOMAIN ?? "",
        origin,
        destination,
        () => setResponseText("This might take a bit longer..."),
        useDebugRoute,
      );
      setRouteSummaryItems(routeResult.summaryItems);
      setResponseText("");
      setResponsePath(routeResult.path);
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      console.log(error.message);
      setRouteSummaryItems([]);
      setResponseText(error.cause ? String(error.cause) : "An Error Occurred. Please Try Again.");
      setIsResponseTextError(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleRouteHistoryClick(historyEntry: RouteHistoryEntry) {
    setStartingLocation(historyEntry.startingLocation);
    setDropOffPoint(historyEntry.dropOffPoint);
    void submitRouteSearch(historyEntry.startingLocation, historyEntry.dropOffPoint, false);
  }

  function handleClearHistory() {
    clearRouteHistory(window.localStorage);
    setRouteHistory([]);
  }

  function handlePinStartOnMap() {
    setPinningMode("start");
  }

  function handlePinEndOnMap() {
    setPinningMode("end");
  }

  async function handleConfirmLocation(coords: RoutePoint) {
    if (pinningMode === "start") {
      setStartCoords(coords);
      setStartingLocation("Resolving address...");
      setPinningMode("end");
      isResolvingStartRef.current = true;
      try {
        const data = await reverseGeocode(coords[0], coords[1]);
        const name = formatAddress(data) || data.display_name;
        const finalVal = name || `${coords[0].toFixed(6)}, ${coords[1].toFixed(6)}`;
        shouldSearchStartRef.current = false;
        setStartingLocation(finalVal);
        lastResolvedStartRef.current = finalVal;
      } catch (e) {
        const coordStr = `${coords[0].toFixed(6)}, ${coords[1].toFixed(6)}`;
        shouldSearchStartRef.current = false;
        setStartingLocation(coordStr);
        lastResolvedStartRef.current = coordStr;
      } finally {
        isResolvingStartRef.current = false;
      }
    } else if (pinningMode === "end") {
      setEndCoords(coords);
      setDropOffPoint("Resolving address...");
      setPinningMode(null);

      let finalDropOffVal = `${coords[0].toFixed(6)}, ${coords[1].toFixed(6)}`;
      try {
        const data = await reverseGeocode(coords[0], coords[1]);
        const name = formatAddress(data) || data.display_name;
        if (name) {
          finalDropOffVal = name;
        }
      } catch (e) {
        // ignore
      }
      shouldSearchEndRef.current = false;
      setDropOffPoint(finalDropOffVal);
      lastResolvedEndRef.current = finalDropOffVal;

      // Auto start search!
      let origin = lastResolvedStartRef.current;
      if (isResolvingStartRef.current) {
        for (let i = 0; i < 30; i++) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          if (!isResolvingStartRef.current) {
            origin = lastResolvedStartRef.current;
            break;
          }
        }
      }

      void submitRouteSearch(origin, finalDropOffVal, false);
    }
    setResponsePath([]);
    setRouteSummaryItems([]);
  }

  function handleCancelPinning() {
    setPinningMode(null);
  }

  async function handleUpdateLocation(type: "start" | "end", coords: RoutePoint) {
    setResponsePath([]);
    setRouteSummaryItems([]);

    if (type === "start") {
      setStartCoords(coords);
      setStartingLocation("Resolving address...");
      let finalStartVal = `${coords[0].toFixed(6)}, ${coords[1].toFixed(6)}`;
      try {
        const data = await reverseGeocode(coords[0], coords[1]);
        const name = formatAddress(data) || data.display_name;
        if (name) {
          finalStartVal = name;
        }
      } catch (e) {
        // ignore
      }
      shouldSearchStartRef.current = false;
      setStartingLocation(finalStartVal);
      lastResolvedStartRef.current = finalStartVal;

      void submitRouteSearch(finalStartVal, lastResolvedEndRef.current, false);
    } else {
      setEndCoords(coords);
      setDropOffPoint("Resolving address...");
      let finalDropOffVal = `${coords[0].toFixed(6)}, ${coords[1].toFixed(6)}`;
      try {
        const data = await reverseGeocode(coords[0], coords[1]);
        const name = formatAddress(data) || data.display_name;
        if (name) {
          finalDropOffVal = name;
        }
      } catch (e) {
        // ignore
      }
      shouldSearchEndRef.current = false;
      setDropOffPoint(finalDropOffVal);
      lastResolvedEndRef.current = finalDropOffVal;

      void submitRouteSearch(lastResolvedStartRef.current, finalDropOffVal, false);
    }
  }

  function handleSelectStartSuggestion(suggestion: NominatimSearchResult) {
    shouldSearchStartRef.current = false;
    const name = formatAddress(suggestion);
    const finalVal = name || suggestion.display_name;
    setStartingLocation(finalVal);
    lastResolvedStartRef.current = finalVal;
    setStartCoords([Number(suggestion.lat), Number(suggestion.lon)]);
    setStartSuggestions([]);
  }

  function handleSelectEndSuggestion(suggestion: NominatimSearchResult) {
    shouldSearchEndRef.current = false;
    const name = formatAddress(suggestion);
    const finalVal = name || suggestion.display_name;
    setDropOffPoint(finalVal);
    lastResolvedEndRef.current = finalVal;
    setEndCoords([Number(suggestion.lat), Number(suggestion.lon)]);
    setEndSuggestions([]);
  }

  useEffect(() => {
    if (!shouldSearchStartRef.current) {
      setStartSuggestions([]);
      return;
    }
    if (!startingLocation.trim()) {
      setStartSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const results = await searchPlaces(startingLocation, mapBounds);
        setStartSuggestions(results);
      } catch (e) {
        console.error(e);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [startingLocation, mapBounds]);

  useEffect(() => {
    if (!shouldSearchEndRef.current) {
      setEndSuggestions([]);
      return;
    }
    if (!dropOffPoint.trim()) {
      setEndSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const results = await searchPlaces(dropOffPoint, mapBounds);
        setEndSuggestions(results);
      } catch (e) {
        console.error(e);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [dropOffPoint, mapBounds]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (startContainerRef.current && !startContainerRef.current.contains(event.target as Node)) {
        setStartSuggestions([]);
      }
      if (endContainerRef.current && !endContainerRef.current.contains(event.target as Node)) {
        setEndSuggestions([]);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const coords = parseCoordinates(startingLocation);
    if (coords) {
      setStartCoords(coords);
    } else if (!startingLocation.trim() || shouldSearchStartRef.current) {
      setStartCoords(null);
    }
  }, [startingLocation]);

  useEffect(() => {
    const coords = parseCoordinates(dropOffPoint);
    if (coords) {
      setEndCoords(coords);
    } else if (!dropOffPoint.trim() || shouldSearchEndRef.current) {
      setEndCoords(null);
    }
  }, [dropOffPoint]);

  useEffect(() => {
    setRouteHistory(readRouteHistory(window.localStorage));

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Control") {
        setIsCtrlPressed(true);
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.key === "Control") {
        setIsCtrlPressed(false);
      }
    }

    function handleWindowBlur() {
      setIsCtrlPressed(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, []);

  async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();

    const useDebugRoute = useDebugRouteRef.current;
    useDebugRouteRef.current = false;

    void submitRouteSearch(startingLocation, dropOffPoint, useDebugRoute);
  }

  return (
    <main className="app-shell">
      <div className="app-layout grid grid-cols-1 min-w-0 w-full lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="app-sidebar">
          <form className="app-sidebar-form" onSubmit={handleSubmit}>
            <div ref={startContainerRef} className="block space-y-2 text-sm font-medium">
              <span>Starting Location</span>
              <div className="flex gap-2 relative">
                <div className="relative flex-1">
                  <input
                    value={startingLocation}
                    onChange={(event) => {
                      shouldSearchStartRef.current = true;
                      setStartingLocation(event.target.value);
                      lastResolvedStartRef.current = event.target.value;
                    }}
                    onFocus={(event) => event.target.select()}
                    onClick={(event) => (event.target as HTMLInputElement).select()}
                    autoComplete="off"
                    className="app-input"
                    placeholder="Type a starting location"
                    required
                  />
                  {startSuggestions.length > 0 && (
                    <ul className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1.5 shadow-xl text-sm text-gray-700">
                      {startSuggestions.map((suggestion) => {
                        const title = formatAddress(suggestion);
                        const subtitle = suggestion.display_name;
                        return (
                          <li key={suggestion.place_id}>
                            <button
                              type="button"
                              onClick={() => handleSelectStartSuggestion(suggestion)}
                              className="w-full text-left px-4 py-2.5 hover:bg-slate-50 active:bg-slate-100 transition-colors flex flex-col gap-0.5 focus:outline-none focus:bg-slate-50"
                            >
                              <span className="font-semibold text-slate-800 text-xs sm:text-sm truncate">
                                {title || suggestion.display_name}
                              </span>
                              {title && <span className="text-xxs sm:text-xs text-slate-400 truncate">{subtitle}</span>}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handlePinStartOnMap}
                  className="app-button app-pin-button app-button-secondary flex items-center justify-center p-2.5"
                  title="Pin on Map"
                  aria-label="Pin starting location on map"
                >
                  <MapPin className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div ref={endContainerRef} className="block space-y-2 text-sm font-medium">
              <span>Drop-off Point</span>
              <div className="flex gap-2 relative">
                <div className="relative flex-1">
                  <input
                    value={dropOffPoint}
                    onChange={(event) => {
                      shouldSearchEndRef.current = true;
                      setDropOffPoint(event.target.value);
                      lastResolvedEndRef.current = event.target.value;
                    }}
                    onFocus={(event) => event.target.select()}
                    onClick={(event) => (event.target as HTMLInputElement).select()}
                    autoComplete="off"
                    className="app-input"
                    placeholder="Type a drop-off point"
                    required
                  />
                  {endSuggestions.length > 0 && (
                    <ul className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1.5 shadow-xl text-sm text-gray-700">
                      {endSuggestions.map((suggestion) => {
                        const title = formatAddress(suggestion);
                        const subtitle = suggestion.display_name;
                        return (
                          <li key={suggestion.place_id}>
                            <button
                              type="button"
                              onClick={() => handleSelectEndSuggestion(suggestion)}
                              className="w-full text-left px-4 py-2.5 hover:bg-slate-50 active:bg-slate-100 transition-colors flex flex-col gap-0.5 focus:outline-none focus:bg-slate-50"
                            >
                              <span className="font-semibold text-slate-800 text-xs sm:text-sm truncate">
                                {title || suggestion.display_name}
                              </span>
                              {title && <span className="text-xxs sm:text-xs text-slate-400 truncate">{subtitle}</span>}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handlePinEndOnMap}
                  className="app-button app-pin-button app-button-secondary flex items-center justify-center p-2.5"
                  title="Pin on Map"
                  aria-label="Pin drop-off point on map"
                >
                  <MapPin className="h-5 w-5" />
                </button>
              </div>
            </div>

            {responseText ? (
              <div className={`app-response ${isResponseTextError ? "app-response-error" : ""}`}>{responseText}</div>
            ) : null}

            {routeSummaryItems.length > 0 ? (
              <section className="app-summary-grid">
                {routeSummaryItems.map((summaryItem) => (
                  <article key={summaryItem.kind} className="app-summary-card">
                    <div className="app-summary-card-head">
                      {summaryItem.kind === "distance" ? (
                        <Route className="app-summary-icon" aria-hidden="true" />
                      ) : (
                        <Clock3 className="app-summary-icon" aria-hidden="true" />
                      )}
                      <span className="app-summary-title">{summaryItem.title}</span>
                    </div>
                    <div className="app-summary-value">{summaryItem.value}</div>
                  </article>
                ))}
              </section>
            ) : null}

            <div className="flex gap-3">
              <button
                type="submit"
                onClick={(event) => {
                  useDebugRouteRef.current = event.ctrlKey;
                }}
                className="app-button app-button-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Finding..." : isCtrlPressed ? "Find Route (Debug)" : "Find Route"}
              </button>
              <button
                type="button"
                onClick={() => {
                  reset();
                }}
                className="app-button app-button-secondary"
                disabled={isSubmitting}
              >
                Reset
              </button>
            </div>

            {routeHistory.length > 0 && (
              <section className="app-history">
                <div className="flex justify-between items-center mb-3">
                  <h2 className="app-history-title text-sm font-bold m-0">Recent Searches</h2>
                  <button
                    type="button"
                    onClick={handleClearHistory}
                    className="text-xs text-[#005fb8] hover:underline font-semibold cursor-pointer border-0 bg-transparent p-0"
                  >
                    Clear All
                  </button>
                </div>
                <ul className="app-history-list">
                  {routeHistory.map((historyEntry) => (
                    <li key={`${historyEntry.startingLocation}-${historyEntry.dropOffPoint}`}>
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => handleRouteHistoryClick(historyEntry)}
                        className="app-button-secondary app-history-button"
                        aria-label={`Refill route from ${historyEntry.startingLocation} to ${historyEntry.dropOffPoint}`}
                      >
                        <span className="app-history-button-text app-history-button-start">
                          {historyEntry.startingLocation}
                        </span>
                        <span className="app-history-arrow" aria-hidden="true">
                          🡺
                        </span>
                        <span className="app-history-button-text app-history-button-end">
                          {historyEntry.dropOffPoint}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </form>
        </aside>

        <section className="h-full app-map-shell">
          <RouteMap
            path={responsePath}
            startLabel={startingLocation}
            endLabel={dropOffPoint}
            startCoords={startCoords}
            endCoords={endCoords}
            pinningMode={pinningMode}
            onConfirmLocation={handleConfirmLocation}
            onCancelPinning={handleCancelPinning}
            onBoundsChange={setMapBounds}
            onUpdateLocation={handleUpdateLocation}
          />
        </section>
      </div>
    </main>
  );
}
