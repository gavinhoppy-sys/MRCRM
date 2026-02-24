'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import type { Prospect } from '@/app/api/prospecting/route';

const ALL_COUNTIES = ['Salt Lake', 'Utah', 'Davis', 'Weber'];

function exportCSV(prospects: Prospect[]) {
  const headers = ['Address', 'City', 'County', 'Sq Ft', 'Year Built', 'Age (yrs)'];
  const rows = prospects.map(p => [
    `"${p.address}"`,
    `"${p.city}"`,
    `"${p.county} County"`,
    p.sqft,
    p.builtYear,
    p.age,
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `utah-roofing-prospects-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ProspectingPage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [counties, setCounties] = useState<string[]>(ALL_COUNTIES);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const fetchProspects = useCallback(async (selectedCounties: string[], currentPage: number) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        counties: selectedCounties.join(','),
        page: String(currentPage),
      });
      const res = await fetch(`/api/prospecting?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setProspects(data.prospects);
      setTotal(data.total);
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch {
      setError('Failed to load prospects. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProspects(counties, 0);
  }, []);

  async function handleExport() {
    setExporting(true);
    try {
      const params = new URLSearchParams({
        counties: counties.join(','),
        export: '1',
      });
      const res = await fetch(`/api/prospecting?${params}`);
      const data = await res.json();
      exportCSV(data.prospects);
    } finally {
      setExporting(false);
    }
  }

  function toggleCounty(county: string) {
    setCounties(prev =>
      prev.includes(county) ? prev.filter(c => c !== county) : [...prev, county]
    );
  }

  function handleSearch() {
    fetchProspects(counties, 0);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Prospecting</h1>
          <p className="text-sm text-muted-foreground">
            Utah homes 4,000+ sq ft · Built before {new Date().getFullYear() - 20} · Sorted by size
          </p>
        </div>
        <Button onClick={handleExport} disabled={exporting || prospects.length === 0} variant="outline">
          {exporting ? 'Exporting…' : `Export CSV (${total.toLocaleString()} total)`}
        </Button>
      </div>

      {/* County filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium text-muted-foreground">Counties:</span>
        {ALL_COUNTIES.map(c => (
          <label key={c} className="flex items-center gap-1.5 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={counties.includes(c)}
              onChange={() => toggleCounty(c)}
              className="rounded"
            />
            {c}
          </label>
        ))}
        <Button size="sm" onClick={handleSearch} disabled={loading || counties.length === 0}>
          {loading ? 'Loading…' : 'Search'}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Direct mail tip */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
        <strong>Direct mail format:</strong> Export CSV and use with USPS EDDM or a mail house. Address to <em>"Current Resident"</em> — no owner name required.
      </div>

      {/* Results table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Address</th>
              <th className="text-left px-4 py-3 font-medium">City</th>
              <th className="text-left px-4 py-3 font-medium">County</th>
              <th className="text-right px-4 py-3 font-medium">Sq Ft</th>
              <th className="text-right px-4 py-3 font-medium">Built</th>
              <th className="text-right px-4 py-3 font-medium">Age</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="text-center py-16 text-muted-foreground">
                  Loading properties… this may take 15–30 seconds on first load.
                </td>
              </tr>
            )}
            {!loading && prospects.length === 0 && !error && (
              <tr>
                <td colSpan={6} className="text-center py-16 text-muted-foreground">
                  No results. Select at least one county and click Search.
                </td>
              </tr>
            )}
            {!loading && prospects.map((p, i) => (
              <tr key={`${p.id}-${i}`} className="border-t hover:bg-muted/50 transition-colors">
                <td className="px-4 py-2.5 font-medium">{p.address || '—'}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{p.city || '—'}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{p.county} County</td>
                <td className="px-4 py-2.5 text-right">{p.sqft.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right">{p.builtYear}</td>
                <td className="px-4 py-2.5 text-right">{p.age} yrs</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {page * 100 + 1}–{Math.min((page + 1) * 100, total)} of {total.toLocaleString()} properties
          </span>
          <div className="flex gap-2">
            <Button
              size="sm" variant="outline"
              disabled={page === 0 || loading}
              onClick={() => fetchProspects(counties, page - 1)}
            >
              Previous
            </Button>
            <Button
              size="sm" variant="outline"
              disabled={page >= totalPages - 1 || loading}
              onClick={() => fetchProspects(counties, page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
