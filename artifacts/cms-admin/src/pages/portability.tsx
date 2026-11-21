import { useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, PageHeader, Select } from '@/components/ui';

type PreviewItem = { index: number; kind: string; title: string; key: string; proposedKey: string; duplicate: boolean; source: string; warnings: string[] };
type Preview = { items: PreviewItem[]; errors: string[]; total: number; note: string };
type Report = { created: number; skipped: number; failed: number; items: Array<{ index: number; kind: string; title: string; status: string; key: string; message: string }> };

const scopes = ['all', 'pages', 'posts', 'taxonomy', 'media', 'menus', 'seo', 'metrics', 'testimonials', 'faqs', 'logos', 'products'];
const csvScopes = scopes.filter((scope) => !['all', 'menus', 'seo'].includes(scope));

async function responseError(response: Response) {
  const data = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  return data?.error?.message || `Request failed (${response.status}).`;
}

export function PortabilityPage() {
  const [format, setFormat] = useState('json');
  const [scope, setScope] = useState('all');
  const [files, setFiles] = useState<File[]>([]);
  const [strategy, setStrategy] = useState<'skip' | 'rename'>('skip');
  const [includeSiteData, setIncludeSiteData] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState('');

  const exportFile = async () => {
    setBusy('export');
    try {
      const response = await fetch(`/api/admin/portability/export?format=${format}&scope=${scope}`, { credentials: 'same-origin' });
      if (!response.ok) throw new Error(await responseError(response));
      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition') ?? '';
      const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `nextract-${scope}.${format === 'markdown' ? 'md' : format}`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`${filename} downloaded.`);
    } catch (error) { toast.error((error as Error).message); }
    finally { setBusy(''); }
  };
  const form = (commit = false) => {
    const data = new FormData();
    for (const file of files) data.append('files', file);
    data.set('strategy', strategy);
    if (commit) { data.set('selected', JSON.stringify(selected)); data.set('includeSiteData', String(includeSiteData)); }
    return data;
  };
  const doPreview = async () => {
    setBusy('preview'); setReport(null);
    try {
      const response = await fetch('/api/admin/portability/preview', { method: 'POST', credentials: 'same-origin', headers: { 'X-Nextract-CSRF': '1' }, body: form() });
      if (!response.ok) throw new Error(await responseError(response));
      const data = await response.json() as Preview;
      setPreview(data); setSelected(data.items.map((item) => item.index));
    } catch (error) { toast.error((error as Error).message); }
    finally { setBusy(''); }
  };
  const doImport = async () => {
    setBusy('import');
    try {
      const response = await fetch('/api/admin/portability/commit', { method: 'POST', credentials: 'same-origin', headers: { 'X-Nextract-CSRF': '1' }, body: form(true) });
      if (!response.ok) throw new Error(await responseError(response));
      const data = await response.json() as { report: Report; errors: string[] };
      setReport(data.report); setPreview(null);
      toast.success(`Imported ${data.report.created} records. ${data.report.skipped} skipped, ${data.report.failed} failed.`);
    } catch (error) { toast.error((error as Error).message); }
    finally { setBusy(''); }
  };

  return <>
    <PageHeader title="Import & export" description="Move CMS content between sites or bring in WordPress and Markdown content." />
    <div className="grid items-start gap-5 xl:grid-cols-2">
      <Card className="space-y-4 p-5"><h2 className="text-base font-semibold">Export content</h2><p className="text-sm text-zinc-600">JSON includes pages, resources, collections, taxonomy, menus, SEO metadata, and media references. CSV is for flat lists; Markdown is for pages or resources.</p>
        <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-xs font-medium">Format<Select value={format} onChange={(event) => { const value = event.target.value; setFormat(value); if (value === 'markdown') setScope('posts'); else if (value === 'csv' && !csvScopes.includes(scope)) setScope('posts'); }}><option value="json">JSON</option><option value="csv">CSV</option><option value="markdown">Markdown</option></Select></label><label className="space-y-1 text-xs font-medium">Content<Select value={scope} onChange={(event) => setScope(event.target.value)}>{(format === 'markdown' ? ['pages', 'posts'] : format === 'csv' ? csvScopes : scopes).map((value) => <option key={value} value={value}>{value}</option>)}</Select></label></div>
        <Button variant="primary" icon={<Download />} loading={busy === 'export'} onClick={exportFile}>Download export</Button>
      </Card>
      <Card className="space-y-4 p-5"><h2 className="text-base font-semibold">Import content</h2><p className="text-sm text-zinc-600">Choose up to 20 Nextract JSON, Markdown, or WordPress WXR XML files. Preview checks validation and duplicates before anything is saved. Pages and resources enter as drafts.</p>
        <label className="block space-y-1 text-xs font-medium">Files<input type="file" multiple accept=".json,.md,.markdown,.xml" className="block w-full rounded-lg border border-zinc-300 p-2 text-sm" onChange={(event) => { setFiles(Array.from(event.target.files ?? [])); setPreview(null); setReport(null); }} /></label>
        <label className="block space-y-1 text-xs font-medium">Slug conflicts<Select value={strategy} onChange={(event) => { setStrategy(event.target.value as 'skip' | 'rename'); setPreview(null); }}><option value="skip">Skip existing content</option><option value="rename">Create with a new slug</option></Select></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includeSiteData} onChange={(event) => setIncludeSiteData(event.target.checked)} /> Apply imported menus and site SEO settings</label>
        <p className="text-xs text-zinc-500">Media references do not include file bytes. Copy uploads separately or verify that source URLs remain available.</p>
        <Button icon={<Upload />} disabled={!files.length} loading={busy === 'preview'} onClick={doPreview}>Preview import</Button>
      </Card>
    </div>
    {preview && <Card className="mt-5 space-y-4 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-base font-semibold">Import preview</h2><p className="text-sm text-zinc-500">{preview.total} valid records · {preview.errors.length} validation errors. Select records to import.</p></div><Button variant="primary" disabled={!selected.length} loading={busy === 'import'} onClick={doImport}>Import {selected.length} selected</Button></div>
      {preview.errors.length > 0 && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800"><strong>Validation errors</strong><ul className="mt-1 list-disc pl-5">{preview.errors.map((error, index) => <li key={index}>{error}</li>)}</ul></div>}
      <div className="max-h-[520px] overflow-y-auto divide-y divide-zinc-100">{preview.items.map((item) => <label key={item.index} className="flex items-start gap-3 py-3 text-sm"><input type="checkbox" checked={selected.includes(item.index)} onChange={(event) => setSelected(event.target.checked ? [...selected, item.index] : selected.filter((id) => id !== item.index))} /><span><strong>{item.title}</strong> <span className="text-zinc-500">({item.kind})</span><span className="block text-xs text-zinc-500">{item.source} · {item.key}{item.duplicate ? ` · Existing match${item.proposedKey !== item.key ? ` → ${item.proposedKey}` : includeSiteData && ['menu', 'seo'].includes(item.kind) ? ' will be replaced' : ' will be skipped'}` : ''}</span>{item.warnings.map((warning, index) => <span key={index} className="block text-xs text-amber-700">{warning}</span>)}</span></label>)}</div>
    </Card>}
    {report && <Card className="mt-5 space-y-3 p-5"><h2 className="text-base font-semibold">Import report</h2><p className="text-sm">{report.created} created · {report.skipped} skipped · {report.failed} failed</p><div className="max-h-[520px] overflow-y-auto divide-y divide-zinc-100">{report.items.map((item) => <div key={item.index} className="py-2 text-sm"><strong>{item.title}</strong> <span className={item.status === 'failed' ? 'text-red-700' : item.status === 'skipped' ? 'text-amber-700' : 'text-green-700'}>{item.status}</span><p className="text-xs text-zinc-500">{item.kind} · {item.key} · {item.message}</p></div>)}</div></Card>}
  </>;
}
