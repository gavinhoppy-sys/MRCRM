import { NextResponse } from 'next/server';

const COUNTIES = {
  'Salt Lake': 'https://services1.arcgis.com/99lidPhWCzftIe9K/ArcGIS/rest/services/Parcels_SaltLake_LIR/FeatureServer/0',
  'Utah':      'https://services1.arcgis.com/99lidPhWCzftIe9K/ArcGIS/rest/services/Parcels_Utah_LIR/FeatureServer/0',
  'Davis':     'https://services1.arcgis.com/99lidPhWCzftIe9K/ArcGIS/rest/services/Parcels_Davis_LIR/FeatureServer/0',
  'Weber':     'https://services1.arcgis.com/99lidPhWCzftIe9K/ArcGIS/rest/services/Parcels_Weber_LIR/FeatureServer/0',
};

// ~4km grid cells — coarse enough to represent a "neighborhood" zone
const CELL_SIZE = 0.04;

function cellKey(lat: number, lon: number): string {
  return `${Math.floor(lat / CELL_SIZE)},${Math.floor(lon / CELL_SIZE)}`;
}

interface WindEvent {
  lat: number;
  lon: number;
  magnitude: number;
  time: string;
  typetext: string;
}

/**
 * Fetch high-wind Local Storm Reports from Iowa Environmental Mesonet.
 * Types: W = TSTM WND GST (≥58 mph), G = NON-TSTM WND GST
 * We filter to magnitude >= 60 mph.
 */
async function fetchWindEvents(): Promise<WindEvent[]> {
  const end = new Date();
  const start = new Date(end);
  start.setFullYear(start.getFullYear() - 1);

  const sts = start.toISOString().slice(0, 19) + 'Z';
  const ets = end.toISOString().slice(0, 19) + 'Z';

  const events: WindEvent[] = [];

  for (const type of ['W', 'G']) {
    try {
      const url =
        `https://mesonet.agron.iastate.edu/api/1/lsrs.geojson` +
        `?sts=${sts}&ets=${ets}&states=UT&type=${type}`;

      const res = await fetch(url, {
        next: { revalidate: 3600 },
        headers: { 'User-Agent': 'RoofingCRM/1.0' },
      });
      if (!res.ok) continue;

      const data = await res.json();
      for (const f of data.features ?? []) {
        const mag = Number(f.properties?.magnitude ?? 0);
        if (mag < 60) continue;
        const [lon, lat] = f.geometry?.coordinates ?? [];
        if (!lat || !lon) continue;
        events.push({
          lat,
          lon,
          magnitude: mag,
          time: String(f.properties?.valid ?? ''),
          typetext: String(f.properties?.typetext ?? ''),
        });
      }
    } catch {
      // one type failing shouldn't abort everything
    }
  }

  return events;
}

interface Centroid {
  lat: number;
  lon: number;
}

/**
 * Fetch parcel centroids for homes 20+ years old, 4000+ sqft from ArcGIS.
 * Uses returnCentroid=true so we don't pull full polygon geometry.
 */
async function fetchParcelCentroids(): Promise<Centroid[]> {
  const maxBuiltYear = new Date().getFullYear() - 20;
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
    const [windEvents, parcelCentroids] = await Promise.all([
      fetchWindEvents(),
      fetchParcelCentroids(),
    ]);

    // Build cell sets for each criterion
    const windCells = new Set<string>();
    for (const e of windEvents) windCells.add(cellKey(e.lat, e.lon));

    const parcelCells = new Set<string>();
    for (const c of parcelCentroids) parcelCells.add(cellKey(c.lat, c.lon));

    // Intersection: cells with BOTH wind events AND qualifying parcels
    const matchingKeys: string[] = [];
    for (const key of windCells) {
      if (parcelCells.has(key)) matchingKeys.push(key);
    }

    // Convert grid cells to GeoJSON polygon rectangles
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
        windEventCount: windEvents.length,
        parcelCount: parcelCentroids.length,
        matchingZones: matchingKeys.length,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
