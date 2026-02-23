import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb, type Lead } from '@/lib/db';
import LeadForm from '@/components/LeadForm';
import DeleteButton from '@/components/DeleteButton';

export default async function EditLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id) as Lead | undefined;

  if (!lead) notFound();

  return (
    <div className="p-6 max-w-xl mx-auto space-y-6">
      <div>
        <Link href="/" className="text-sm text-muted-foreground hover:underline">← Back to leads</Link>
        <h1 className="text-2xl font-bold mt-1">{lead.name}</h1>
        <p className="text-sm text-muted-foreground">Added {new Date(lead.created_at).toLocaleDateString()}</p>
      </div>
      <LeadForm lead={lead} />
      <div className="border-t pt-4">
        <p className="text-sm text-muted-foreground mb-2">Danger zone</p>
        <DeleteButton id={lead.id} />
      </div>
    </div>
  );
}
