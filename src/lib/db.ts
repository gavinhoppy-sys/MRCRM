import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), 'crm.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      phone       TEXT,
      email       TEXT,
      address     TEXT,
      city        TEXT,
      status      TEXT NOT NULL DEFAULT 'New',
      source      TEXT,
      notes       TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migrate: add lat/lng if they don't exist yet
  const cols = (db.prepare('PRAGMA table_info(leads)').all() as { name: string }[]).map(c => c.name);
  if (!cols.includes('lat')) db.exec('ALTER TABLE leads ADD COLUMN lat REAL');
  if (!cols.includes('lng')) db.exec('ALTER TABLE leads ADD COLUMN lng REAL');
}

export type LeadStatus = 'New' | 'Contacted' | 'Quoted' | 'Won' | 'Lost';

export interface Lead {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  status: LeadStatus;
  source: string | null;
  notes: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
  updated_at: string;
}

export type NewLead = Omit<Lead, 'id' | 'created_at' | 'updated_at'>;
