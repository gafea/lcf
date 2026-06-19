export interface NominatimAddress {
  amenity?: string;
  building?: string;
  shop?: string;
  tourism?: string;
  historic?: string;
  railway?: string;
  house_name?: string;
  place_of_worship?: string;
  aeroway?: string;
  leisure?: string;
  office?: string;
  village?: string;
  neighbourhood?: string;
  road?: string;
  pedestrian?: string;
  path?: string;
  suburb?: string;
  district?: string;
  region?: string;
  state?: string;
  city?: string;
  town?: string;
  county?: string;
  country?: string;
  country_code?: string;
}

export interface NominatimSearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: NominatimAddress;
}

export async function reverseGeocode(lat: number, lon: number): Promise<NominatimSearchResult> {
  const url = `/api/geocoding?lat=${lat}&lon=${lon}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Reverse geocoding failed");
  }
  return await response.json();
}

export async function searchPlaces(
  query: string,
  bounds: { west: number; south: number; east: number; north: number } | null,
): Promise<NominatimSearchResult[]> {
  if (!query.trim()) return [];

  let url = `/api/geocoding?q=${encodeURIComponent(query)}`;
  if (bounds) {
    url += `&viewbox=${bounds.west},${bounds.north},${bounds.east},${bounds.south}`;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Search failed");
  }
  return await response.json();
}

export function formatAddress(data: NominatimSearchResult): string {
  if (!data) return "";
  const address = data.address;
  if (!address) return data.display_name || "";

  const name =
    address.amenity ||
    address.building ||
    address.shop ||
    address.tourism ||
    address.historic ||
    address.railway ||
    address.house_name ||
    address.place_of_worship ||
    address.aeroway ||
    address.leisure ||
    address.office ||
    address.village ||
    address.neighbourhood;

  const road = address.road || address.pedestrian || address.path;
  const suburb = address.suburb || address.neighbourhood || address.district;
  const region = address.region || address.state;
  const city = address.city || address.town || address.village || address.county;

  const parts: string[] = [];
  if (name) parts.push(name);
  if (road && road !== name) parts.push(road);
  if (suburb && suburb !== name && suburb !== road) parts.push(suburb);
  if (region && region !== name && region !== road && region !== suburb) parts.push(region);
  if (city && city !== name && city !== road && city !== suburb && city !== region) parts.push(city);

  if (parts.length > 0) {
    return parts.join(", ");
  }

  return data.display_name || "";
}
