import { NextResponse } from 'next/server';

const COUNTIES = {
  'Salt Lake': 'https://services1.arcgis.com/99lidPhWCzftIe9K/ArcGIS/rest/services/Parcels_SaltLake_LIR/FeatureServer/0',
  'Utah':      'https://services1.arcgis.com/99lidPhWCzftIe9K/ArcGIS/rest/services/Parcels_Utah_LIR/FeatureServer/0',
  'Davis':     'https://services1.arcgis.com/99lidPhWCzftIe9K/ArcGIS/rest/services/Parcels_Davis_LIR/FeatureServer/0',
  'Weber':     'https://services1.arcgis.com/99lidPhWCzftIe9K/ArcGIS/rest/services/Parcels_Weber_LIR/FeatureServer/0',
};

const MIN_GUST_MPH = 45;   // shingles start lifting at ~45 mph gust
const LOOKBACK_YEARS = 2;

// ~4km grid cells for parcel matching
const CELL_SIZE = 0.04;

// How many parcel cells to expand around each ERA5 wind point (ERA5 = ~0.25° grid,
// so 4 cells × 0.04° = 0.16° expansion keeps us within that ERA5 tile)
const WIND_EXPAND = 4;

function cellKey(lat: number, lon: number): string {
  return `${Math.floor(lat / CELL_SIZE)},${Math.floor(lon / CELL_SIZE)}`;
}

interface WindPoint {
  lat: number;
  lon: number;
  maxGust: number;
}

/**
 * Fetch historical daily max wind gusts from Open-Meteo ERA5 reanalysis.
 * ERA5 is actual meteorological model data — not storm spotter reports —
 * so it covers the entire area with no gaps.
 *
 * We sample a grid of points across the Wasatch Front (the 4 target counties)
 * at 0.25° spacing (ERA5's native resolution) and flag any point that had a
 * daily max gust >= 45 mph in the last 2 years.
 */
async function fetchWindPoints(): Promise<WindPoint[]> {
  // Bounding box covering Salt Lake, Utah, Davis, Weber counties
  const LAT_MIN = 39.75, LAT_MAX = 41.50;
  const LON_MIN = -112.50, LON_MAX = -111.25;
  const STEP = 0.25; // ERA5 native resolution

  const lats: number[] = [];
  const lons: number[] = [];
  for (let lat = LAT_MIN; lat <= LAT_MAX + 0.01; lat += STEP) {
    for (let lon = LON_MIN; lon <= LON_MAX + 0.01; lon += STEP) {
      lats.push(Math.round(lat * 100) / 100);
      lons.push(Math.round(lon * 100) / 100);
    }
  }

  const end = new Date();
  // ERA5 archive has ~5 day lag; cap end date safely
  end.setDate(end.getDate() - 5);
  const start = new Date(end);
  start.setFullYear(start.getFullYear() - LOOKBACK_YEARS);

  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);

  const url =
    `https://archive-api.open-meteo.com/v1/archive` +
    `?latitude=${lats.join(',')}&longitude=${lons.join(',')}` +
    `&start_date=${startDate}&end_date=${endDate}` +
    `&daily=wind_gusts_10m_max&wind_speed_unit=mph&timezone=UTC`;

  try {
    const res = await fetch(url, {
      next: { revalidate: 86400 }, // cache 24h — historical data doesn't change
      headers: { 'User-Agent': 'RoofingCRM/1.0' },
    });
    if (!res.ok) return [];

    const data = await res.json();
    // Open-Meteo returns an array when multiple locations are requested
    const locations: Array<{ latitude: number; longitude: number; daily?: { wind_gusts_10m_max?: (number | null)[] } }> =
      Array.isArray(data) ? data : [data];

    const windyPoints: WindPoint[] = [];
    for (const loc of locations) {
      const gusts = (loc.daily?.wind_gusts_10m_max ?? []).filter(
        (v): v is number => v != null && Number.isFinite(v)
      );
      if (gusts.length === 0) continue;
      const maxGust = gusts.reduce((a, b) => (b > a ? b : a), 0);
      if (maxGust >= MIN_GUST_MPH) {
        windyPoints.push({ lat: loc.latitude, lon: loc.longitude, maxGust });
      }
    }

    return windyPoints;
  } catch {
    return [];
  }
}

interface Centroid {
  lat: number;
  lon: number;
}

/**
 * Fetch parcel centroids for homes 15+ years old, 4000+ sqft from ArcGIS.
 */
async function fetchParcelCentroids(): Promise<Centroid[]> {
  const maxBuiltYear = new Date().getFullYear() - 15;
  const where =
    `BUILT_YR <= ${maxBuiltYear} AND BUILT_YR > 1800` +
    ` AND BLDG_SQFT >= 4000 AND BLDG_SQFT <= 15000` +
    ` AND PROP_CLASS = 'Residential' AND PRIMARY_RES = 'Y'`;

  const centroids: Centroid[] = [];

  await Promise.all(
    Object.values(COUNTIES).map(async (serviceUrl) => {
      try {
        const url =
          `${serviceUrl}/query?` +
          new URLSearchParams({
            where,
            outFields: 'PARCEL_ID',
            returnCentroid: 'true',
            returnGeometry: 'false',
            resultRecordCount: '2000',
            f: 'json',
          });

        const res = await fetch(url, { next: { revalidate: 3600 } });
        if (!res.ok) return;
        const data = await res.json();

        for (const f of data.features ?? []) {
          const c = f.centroid;
          if (c?.x != null && c?.y != null) {
            centroids.push({ lat: c.y, lon: c.x });
          }
        }
      } catch {
        // county failure is non-fatal
      }
    })
  );

  return centroids;
}

export async function GET() {
  try {
    const [windPoints, parcelCentroids] = await Promise.all([
      fetchWindPoints(),
      fetchParcelCentroids(),
    ]);

    // Expand each ERA5 wind point to nearby parcel-grid cells
    const windCells = new Set<string>();
    for (const wp of windPoints) {
      const baseLat = Math.floor(wp.lat / CELL_SIZE);
      const baseLon = Math.floor(wp.lon / CELL_SIZE);
      for (let di = -WIND_EXPAND; di <= WIND_EXPAND; di++) {
        for (let dj = -WIND_EXPAND; dj <= WIND_EXPAND; dj++) {
          windCells.add(`${baseLat + di},${baseLon + dj}`);
        }
      }
    }

    // Build parcel cell set
    const parcelCells = new Set<string>();
    for (const c of parcelCentroids) parcelCells.add(cellKey(c.lat, c.lon));

    // Intersection: cells in wind zones that also have qualifying parcels
    const matchingKeys: string[] = [];
    for (const key of windCells) {
      if (parcelCells.has(key)) matchingKeys.push(key);
    }

    // Convert to GeoJSON rectangles
    const features = matchingKeys.map((key) => {
      const [latIdx, lonIdx] = key.split(',').map(Number);
      const s = latIdx * CELL_SIZE;
      const n = s + CELL_SIZE;
      const w = lonIdx * CELL_SIZE;
      const e = w + CELL_SIZE;

      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Polygon' as const,
          coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]],
        },
        properties: { key },
      };
    });

    return NextResponse.json({
      type: 'FeatureCollection',
      features,
      meta: {
        windEventCount: windPoints.length,   // ERA5 grid points with 45+ mph gusts
        parcelCount: parcelCentroids.length,
        matchingZones: matchingKeys.length,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
