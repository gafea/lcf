export type RouteHistoryEntry = {
  startingLocation: string;
  dropOffPoint: string;
  lastSearchedAt: number;
};

export const ROUTE_HISTORY_STORAGE_KEY = "route-history";

function normalizeRouteValue(value: string) {
  return value.trim();
}

function getRouteHistoryKey(startingLocation: string, dropOffPoint: string) {
  return `${normalizeRouteValue(startingLocation)}\u0000${normalizeRouteValue(dropOffPoint)}`;
}

function isRouteHistoryEntry(value: unknown): value is RouteHistoryEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as RouteHistoryEntry;

  return (
    typeof candidate.startingLocation === "string" &&
    typeof candidate.dropOffPoint === "string" &&
    typeof candidate.lastSearchedAt === "number" &&
    Number.isFinite(candidate.lastSearchedAt)
  );
}

function sortRouteHistoryEntries(entries: RouteHistoryEntry[]) {
  return [...entries].sort((firstEntry, secondEntry) => secondEntry.lastSearchedAt - firstEntry.lastSearchedAt);
}

export function readRouteHistory(storage: Pick<Storage, "getItem">) {
  const rawHistory = storage.getItem(ROUTE_HISTORY_STORAGE_KEY);

  if (!rawHistory) {
    return [] as RouteHistoryEntry[];
  }

  try {
    const parsedHistory = JSON.parse(rawHistory) as unknown;

    if (!Array.isArray(parsedHistory)) {
      return [] as RouteHistoryEntry[];
    }

    return sortRouteHistoryEntries(parsedHistory.filter(isRouteHistoryEntry));
  } catch {
    return [] as RouteHistoryEntry[];
  }
}

export function upsertRouteHistoryEntry(
  storage: Pick<Storage, "getItem" | "setItem">,
  history: RouteHistoryEntry[],
  startingLocation: string,
  dropOffPoint: string,
  lastSearchedAt = Date.now(),
) {
  const nextEntry = {
    startingLocation: normalizeRouteValue(startingLocation),
    dropOffPoint: normalizeRouteValue(dropOffPoint),
    lastSearchedAt,
  } satisfies RouteHistoryEntry;

  const nextHistory = sortRouteHistoryEntries([
    nextEntry,
    ...history.filter(
      (historyEntry) =>
        getRouteHistoryKey(historyEntry.startingLocation, historyEntry.dropOffPoint) !==
        getRouteHistoryKey(startingLocation, dropOffPoint),
    ),
  ]);

  storage.setItem(ROUTE_HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));

  return nextHistory;
}
