import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formFieldTypes, type FormField } from '@workspace/cms-content';
import { ChevronRight, Copy, Eye, FileInput, Inbox, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { toast } from 'sonner';
import { useConfirm } from '@/components/dialog';
import { SortableList } from '@/components/sortable';
import { Badge, Button, ButtonLink, Card, CardHeader, Checkbox, EmptyState, ErrorState, IconButton, Input, Notice, PageHeader, PageLoader, SelectField, Switch, TextAreaField, TextField } from '@/components/ui';
import { del, errorMessage, fieldErrors, get, post, put } from '@/lib/api';
import { cn, newId } from '@/lib/format';
import { formatDate } from '@/lib/format';
import { useUnsavedChanges } from '@/lib/hooks';

type FormSummary = { id: string; name: string; slug: string; enabled: boolean; fields: number; submissions: number; views: number; updatedAt: string };
type FormDetail = {
  id: string; name: string; slug: string; description: string; fields: FormField[];
  submitLabel: string; successMessage: string; redirectUrl: string; notifyEmail: string; enabled: boolean; requireCaptcha: boolean;
};
type FieldRow = FormField & { key: string };

const typeLabels: Record<(typeof formFieldTypes)[number], string> = {
  text: 'Text', email: 'Email', phone: 'Phone', number: 'Number', textarea: 'Paragraph',
  select: 'Dropdown', checkbox: 'Checkbox', radio: 'Radio buttons', date: 'Date', file: 'File upload', hidden: 'Hidden', consent: 'Consent',
};
const hasOptions = (t: string) => t === 'select' || t === 'radio';

// ---------------------------------------------------------------------------

export function FormsListPage() {
  const [, navigate] = useLocation();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ['forms'], queryFn: ({ signal }) => get<{ items: FormSummary[] }>('/api/admin/forms', signal) });
  const [name, setName] = useState('');
  const create = useMutation({
    mutationFn: (value: string) => post<{ form: { id: string } }>('/api/admin/forms', { name: value }),
    onSuccess: (r) => navigate(`/forms/${r.form.id}`),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => del(`/api/admin/forms/${id}`),
    onSuccess: () => { toast.success('Form deleted.'); queryClient.invalidateQueries({ queryKey: ['forms'] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <>
      <PageHeader title="Forms" description="Build custom forms and place them on any page." />
      <Card className="mb-5 flex flex-wrap items-end gap-3 p-4">
        <div className="flex-1">
          <label className="mb-1.5 block text-[13px] font-medium text-zinc-800">New form name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Whitepaper download" onKeyDown={(e) => e.key === 'Enter' && name.trim() && create.mutate(name.trim())} />
        </div>
        <Button variant="primary" icon={<Plus />} loading={create.isPending} disabled={!name.trim()} onClick={() => create.mutate(name.trim())}>Create form</Button>
      </Card>

      {list.isLoading ? <PageLoader /> : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : (list.data?.items.length ? (
        <Card className="divide-y divide-zinc-100">
          {list.data.items.map((form) => (
            <div key={form.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
              <Link href={`/forms/${form.id}`} className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-zinc-900">{form.name}</span>
                <span className="block truncate font-mono text-[11px] text-zinc-500">/{form.slug}</span>
              </Link>
              {!form.enabled && <Badge tone="amber">Disabled</Badge>}
              <span className="text-xs text-zinc-500">{form.fields} field{form.fields === 1 ? '' : 's'}</span>
              <span className="text-xs text-zinc-500">{form.views} view{form.views === 1 ? '' : 's'}</span>
              <Link href={`/submissions?form=${form.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"><Inbox className="size-3.5" />{form.submissions}</Link>
              <span className="w-24 text-right text-xs text-zinc-500">{formatDate(form.updatedAt)}</span>
              <ButtonLink href={`/forms/${form.id}`} size="sm" variant="subtle">Edit</ButtonLink>
              <IconButton label="Delete form" className="hover:text-red-600" onClick={async () => { if (await confirm({ title: `Delete “${form.name}”?`, message: 'The form stops working on any page using it. Submissions are kept.', confirmLabel: 'Delete' })) remove.mutate(form.id); }}><Trash2 /></IconButton>
            </div>
          ))}
        </Card>
      ) : <EmptyState icon={<FileInput />} title="No forms yet" description="Create your first form above, then add it to a page in the visual builder." />)}
    </>
  );
}

// ---------------------------------------------------------------------------

export function FormEditorPage() {
  const params = useParams();
  const id = params.id as string;
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['forms', id], queryFn: ({ signal }) => get<{ form: FormDetail }>(`/api/admin/forms/${id}`, signal) });
  const [form, setForm] = useState<FormDetail | null>(null);
  const [fields, setFields] = useState<FieldRow[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (query.data) {
      setForm(query.data.form);
      setFields(query.data.form.fields.map((f) => ({ ...f, key: newId('f') })));
    }
  }, [query.data]);

  const strip = (rows: FieldRow[]): FormField[] => rows.map(({ key: _k, ...f }) => f);
  const dirty = Boolean(query.data && form && JSON.stringify({ ...form, fields: strip(fields) }) !== JSON.stringify(query.data.form));
  useUnsavedChanges(dirty);

  const save = useMutation({
    mutationFn: () => put<{ form: FormDetail }>(`/api/admin/forms/${id}`, { ...form, fields: strip(fields) }),
    onSuccess: (r) => { toast.success('Form saved. It is live on the site.'); setErrors({}); setForm(r.form); setFields(r.form.fields.map((f) => ({ ...f, key: newId('f') }))); queryClient.invalidateQueries({ queryKey: ['forms'] }); },
    onError: (e) => { setErrors(fieldErrors(e)); toast.error(errorMessage(e)); },
  });

  if (query.isLoading || !form) return query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : <PageLoader />;
  const set = <K extends keyof FormDetail>(key: K) => (value: FormDetail[K]) => setForm({ ...form, [key]: value });
  const addField = (type: (typeof formFieldTypes)[number]) => {
    const n = fields.length + 1;
    setFields([...fields, { key: newId('f'), id: newId('fld'), type, name: `field_${n}`, label: type === 'consent' ? 'I agree to be contacted' : `Field ${n}`, placeholder: '', help: '', required: false, defaultValue: '', options: hasOptions(type) ? [{ label: 'Option 1', value: 'option-1' }] : [], width: 'full' }]);
  };
  const updateField = (i: number, patch: Partial<FieldRow>) => setFields(fields.map((f, j) => (j === i ? { ...f, ...patch } : f)));

  return (
    <>
      <PageHeader
        title={form.name || 'Form'}
        description="Add fields, configure where submissions go, then add the form to a page."
        actions={
          <div className="flex items-center gap-3">
            <Button size="sm" variant="ghost" icon={<Eye />} onClick={() => setShowPreview((v) => !v)}>{showPreview ? 'Hide preview' : 'Preview'}</Button>
            {dirty && <span className="text-xs text-amber-700">Unsaved changes</span>}
            <Button variant="primary" loading={save.isPending} disabled={!dirty} onClick={() => save.mutate()}>Save form</Button>
          </div>
        }
      />
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Fields" description="Drag to reorder. Each field's name is the key stored with the submission." actions={
              <SelectField label="" className="w-40" value="" onChange={(v) => v && addField(v as (typeof formFieldTypes)[number])} options={[{ value: '', label: 'Add field…' }, ...formFieldTypes.map((t) => ({ value: t, label: typeLabels[t] }))]} />
            } />
            {fields.length === 0 ? (
              <p className="px-5 py-6 text-sm text-zinc-500">No fields yet. Use “Add field” to start.</p>
            ) : (
              <SortableList items={fields} getId={(f) => f.key} onReorder={setFields} className="divide-y divide-zinc-100" renderItem={(field, handle, index) => (
                <FieldCard field={field} handle={handle} errors={errors} index={index} onChange={(patch) => updateField(index, patch)} onRemove={() => setFields(fields.filter((_, j) => j !== index))} onDuplicate={() => setFields([...fields.slice(0, index + 1), { ...field, key: newId('f'), id: newId('fld'), name: `${field.name}_copy` }, ...fields.slice(index + 1)])} />
              )} />
            )}
          </Card>

          {showPreview && <Card className="p-5"><FormPreview name={form.name} fields={fields} submitLabel={form.submitLabel} /></Card>}
        </div>

        <div className="space-y-4">
          <Card className="space-y-4 p-5">
            <TextField label="Form name" value={form.name} onChange={set('name')} error={errors.name} />
            <TextField label="URL slug" value={form.slug} onChange={set('slug')} hint="Used to embed the form." error={errors.slug} />
            <TextAreaField label="Description" value={form.description} onChange={set('description')} rows={2} />
            <Switch checked={form.enabled} onChange={set('enabled')} label="Enabled" description="Turn off to stop accepting submissions." />
          </Card>
          <Card className="space-y-4 p-5">
            <p className="text-sm font-medium text-zinc-800">After submitting</p>
            <TextField label="Submit button text" value={form.submitLabel} onChange={set('submitLabel')} error={errors.submitLabel} />
            <TextAreaField label="Success message" value={form.successMessage} onChange={set('successMessage')} rows={2} error={errors.successMessage} />
            <TextField label="Redirect URL (optional)" value={form.redirectUrl} onChange={set('redirectUrl')} placeholder="/thank-you" hint="Sends visitors here instead of showing the message." error={errors.redirectUrl} />
          </Card>
          <Card className="space-y-4 p-5">
            <p className="text-sm font-medium text-zinc-800">Notifications & spam</p>
            <TextField label="Notify email" type="email" value={form.notifyEmail} onChange={set('notifyEmail')} placeholder="Site default" hint="Where new submissions are emailed. Falls back to Settings." error={errors.notifyEmail} />
            <Switch checked={form.requireCaptcha} onChange={set('requireCaptcha')} label="Require CAPTCHA" description="Uses the site's reCAPTCHA when configured." />
          </Card>
          <Card className="space-y-2 p-5">
            <p className="text-sm font-medium text-zinc-800">Add to a page</p>
            <p className="text-xs text-zinc-500">In the visual builder, add a <b>Form</b> block and choose this form, or reference its slug:</p>
            <code className="block rounded-md bg-zinc-100 px-2 py-1.5 font-mono text-[11px] text-zinc-700">{form.slug}</code>
            <button type="button" className="inline-flex items-center gap-1 text-xs text-brand-700 hover:underline" onClick={() => { navigator.clipboard?.writeText(form.slug); toast.success('Slug copied.'); }}><Copy className="size-3" /> Copy slug</button>
          </Card>
          <div className="flex justify-end">
            <IconButton label="Delete form" className="hover:text-red-600" onClick={async () => { if (await confirm({ title: `Delete “${form.name}”?`, message: 'The form stops working on any page using it.', confirmLabel: 'Delete' })) { await del(`/api/admin/forms/${id}`); toast.success('Form deleted.'); queryClient.invalidateQueries({ queryKey: ['forms'] }); window.history.back(); } }}><Trash2 /></IconButton>
          </div>
        </div>
      </div>
    </>
  );
}

function FieldCard({ field, handle, index, errors, onChange, onRemove, onDuplicate }: { field: FieldRow; handle: React.ReactNode; index: number; errors: Record<string, string>; onChange: (patch: Partial<FieldRow>) => void; onRemove: () => void; onDuplicate: () => void }) {
  const [open, setOpen] = useState(false);
  const err = (k: string) => errors[`fields.${index}.${k}`];
  return (
    <div className="bg-white">
      <div className="flex items-center gap-1.5 px-2 py-2">
        {handle}
        <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setOpen(!open)}>
          <ChevronRight className={cn('size-4 shrink-0 text-zinc-400 transition-transform', open && 'rotate-90')} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{field.label || field.name}</span>
            <span className="block truncate font-mono text-[11px] text-zinc-500">{typeLabels[field.type]} · {field.name}{field.required ? ' · required' : ''}</span>
          </span>
        </button>
        <Badge>{typeLabels[field.type]}</Badge>
        <IconButton label="Duplicate field" onClick={onDuplicate}><Copy /></IconButton>
        <IconButton label="Remove field" className="hover:text-red-600" onClick={onRemove}><Trash2 /></IconButton>
      </div>
      {open && (
        <div className="grid gap-3 border-t border-zinc-100 px-4 py-4 sm:grid-cols-2">
          <SelectField label="Type" value={field.type} onChange={(v) => onChange({ type: v as FieldRow['type'], options: hasOptions(v) && field.options.length === 0 ? [{ label: 'Option 1', value: 'option-1' }] : field.options })} options={formFieldTypes.map((t) => ({ value: t, label: typeLabels[t] }))} />
          <TextField label="Label" value={field.label} onChange={(label) => onChange({ label })} />
          <TextField label="Field name (key)" value={field.name} onChange={(name) => onChange({ name })} hint="Letters, numbers, _ or -." error={err('name')} />
          {field.type !== 'checkbox' && field.type !== 'consent' && field.type !== 'file' && <TextField label="Placeholder" value={field.placeholder} onChange={(placeholder) => onChange({ placeholder })} />}
          <TextField label="Help text" value={field.help} onChange={(help) => onChange({ help })} className="sm:col-span-2" />
          {field.type === 'hidden' && <TextField label="Value" value={field.defaultValue} onChange={(defaultValue) => onChange({ defaultValue })} className="sm:col-span-2" />}
          {hasOptions(field.type) && <OptionsEditor value={field.options} onChange={(options) => onChange({ options })} />}
          {field.type !== 'hidden' && <Checkbox checked={field.required} onChange={(required) => onChange({ required })} label="Required" />}
          <SelectField label="Width" value={field.width} onChange={(v) => onChange({ width: v as FieldRow['width'] })} options={[{ value: 'full', label: 'Full width' }, { value: 'half', label: 'Half width' }]} />
        </div>
      )}
    </div>
  );
}

function OptionsEditor({ value, onChange }: { value: { label: string; value: string }[]; onChange: (v: { label: string; value: string }[]) => void }) {
  return (
    <div className="sm:col-span-2">
      <label className="mb-1.5 block text-[13px] font-medium text-zinc-800">Options</label>
      <div className="space-y-2">
        {value.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input value={opt.label} placeholder="Label" onChange={(e) => onChange(value.map((o, j) => (j === i ? { label: e.target.value, value: o.value || e.target.value.toLowerCase().replace(/\s+/g, '-') } : o)))} />
            <Input value={opt.value} placeholder="value" className="font-mono text-xs" onChange={(e) => onChange(value.map((o, j) => (j === i ? { ...o, value: e.target.value } : o)))} />
            <IconButton label="Remove option" className="hover:text-red-600" onClick={() => onChange(value.filter((_, j) => j !== i))}><Trash2 /></IconButton>
          </div>
        ))}
        <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => onChange([...value, { label: `Option ${value.length + 1}`, value: `option-${value.length + 1}` }])}>Add option</Button>
      </div>
    </div>
  );
}

function FormPreview({ name, fields, submitLabel }: { name: string; fields: FieldRow[]; submitLabel: string }) {
  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-zinc-900">{name}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.filter((f) => f.type !== 'hidden').map((f) => (
          <div key={f.key} className={f.width === 'full' ? 'sm:col-span-2' : ''}>
            {f.type !== 'consent' && f.type !== 'checkbox' && <label className="mb-1 block text-xs font-medium text-zinc-700">{f.label}{f.required ? ' *' : ''}</label>}
            {f.type === 'textarea' ? <textarea className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" rows={3} placeholder={f.placeholder} disabled /> :
              f.type === 'select' ? <select className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" disabled><option>{f.placeholder || 'Choose…'}</option>{f.options.map((o, i) => <option key={i}>{o.label}</option>)}</select> :
              f.type === 'radio' ? <div className="space-y-1">{f.options.map((o, i) => <label key={i} className="flex items-center gap-2 text-sm text-zinc-700"><input type="radio" disabled /> {o.label}</label>)}</div> :
              (f.type === 'checkbox' || f.type === 'consent') ? <label className="flex items-start gap-2 text-sm text-zinc-700"><input type="checkbox" disabled className="mt-0.5" /> {f.label}{f.required ? ' *' : ''}</label> :
              <input className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'file' ? 'file' : 'text'} placeholder={f.placeholder} disabled />}
            {f.help && <p className="mt-1 text-[11px] text-zinc-500">{f.help}</p>}
          </div>
        ))}
      </div>
      <button className="mt-4 rounded-full bg-brand-600 px-5 py-2 text-sm font-medium text-white opacity-80" disabled>{submitLabel || 'Submit'}</button>
    </div>
  );
}
