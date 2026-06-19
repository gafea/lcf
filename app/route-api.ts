export type RoutePoint = [number, number];

export type RouteSummaryItem = {
  kind: "distance" | "time";
  title: string;
  value: string;
};

type RouteTokenResponse = {
  token?: string;
};

type RouteSuccessResponse = {
  status: "success";
  path: string[][];
  total_distance: number;
  total_time: number;
};

type RouteFailureResponse = {
  status: "failure";
  error?: string;
};

type RouteInProgressResponse = {
  status: "in progress";
};

type RouteApiResponse = RouteSuccessResponse | RouteFailureResponse | RouteInProgressResponse;

function formatDistance(distanceMeters: number) {
  return `${(distanceMeters / 1000).toFixed(2).replace(/\.00$/, "")} km`;
}

function formatDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);

  if (hours > 0) {
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    return `${hours}h ${minutes ? `${minutes}m` : ""}`.trim();
  }

  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${seconds ? `${seconds}s` : ""}`.trim();
  }

  return `${seconds}s`;
}

function createSummaryItems(routeResult: RouteSuccessResponse): RouteSummaryItem[] {
  return [
    {
      kind: "distance",
      title: "Total Distance",
      value: formatDistance(routeResult.total_distance),
    },
    {
      kind: "time",
      title: "Total Time",
      value: formatDuration(routeResult.total_time),
    },
  ];
}

function toPoint(point: string[]): RoutePoint {
  return [Number(point[0]), Number(point[1])];
}

export async function getRouteToken(apiDomain: string, origin: string, destination: string, useDebugRoute: boolean) {
  const postResponse = await fetch(useDebugRoute ? `${apiDomain}/mock/route/success` : `${apiDomain}/route`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ origin, destination }),
  });

  if (!postResponse.ok) {
    throw new Error(`POST /route failed with status ${postResponse.status}`);
  }

  const { token } = (await postResponse.json()) as RouteTokenResponse;

  if (!token) {
    throw new Error("POST /route did not return a token.");
  }

  return token;
}

export async function getRouteResult(apiDomain: string, token: string, useDebugRoute: boolean) {
  const getResponse = await fetch(useDebugRoute ? `${apiDomain}/mock/route/success` : `${apiDomain}/route/${token}`);

  if (!getResponse.ok) {
    throw new Error(`GET /route/${token} failed with status ${getResponse.status}`);
  }

  const routeResult = (await getResponse.json()) as RouteApiResponse;

  return routeResult;
}

export async function requestRoutePlan(
  apiDomain: string,
  origin: string,
  destination: string,
  onInProgress?: () => void,
  useDebugRoute = false,
) {
  if (!apiDomain) {
    throw new Error("A configuration error occured: API_DOMAIN is not configured.");
  }

  if (!origin.trim()) {
    throw new Error("Missing Required Input", { cause: "Please enter your Starting Location." });
  }

  if (!destination.trim()) {
    throw new Error("Missing Required Input", { cause: "Please enter your Drop-off Point." });
  }

  if (origin.trim().toLowerCase() === destination.trim().toLowerCase()) {
    throw new Error("Invalid Input", { cause: "Starting Location and Drop-off Point cannot be the same." });
  }

  const token = await getRouteToken(apiDomain, origin, destination, useDebugRoute);

  while (true) {
    const routeResult = await getRouteResult(apiDomain, token, useDebugRoute);

    if (routeResult.status === "in progress") {
      onInProgress?.();
      continue;
    }

    if (routeResult.status === "failure") {
      throw new Error("Route request failed.", { cause: routeResult.error });
    }

    return {
      path: routeResult.path.map(toPoint),
      summaryItems: createSummaryItems(routeResult),
    };
  }
}
