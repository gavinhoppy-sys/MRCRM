import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'crm.db');

const db = new Database(DB_PATH);

const leads = db.prepare(`
  SELECT id, name, address, city FROM leads
  WHERE (address IS NOT NULL OR city IS NOT NULL) AND lat IS NULL
`).all();

console.log(`Found ${leads.length} leads to geocode.\n`);

async function geocode(address, city) {
  const query = [address, city].filter(Boolean).join(', ');
  if (!query) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    const res = await fetch(url, { headers: { 'User-Agent': 'RoofingCRM/1.0' } });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

const update = db.prepare('UPDATE leads SET lat = ?, lng = ? WHERE id = ?');

let succeeded = 0;
let failed = 0;

for (const lead of leads) {
  const coords = await geocode(lead.address, lead.city);
  if (coords) {
    update.run(coords.lat, coords.lng, lead.id);
    console.log(`✓ ${lead.name} → ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
    succeeded++;
  } else {
    console.log(`✗ ${lead.name} — could not geocode "${[lead.address, lead.city].filter(Boolean).join(', ')}"`);
    failed++;
  }
  // Nominatim rate limit: 1 request per second
  await new Promise(r => setTimeout(r, 1100));
}

console.log(`\nDone. ${succeeded} geocoded, ${failed} failed.`);
db.close();
