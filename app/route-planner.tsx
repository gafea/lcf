"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { requestRoutePlan, type RoutePoint } from "./route-api";

const RouteMap = dynamic(() => import("./route-map").then((module) => module.RouteMap), { ssr: false });

export function RoutePlanner() {
  const [startingLocation, setStartingLocation] = useState("");
  const [dropOffPoint, setDropOffPoint] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [responsePath, setResponsePath] = useState<RoutePoint[]>([]);
  const [responseText, setResponseText] = useState("");
  const [isResponseTextError, setIsResponseTextError] = useState(false);

  async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setIsResponseTextError(false);
    setResponseText("Your route is being calculated...");
    setResponsePath([]);

    try {
      const routeResult = await requestRoutePlan(
        process.env.NEXT_PUBLIC_API_DOMAIN ?? "",
        startingLocation,
        dropOffPoint,
        () => setResponseText("This might take a bit longer..."),
      );
      setResponseText(routeResult.summaryText);
      setResponsePath(routeResult.path);
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      console.log(error.message);
      setResponseText(error.cause ?? "An Error Occurred. Please Try Again.");
      setIsResponseTextError(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="app-shell">
      <div className="grid min-h-screen lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="app-sidebar">
          <form className="space-y-5" onSubmit={handleSubmit}>
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
              <pre className={`app-response ${isResponseTextError ? "app-response-error" : ""}`}>{responseText}</pre>
            ) : null}

            <div className="flex gap-3">
              <button type="submit" className="app-button app-button-primary cursor-pointer" disabled={isSubmitting}>
                {isSubmitting ? "Finding..." : "Find Route"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStartingLocation("");
                  setDropOffPoint("");
                  setResponseText("");
                  setIsResponseTextError(false);
                  setResponsePath([]);
                }}
                className="app-button app-button-secondary cursor-pointer"
                disabled={isSubmitting}
              >
                Reset
              </button>
            </div>
          </form>
        </aside>

        <section className="h-full app-map-shell">
          <RouteMap path={responsePath} />
        </section>
      </div>
    </main>
  );
}
