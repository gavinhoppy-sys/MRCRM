export async function geocodeAddress(
  address: string | null,
  city: string | null,
): Promise<{ lat: number; lng: number } | null> {
  const query = [address, city].filter(Boolean).join(', ');
  if (!query) return null;

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'RoofingCRM/1.0' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<{ address: string; city: string } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'RoofingCRM/1.0' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const a = data.address ?? {};
    const house = [a.house_number, a.road].filter(Boolean).join(' ');
    const city = a.city ?? a.town ?? a.village ?? a.suburb ?? '';
    return { address: house, city };
  } catch {
    return null;
  }
}
