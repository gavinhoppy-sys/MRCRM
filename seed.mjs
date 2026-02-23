import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, 'crm.db'));

db.pragma('journal_mode = WAL');

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

const leads = [
  { name: 'Mike Hargrove',    phone: '(512) 334-7821', email: 'mike.h@gmail.com',      address: '4821 Ridgewood Dr',   city: 'Austin',       status: 'New',       source: 'Door Knock', notes: 'Hail damage from last storm. Interested in full replacement.' },
  { name: 'Sandra Okonkwo',   phone: '(512) 889-2245', email: 'sokonkwo@yahoo.com',    address: '217 Pecan Grove Ln',  city: 'Austin',       status: 'Contacted', source: 'Facebook',   notes: 'Called back, left voicemail. Try again Thursday.' },
  { name: 'James & Pam Tully',phone: '(737) 420-9901', email: null,                    address: '903 Limestone Blvd',  city: 'Round Rock',   status: 'Quoted',    source: 'Referral',   notes: 'Quote sent $14,200 for full tear-off. Following up next week.' },
  { name: 'Carlos Mendez',    phone: '(512) 601-5533', email: 'cmendez82@gmail.com',   address: '1450 Sunset Hills Rd',city: 'Cedar Park',   status: 'Won',       source: 'Google',     notes: 'Signed contract. Job scheduled for March 3rd.' },
  { name: 'Brenda Kastner',   phone: '(512) 772-0034', email: 'bkastner@outlook.com',  address: '88 Willowbrook Ct',   city: 'Pflugerville', status: 'Lost',      source: 'Website',    notes: 'Went with competitor. Price was the issue.' },
  { name: 'Tom Whitfield',    phone: '(737) 555-1192', email: null,                    address: '3309 Oakdale Pass',   city: 'Austin',       status: 'New',       source: 'Yard Sign',  notes: 'Saw sign on Oakdale. Wants estimate for leak repair.' },
  { name: 'Angela Reyes',     phone: '(512) 490-8823', email: 'angela.reyes@me.com',   address: '612 Copper Ridge Rd', city: 'Leander',      status: 'Contacted', source: 'Referral',   notes: 'Referred by Carlos Mendez. Interested in full replacement.' },
  { name: 'Doug Simmons',     phone: '(512) 338-4410', email: 'dsimmons55@gmail.com',  address: '2271 Travis View Dr', city: 'Austin',       status: 'Quoted',    source: 'Door Knock', notes: 'Quote for $9,800. Waiting on insurance adjuster report.' },
];

const stmt = db.prepare(`
  INSERT INTO leads (name, phone, email, address, city, status, source, notes)
  VALUES (@name, @phone, @email, @address, @city, @status, @source, @notes)
`);

const insertMany = db.transaction((leads) => {
  for (const lead of leads) stmt.run(lead);
});

insertMany(leads);

console.log(`Seeded ${leads.length} leads.`);
db.close();
