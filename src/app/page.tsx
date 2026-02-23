import Link from 'next/link';
import { Suspense } from 'react';
import { getDb, type Lead } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { STATUS_COLORS, STATUSES } from '@/lib/constants';
import LeadSearch from '@/components/LeadSearch';

function StatusBadge({ status }: { status: Lead['status'] }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status]}`}>
      {status}
    </span>
  );
}

function getLeads(search: string, status: string): Lead[] {
  const db = getDb();
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
  return db.prepare(query).all(...params) as Lead[];
}

function PipelineSummary() {
  const db = getDb();
  const counts = db.prepare(
    'SELECT status, COUNT(*) as count FROM leads GROUP BY status'
  ).all() as { status: string; count: number }[];

  const map = Object.fromEntries(counts.map(r => [r.status, r.count]));

  return (
    <div className="flex gap-3 flex-wrap">
      {STATUSES.map(s => (
        <div key={s} className={`px-3 py-2 rounded-lg text-sm font-medium ${STATUS_COLORS[s]}`}>
          {s}: <span className="font-bold">{map[s] ?? 0}</span>
        </div>
      ))}
    </div>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string }>;
}) {
  const { search = '', status = '' } = await searchParams;
  const leads = getLeads(search, status);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Roofing CRM</h1>
        <Link href="/leads/new">
          <Button>+ Add Lead</Button>
        </Link>
      </div>

      <PipelineSummary />

      <Suspense>
        <LeadSearch />
      </Suspense>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Name</th>
              <th className="text-left px-4 py-3 font-medium">Phone</th>
              <th className="text-left px-4 py-3 font-medium">Address</th>
              <th className="text-left px-4 py-3 font-medium">Source</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Added</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-muted-foreground">
                  No leads found. <Link href="/leads/new" className="underline">Add your first lead.</Link>
                </td>
              </tr>
            )}
            {leads.map(lead => (
              <tr key={lead.id} className="border-t hover:bg-muted/50 transition-colors">
                <td className="px-4 py-3 font-medium">
                  <Link href={`/leads/${lead.id}`} className="hover:underline">{lead.name}</Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{lead.phone ?? '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {[lead.address, lead.city].filter(Boolean).join(', ') || '—'}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{lead.source ?? '—'}</td>
                <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(lead.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <Link href={`/leads/${lead.id}`}>
                    <Button size="sm" variant="outline">Edit</Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
