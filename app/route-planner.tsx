"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Clock3, Route } from "lucide-react";
import { requestRoutePlan, type RoutePoint } from "./route-api";
import { readRouteHistory, upsertRouteHistoryEntry, type RouteHistoryEntry } from "./route-history";
import type { RouteSummaryItem } from "./route-api";

const RouteMap = dynamic(() => import("./route-map").then((module) => module.RouteMap), { ssr: false });

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

  function reset() {
    setStartingLocation("");
    setDropOffPoint("");
    setResponseText("");
    setIsResponseTextError(false);
    setResponsePath([]);
    setRouteSummaryItems([]);
    useDebugRouteRef.current = false;
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
      <div className="app-layout grid lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="app-sidebar">
          <form className="app-sidebar-form" onSubmit={handleSubmit}>
            <label className="block space-y-2 text-sm font-medium">
              <span>Starting Location</span>
              <input
                value={startingLocation}
                onChange={(event) => setStartingLocation(event.target.value)}
                autoComplete="on"
                className="app-input"
                placeholder="Type a starting location"
                required
              />
            </label>

            <label className="block space-y-2 text-sm font-medium">
              <span>Drop-off Point</span>
              <input
                value={dropOffPoint}
                onChange={(event) => setDropOffPoint(event.target.value)}
                autoComplete="on"
                className="app-input"
                placeholder="Type a drop-off point"
                required
              />
            </label>

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
                <h2 className="app-history-title">Recent Searches</h2>
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
          <RouteMap path={responsePath} startLabel={startingLocation} endLabel={dropOffPoint} />
        </section>
      </div>
    </main>
  );
}
