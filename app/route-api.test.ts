import { describe, expect, it, vi } from "vitest";
import { getRouteResult, postRouteToken, requestRoutePlan } from "./route-api";

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
  it("covers POST /mock/route/500", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(textResponse("Internal Server Error", { status: 500 }));

    await expect(postRouteToken("http://localhost:8000", "A", "B", fetchMock)).rejects.toThrow(
      "POST /route failed with status 500",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("covers POST /mock/route/success", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ token: "9d3503e0-7236-4e47-a62f-8b01b5646c16" }));

    await expect(postRouteToken("http://localhost:8000", "A", "B", fetchMock)).resolves.toBe(
      "9d3503e0-7236-4e47-a62f-8b01b5646c16",
    );
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8000/route", expect.objectContaining({ method: "POST" }));
  });

  it("covers GET /mock/route/500", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(textResponse("Internal Server Error", { status: 500 }));

    await expect(getRouteResult("http://localhost:8000", "token-1", fetchMock)).rejects.toThrow(
      "GET /route/token-1 failed with status 500",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("covers GET /mock/route/inprogress", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ status: "in progress" }));

    await expect(getRouteResult("http://localhost:8000", "token-2", fetchMock)).resolves.toEqual({
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

    await expect(getRouteResult("http://localhost:8000", "token-3", fetchMock)).resolves.toEqual({
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

    await expect(getRouteResult("http://localhost:8000", "token-4", fetchMock)).resolves.toEqual({
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

    await expect(requestRoutePlan("http://localhost:8000", "A", "B", fetchMock)).resolves.toEqual({
      path: [
        [22.372081, 114.107877],
        [22.326442, 114.167811],
        [22.284419, 114.15951],
      ],
      summaryText: "total distance: 20000\ntotal time: 1800",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns an error for a GET failure after POST success", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: "token-6" }))
      .mockResolvedValueOnce(textResponse("Internal Server Error", { status: 500 }));

    await expect(requestRoutePlan("http://localhost:8000", "A", "B", fetchMock)).rejects.toThrow(
      "GET /route/token-6 failed with status 500",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
