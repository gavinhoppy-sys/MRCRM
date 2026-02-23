'use client';

import dynamic from 'next/dynamic';
import type { Lead } from '@/lib/db';

const LeadsMap = dynamic(() => import('@/components/LeadsMap'), { ssr: false });

export default function MapWrapper({ leads }: { leads: Lead[] }) {
  return <LeadsMap leads={leads} />;
}
