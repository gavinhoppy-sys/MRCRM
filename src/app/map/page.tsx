export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getDb, type Lead } from '@/lib/db';
import { Button } from '@/components/ui/button';
import MapWrapper from '@/components/MapWrapper';

export default function MapPage() {
  const db = getDb();
  const leads = db.prepare('SELECT * FROM leads').all() as Lead[];
  const geocoded = leads.filter(l => l.lat != null && l.lng != null);

  return (
    <div className="flex flex-col h-[calc(100vh-57px)]">
      <div className="flex items-center justify-between px-6 py-3 border-b">
        <div>
          <h1 className="text-lg font-semibold">Lead Map</h1>
          <p className="text-sm text-muted-foreground">
            {geocoded.length} of {leads.length} leads mapped
          </p>
        </div>
        <Link href="/">
          <Button variant="outline" size="sm">Back to leads</Button>
        </Link>
      </div>

      <div className="flex-1">
        <MapWrapper leads={leads} />
      </div>
    </div>
  );
}
