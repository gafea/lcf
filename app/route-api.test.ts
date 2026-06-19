import { afterEach, describe, expect, it, vi } from "vitest";
import { getRouteResult, getRouteToken, requestRoutePlan } from "./route-api";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function textResponse(body: string, init?: ResponseInit) {
  return new Response(body, init);
}

describe("route API helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("covers POST /mock/route/500", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(textResponse("Internal Server Error", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getRouteToken("http://localhost:8000", "A", "B", false)).rejects.toThrow(
      "POST /route failed with status 500",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("covers POST /mock/route/success", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ token: "9d3503e0-7236-4e47-a62f-8b01b5646c16" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getRouteToken("http://localhost:8000", "A", "B", false)).resolves.toBe(
      "9d3503e0-7236-4e47-a62f-8b01b5646c16",
    );
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8000/route", expect.objectContaining({ method: "POST" }));
  });

  it("covers GET /mock/route/500", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(textResponse("Internal Server Error", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getRouteResult("http://localhost:8000", "token-1", false)).rejects.toThrow(
      "GET /route/token-1 failed with status 500",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("covers GET /mock/route/inprogress", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ status: "in progress" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getRouteResult("http://localhost:8000", "token-2", false)).resolves.toEqual({
      status: "in progress",
    });
  });

  it("covers GET /mock/route/failure", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        status: "failure",
        error: "Location not accessible by car",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getRouteResult("http://localhost:8000", "token-3", false)).resolves.toEqual({
      status: "failure",
      error: "Location not accessible by car",
    });
  });

  it("covers GET /mock/route/success", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        status: "success",
        path: [
          ["22.372081", "114.107877"],
          ["22.326442", "114.167811"],
          ["22.284419", "114.159510"],
        ],
        total_distance: 20000,
        total_time: 1800,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getRouteResult("http://localhost:8000", "token-4", false)).resolves.toEqual({
      status: "success",
      path: [
        ["22.372081", "114.107877"],
        ["22.326442", "114.167811"],
        ["22.284419", "114.159510"],
      ],
      total_distance: 20000,
      total_time: 1800,
    });
  });

  it("returns the full route summary after POST success and GET success", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: "token-5" }))
      .mockResolvedValueOnce(
        jsonResponse({
          status: "success",
          path: [
            ["22.372081", "114.107877"],
            ["22.326442", "114.167811"],
            ["22.284419", "114.159510"],
          ],
          total_distance: 20000,
          total_time: 1800,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestRoutePlan("http://localhost:8000", "A", "B")).resolves.toEqual({
      path: [
        [22.372081, 114.107877],
        [22.326442, 114.167811],
        [22.284419, 114.15951],
      ],
      summaryItems: [
        { kind: "distance", title: "Total Distance", value: "20 km" },
        { kind: "time", title: "Total Time", value: "30m" },
      ],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns an error for a GET failure after POST success", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: "token-6" }))
      .mockResolvedValueOnce(textResponse("Internal Server Error", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestRoutePlan("http://localhost:8000", "A", "B")).rejects.toThrow(
      "GET /route/token-6 failed with status 500",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
