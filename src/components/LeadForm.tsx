'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { Lead } from '@/lib/db';
import { STATUSES, SOURCES } from '@/lib/constants';

interface Props {
  lead?: Lead;
}

export default function LeadForm({ lead }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const form = new FormData(e.currentTarget);
    const payload = {
      name:    form.get('name'),
      phone:   form.get('phone') || null,
      email:   form.get('email') || null,
      address: form.get('address') || null,
      city:    form.get('city') || null,
      status:  form.get('status'),
      source:  form.get('source') || null,
      notes:   form.get('notes') || null,
    };

    const url    = lead ? `/api/leads/${lead.id}` : '/api/leads';
    const method = lead ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      router.push('/');
      router.refresh();
    } else {
      setError('Failed to save. Please try again.');
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1">
          <Label htmlFor="name">Name *</Label>
          <Input id="name" name="name" required defaultValue={lead?.name} placeholder="John Smith" />
        </div>

        <div className="space-y-1">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" defaultValue={lead?.phone ?? ''} placeholder="(555) 000-0000" />
        </div>

        <div className="space-y-1">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={lead?.email ?? ''} placeholder="john@example.com" />
        </div>

        <div className="col-span-2 space-y-1">
          <Label htmlFor="address">Address</Label>
          <Input id="address" name="address" defaultValue={lead?.address ?? ''} placeholder="123 Main St" />
        </div>

        <div className="space-y-1">
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" defaultValue={lead?.city ?? ''} placeholder="Austin" />
        </div>

        <div className="space-y-1">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            defaultValue={lead?.status ?? 'New'}
            className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
          >
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="source">Lead Source</Label>
          <select
            id="source"
            name="source"
            defaultValue={lead?.source ?? ''}
            className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
          >
            <option value="">-- Select --</option>
            {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="col-span-2 space-y-1">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" name="notes" defaultValue={lead?.notes ?? ''} rows={4} placeholder="Any details about this lead..." />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving...' : lead ? 'Update Lead' : 'Add Lead'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
