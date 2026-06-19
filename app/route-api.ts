export type RoutePoint = [number, number];

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

function toPoint(point: string[]): RoutePoint {
  return [Number(point[0]), Number(point[1])];
}

export async function getRouteToken(apiDomain: string, origin: string, destination: string) {
  if (!apiDomain) {
    throw new Error("A configuration error occured: API_DOMAIN is not configured.");
  }

  if (!origin.trim()) {
    throw new Error("Missing Required Input", { cause: "Please enter your Starting Location." });
  }

  if (!destination.trim()) {
    throw new Error("Missing Required Input", { cause: "Please enter your Drop-off Point." });
  }

  const postResponse = await fetch(`${apiDomain}/route`, {
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

export async function getRouteResult(apiDomain: string, token: string) {
  const getResponse = await fetch(`${apiDomain}/route/${token}`);

  if (!getResponse.ok) {
    throw new Error(`GET /route/${token} failed with status ${getResponse.status}`);
  }

  const routeResult = (await getResponse.json()) as RouteApiResponse;

  return routeResult;
}

async function requestRoutePlanDebug(apiDomain: string, origin: string, destination: string) {
  const postResponse = await fetch(`${apiDomain}/mock/route/success`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ origin, destination }),
  });

  if (!postResponse.ok) {
    throw new Error(`POST /mock/route/success failed with status ${postResponse.status}`);
  }

  const getResponse = await fetch(`${apiDomain}/mock/route/success`);

  if (!getResponse.ok) {
    throw new Error(`GET /mock/route/success failed with status ${getResponse.status}`);
  }

  const routeResult = (await getResponse.json()) as RouteSuccessResponse;

  return {
    path: routeResult.path.map(toPoint),
    summaryText: `total distance: ${routeResult.total_distance}\ntotal time: ${routeResult.total_time}`,
  };
}

export async function requestRoutePlan(
  apiDomain: string,
  origin: string,
  destination: string,
  onInProgress?: () => void,
  useDebugRoute = false,
) {
  if (useDebugRoute) return await requestRoutePlanDebug(apiDomain, origin, destination);

  const token = await getRouteToken(apiDomain, origin, destination);

  while (true) {
    const routeResult = await getRouteResult(apiDomain, token);

    if (routeResult.status === "in progress") {
      onInProgress?.();
      continue;
    }

    if (routeResult.status === "failure") {
      throw new Error("Route request failed.", { cause: routeResult.error });
    }

    return {
      path: routeResult.path.map(toPoint),
      summaryText: `total distance: ${routeResult.total_distance}\ntotal time: ${routeResult.total_time}`,
    };
  }
}
