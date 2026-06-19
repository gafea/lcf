"use client";

import { useState } from "react";

type RoutePlannerProps = {
  apiDomain: string;
};

export function RoutePlanner({ apiDomain }: RoutePlannerProps) {
  const [startingLocation, setStartingLocation] = useState("");
  const [dropOffPoint, setDropOffPoint] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [responsePath, setResponsePath] = useState([]);
  const [responseText, setResponseText] = useState("");
  const [isResponseTextError, setIsResponseTextError] = useState(false);

  async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      if (!apiDomain) {
        throw new Error("A configuration error occured: API_DOMAIN is not configured.");
      }

      if (!startingLocation.trim()) {
        throw new Error("Please enter your starting location.");
      }

      if (!dropOffPoint.trim()) {
        throw new Error("Please enter your drop-off point.");
      }

      setIsSubmitting(true);
      setIsResponseTextError(false);
      setResponseText("Your route is being calculated...");
      setResponsePath([]);

      // get route token
      const postResponse = await fetch(`${apiDomain}/route`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          origin: startingLocation,
          destination: dropOffPoint,
        }),
      });

      if (!postResponse.ok) {
        throw new Error();
      }

      const { token } = (await postResponse.json()) as { token?: string };

      if (!token) {
        throw new Error();
      }

      // after getting route token, get route and retry until success or error
      while (true) {
        const getResponse = await fetch(`${apiDomain}/route/${token}`);

        if (!getResponse.ok) {
          throw new Error();
        }

        const routeResult = await getResponse.json();
        if (routeResult.status != "in progress") {
          if (routeResult.status === "success") {
            setResponseText(`total distance: ${routeResult.total_distance}\ntotal time: ${routeResult.total_time}`);
            setResponsePath(routeResult.path);
            break;
          }

          throw new Error(routeResult.error ?? "");
        }

        setResponseText("This might take a moment...");
      }
    } catch (error) {
      setIsResponseTextError(true);
      setResponseText(error instanceof Error && error.message ? error.message : "An Error Occurred. Please Try Again.");
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
                {isSubmitting ? "Submitting..." : "Submit"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStartingLocation("");
                  setDropOffPoint("");
                  setResponseText("");
                }}
                className="app-button app-button-secondary cursor-pointer"
              >
                Reset
              </button>
            </div>
          </form>
        </aside>

        <section className="h-full">
          <iframe
            className="app-map"
            loading="lazy"
            src="https://www.openstreetmap.org/export/embed.html?bbox=113.823%2C22.197%2C114.372%2C22.494&layer=mapnik"
          />
        </section>
      </div>
    </main>
  );
}
