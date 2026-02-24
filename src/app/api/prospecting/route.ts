import { NextRequest, NextResponse } from 'next/server';

const COUNTIES = {
  'Salt Lake': 'https://services1.arcgis.com/99lidPhWCzftIe9K/ArcGIS/rest/services/Parcels_SaltLake_LIR/FeatureServer/0',
  'Utah':      'https://services1.arcgis.com/99lidPhWCzftIe9K/ArcGIS/rest/services/Parcels_Utah_LIR/FeatureServer/0',
  'Davis':     'https://services1.arcgis.com/99lidPhWCzftIe9K/ArcGIS/rest/services/Parcels_Davis_LIR/FeatureServer/0',
  'Weber':     'https://services1.arcgis.com/99lidPhWCzftIe9K/ArcGIS/rest/services/Parcels_Weber_LIR/FeatureServer/0',
};

const CURRENT_YEAR = new Date().getFullYear();
const MAX_AGE_YEAR = CURRENT_YEAR - 20; // 20+ years old
const MIN_SQFT = 4000;
const RECORDS_PER_COUNTY = 2000;

export interface Prospect {
  id: string;
  address: string;
  city: string;
  county: string;
  sqft: number;
  builtYear: number;
  age: number;
  propClass: string;
}

async function fetchCounty(countyName: string, serviceUrl: string): Promise<Prospect[]> {
  const where = `BUILT_YR <= ${MAX_AGE_YEAR} AND BUILT_YR > 1800 AND BLDG_SQFT >= ${MIN_SQFT} AND BLDG_SQFT <= 15000 AND PROP_CLASS = 'Residential' AND PRIMARY_RES = 'Y'`;
  const fields = 'PARCEL_ID,PARCEL_ADD,PARCEL_CITY,BLDG_SQFT,BUILT_YR,PROP_CLASS';

  const url = `${serviceUrl}/query?` + new URLSearchParams({
    where,
    outFields: fields,
    resultRecordCount: String(RECORDS_PER_COUNTY),
    orderByFields: 'BLDG_SQFT DESC',
    f: 'json',
  });

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } }); // cache 1 hour
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.features) return [];

    return data.features
      .map((f: { attributes: Record<string, unknown> }) => {
        const a = f.attributes;
        const sqft = Number(a.BLDG_SQFT) || 0;
        const builtYear = Number(a.BUILT_YR) || 0;
        if (sqft < MIN_SQFT || builtYear <= 1800) return null;
        return {
          id: String(a.PARCEL_ID ?? ''),
          address: String(a.PARCEL_ADD ?? '').trim(),
          city: String(a.PARCEL_CITY ?? '').trim(),
          county: countyName,
          sqft,
          builtYear,
          age: CURRENT_YEAR - builtYear,
          propClass: String(a.PROP_CLASS ?? ''),
        };
      })
      .filter(Boolean) as Prospect[];
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const countyFilter = searchParams.get('counties')?.split(',').filter(Boolean) ?? Object.keys(COUNTIES);
  const page = parseInt(searchParams.get('page') ?? '0');
  const pageSize = 100;
  const exportAll = searchParams.get('export') === '1';

  const selectedCounties = Object.entries(COUNTIES).filter(([name]) => countyFilter.includes(name));

  const results = await Promise.all(
    selectedCounties.map(([name, url]) => fetchCounty(name, url))
  );

  const all = results.flat().sort((a, b) => b.sqft - a.sqft);

  if (exportAll) {
    return NextResponse.json({ prospects: all, total: all.length });
  }

  const paginated = all.slice(page * pageSize, (page + 1) * pageSize);
  return NextResponse.json({
    prospects: paginated,
    total: all.length,
    page,
    pageSize,
    totalPages: Math.ceil(all.length / pageSize),
  });
}
