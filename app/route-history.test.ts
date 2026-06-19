import { describe, expect, it, vi } from "vitest";
import {
  readRouteHistory,
  ROUTE_HISTORY_STORAGE_KEY,
  upsertRouteHistoryEntry,
  clearRouteHistory,
} from "./route-history";

function createStorage(initialValue?: string) {
  const store = new Map<string, string>();

  if (typeof initialValue === "string") {
    store.set(ROUTE_HISTORY_STORAGE_KEY, initialValue);
  }

  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
  } satisfies Pick<Storage, "getItem" | "setItem">;
}

describe("route history helpers", () => {
  it("returns sorted history entries from storage", () => {
    const storage = createStorage(
      JSON.stringify([
        { startingLocation: "B", dropOffPoint: "C", lastSearchedAt: 10 },
        { startingLocation: "A", dropOffPoint: "B", lastSearchedAt: 20 },
      ]),
    );

    expect(readRouteHistory(storage)).toEqual([
      { startingLocation: "A", dropOffPoint: "B", lastSearchedAt: 20 },
      { startingLocation: "B", dropOffPoint: "C", lastSearchedAt: 10 },
    ]);
  });

  it("upserts a trimmed unique pair and keeps the newest search first", () => {
    const storage = createStorage(JSON.stringify([{ startingLocation: "A", dropOffPoint: "B", lastSearchedAt: 10 }]));

    expect(
      upsertRouteHistoryEntry(
        storage,
        [{ startingLocation: "A", dropOffPoint: "B", lastSearchedAt: 10 }],
        " A ",
        " B ",
        30,
      ),
    ).toEqual([{ startingLocation: "A", dropOffPoint: "B", lastSearchedAt: 30 }]);
    expect(storage.setItem).toHaveBeenCalledWith(
      ROUTE_HISTORY_STORAGE_KEY,
      JSON.stringify([{ startingLocation: "A", dropOffPoint: "B", lastSearchedAt: 30 }]),
    );
  });

  it("clears history from storage", () => {
    const store = new Map<string, string>();
    store.set(ROUTE_HISTORY_STORAGE_KEY, "[]");
    const storage = {
      removeItem: vi.fn((key: string) => {
        store.delete(key);
      }),
    } satisfies Pick<Storage, "removeItem">;

    clearRouteHistory(storage);
    expect(storage.removeItem).toHaveBeenCalledWith(ROUTE_HISTORY_STORAGE_KEY);
    expect(store.has(ROUTE_HISTORY_STORAGE_KEY)).toBe(false);
  });
});
