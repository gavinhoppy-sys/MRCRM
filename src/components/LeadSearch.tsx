'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { STATUSES } from '@/lib/constants';

export default function LeadSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  }

  return (
    <div className="flex gap-2 flex-wrap">
      <Input
        className="max-w-xs"
        placeholder="Search name, phone, address..."
        defaultValue={searchParams.get('search') ?? ''}
        onChange={e => update('search', e.target.value)}
      />
      <select
        className="border border-input rounded-md px-3 py-2 text-sm bg-background"
        defaultValue={searchParams.get('status') ?? ''}
        onChange={e => update('status', e.target.value)}
      >
        <option value="">All Statuses</option>
        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    </div>
  );
}
