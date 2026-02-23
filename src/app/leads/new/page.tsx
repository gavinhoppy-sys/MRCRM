import Link from 'next/link';
import LeadForm from '@/components/LeadForm';

export default function NewLeadPage() {
  return (
    <div className="p-6 max-w-xl mx-auto space-y-6">
      <div>
        <Link href="/" className="text-sm text-muted-foreground hover:underline">← Back to leads</Link>
        <h1 className="text-2xl font-bold mt-1">Add New Lead</h1>
      </div>
      <LeadForm />
    </div>
  );
}
