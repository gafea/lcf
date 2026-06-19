import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");
  const q = searchParams.get("q");

  const headers = {
    "User-Agent": "LCF-RoutePlanner/1.0 (cakko@users.noreply.github.com)",
  };

  try {
    if (lat && lon) {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1&accept-language=en`;
      const response = await fetch(url, { headers });
      if (!response.ok) {
        return NextResponse.json({ error: "Nominatim reverse geocode failed" }, { status: response.status });
      }
      const data = await response.json();
      return NextResponse.json(data);
    } else if (q) {
      const viewbox = searchParams.get("viewbox");
      let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&accept-language=en&addressdetails=1&limit=5`;
      if (viewbox) {
        url += `&viewbox=${viewbox}&bounded=0`;
      }
      const response = await fetch(url, { headers });
      if (!response.ok) {
        return NextResponse.json({ error: "Nominatim search failed" }, { status: response.status });
      }
      const data = await response.json();
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  } catch (error) {
    console.error("Geocoding proxy error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
