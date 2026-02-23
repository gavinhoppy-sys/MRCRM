import { NextRequest, NextResponse } from 'next/server';
import { getDb, type NewLead } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(lead);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const body: Partial<NewLead> = await req.json();

  const existing = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  db.prepare(`
    UPDATE leads SET
      name       = @name,
      phone      = @phone,
      email      = @email,
      address    = @address,
      city       = @city,
      status     = @status,
      source     = @source,
      notes      = @notes,
      updated_at = datetime('now')
    WHERE id = @id
  `).run({ ...existing as object, ...body, id });

  const updated = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const result = db.prepare('DELETE FROM leads WHERE id = ?').run(id);
  if (result.changes === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}
