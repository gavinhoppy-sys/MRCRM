'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function DeleteButton({ id }: { id: number }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  async function handleDelete() {
    await fetch(`/api/leads/${id}`, { method: 'DELETE' });
    router.push('/');
    router.refresh();
  }

  if (confirming) {
    return (
      <span className="flex gap-2">
        <Button size="sm" variant="destructive" onClick={handleDelete}>Confirm</Button>
        <Button size="sm" variant="outline" onClick={() => setConfirming(false)}>Cancel</Button>
      </span>
    );
  }

  return (
    <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => setConfirming(true)}>
      Delete
    </Button>
  );
}
