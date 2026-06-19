"use client";

import { useState } from "react";

export default function Home() {
  const [startingLocation, setStartingLocation] = useState("");
  const [dropOffPoint, setDropOffPoint] = useState("");

  return (
    <main className="app-shell">
      <div className="grid min-h-screen lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="app-sidebar">
          <form
            className="space-y-5"
            onSubmit={(event) => event.preventDefault()}
          >
            <label className="block space-y-2 text-sm font-medium">
              <span>Starting Location</span>
              <input
                value={startingLocation}
                onChange={(event) => setStartingLocation(event.target.value)}
                autoComplete="on"
                className="app-input"
                placeholder="Type a starting location"
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
              />
            </label>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="app-button app-button-primary cursor-pointer"
              >
                Submit
              </button>
              <button
                type="button"
                onClick={() => {
                  setStartingLocation("");
                  setDropOffPoint("");
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
