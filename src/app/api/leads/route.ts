import { NextRequest, NextResponse } from 'next/server';
import { getDb, type NewLead } from '@/lib/db';
import { geocodeAddress } from '@/lib/geocode';

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') ?? '';
  const status = searchParams.get('status') ?? '';

  let query = 'SELECT * FROM leads WHERE 1=1';
  const params: string[] = [];

  if (search) {
    query += ' AND (name LIKE ? OR phone LIKE ? OR address LIKE ? OR city LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC';

  const leads = db.prepare(query).all(...params);
  return NextResponse.json(leads);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body: NewLead & { lat?: number; lng?: number } = await req.json();

  const result = db.prepare(`
    INSERT INTO leads (name, phone, email, address, city, status, source, notes)
    VALUES (@name, @phone, @email, @address, @city, @status, @source, @notes)
  `).run({
    name: body.name,
    phone: body.phone ?? null,
    email: body.email ?? null,
    address: body.address ?? null,
    city: body.city ?? null,
    status: body.status ?? 'New',
    source: body.source ?? null,
    notes: body.notes ?? null,
  });

  // Use provided coords if available (e.g. from map click), otherwise geocode
  if (body.lat != null && body.lng != null) {
    db.prepare('UPDATE leads SET lat = ?, lng = ? WHERE id = ?').run(body.lat, body.lng, result.lastInsertRowid);
  } else {
    const coords = await geocodeAddress(body.address ?? null, body.city ?? null);
    if (coords) {
      db.prepare('UPDATE leads SET lat = ?, lng = ? WHERE id = ?').run(coords.lat, coords.lng, result.lastInsertRowid);
    }
  }

  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(result.lastInsertRowid);
  return NextResponse.json(lead, { status: 201 });
}
