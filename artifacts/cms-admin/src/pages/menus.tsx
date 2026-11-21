import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { corePagePaths, homepageAnchors, menuLocationLabels, type MenuLocation } from '@workspace/cms-content';
import { AlertTriangle, ChevronRight, CornerDownRight, ExternalLink, Eye, EyeOff, IndentDecrease, IndentIncrease, Link2, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useConfirm } from '@/components/dialog';
import { SortableList } from '@/components/sortable';
import { Badge, Button, Card, CardHeader, Checkbox, ErrorState, IconButton, Notice, PageHeader, PageLoader, SelectField, Switch, Tabs, TextField } from '@/components/ui';
import { errorMessage, fieldErrors, get, put } from '@/lib/api';
import { cn, newId } from '@/lib/format';
import { useUnsavedChanges } from '@/lib/hooks';
import type { MenuData, MenuItemNode, PageSummary } from '@/lib/types';

// A destination the picker can target: a known site page or a homepage section.
export type LinkTarget = { options: { value: string; label: string }[]; knownPaths: Set<string> };

const anchorLabels: Record<string, string> = {
  top: 'Top of homepage',
  solutions: 'Services (Solutions)',
  features: 'Features',
  integrations: 'Integrations',
  testimonials: 'Testimonials',
  faq: 'FAQ',
  demo: 'Demo',
};
const anchorOptions = homepageAnchors.map((id) => ({ value: `/#${id}`, label: anchorLabels[id] ?? id }));
const normalizePath = (path: string) => {
  const trimmed = path.trim().toLowerCase();
  return trimmed.length > 1 ? trimmed.replace(/\/$/, '') : trimmed;
};

type DestKind = 'page' | 'anchor' | 'url' | 'email' | 'phone';
function destKind(url: string): DestKind {
  if (/^mailto:/i.test(url)) return 'email';
  if (/^tel:/i.test(url)) return 'phone';
  if (/^https?:\/\//i.test(url)) return 'url';
  if (url.startsWith('#') || url.startsWith('/#')) return 'anchor';
  return 'page';
}

// A friendly picker over the stored `url` string: choose a page or homepage
// section, or enter a web address, email, or phone number. It flags links that
// point at a page the site does not have, or an unknown homepage section.
function DestinationField({ value, onChange, target, error }: { value: string; onChange: (url: string) => void; target: LinkTarget; error?: string }) {
  const [kind, setKind] = useState<DestKind>(() => destKind(value));
  const known = target.options.some((option) => option.value === value);
  const [customPage, setCustomPage] = useState(() => kind === 'page' && !!value && !known);

  const switchKind = (next: DestKind) => {
    setKind(next);
    setCustomPage(false);
    // Seed a sensible default so the stored value always matches the chosen kind.
    if (next === 'page') onChange(target.options[0]?.value ?? '/');
    else if (next === 'anchor') onChange(anchorOptions[0]?.value ?? '/#solutions');
    else onChange('');
  };

  let warning = '';
  if (kind === 'page' && value && !target.knownPaths.has(normalizePath(value))) warning = 'No page on the site uses this path yet.';
  if (kind === 'anchor') {
    const id = value.replace(/^.*#/, '');
    if (id && !homepageAnchors.includes(id as (typeof homepageAnchors)[number])) warning = 'This homepage section does not exist.';
  }

  return (
    <div className="space-y-2">
      <SelectField
        label="Links to"
        value={kind}
        onChange={(next) => switchKind(next as DestKind)}
        options={[
          { value: 'page', label: 'A page on this site' },
          { value: 'anchor', label: 'A section on the homepage' },
          { value: 'url', label: 'A web address' },
          { value: 'email', label: 'An email address' },
          { value: 'phone', label: 'A phone number' },
        ]}
      />
      {kind === 'page' && (
        customPage ? (
          <TextField label="Path" value={value} onChange={onChange} placeholder="/your-page" error={error} />
        ) : (
          <SelectField
            label="Page"
            value={known ? value : '__custom__'}
            onChange={(next) => (next === '__custom__' ? setCustomPage(true) : onChange(next))}
            options={[...target.options, { value: '__custom__', label: 'Another path…' }]}
            error={error}
          />
        )
      )}
      {kind === 'anchor' && (
        <SelectField label="Homepage section" value={value} onChange={onChange} options={anchorOptions.some((o) => o.value === value) ? anchorOptions : [{ value, label: value }, ...anchorOptions]} error={error} />
      )}
      {kind === 'url' && <TextField label="Web address" value={value} onChange={onChange} placeholder="https://example.com" error={error} />}
      {kind === 'email' && <TextField label="Email address" value={value.replace(/^mailto:/i, '')} onChange={(v) => onChange(v ? `mailto:${v.trim()}` : '')} placeholder="name@company.com" error={error} />}
      {kind === 'phone' && <TextField label="Phone number" value={value.replace(/^tel:/i, '')} onChange={(v) => onChange(v ? `tel:${v.replace(/\s+/g, '')}` : '')} placeholder="+1 555 000 1234" error={error} />}
      {warning && (
        <p className="flex items-center gap-1.5 text-xs text-amber-700">
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
          {warning}
        </p>
      )}
    </div>
  );
}

type Node = Omit<MenuItemNode, 'children'> & { key: string; children: Node[] };

const withKeys = (items: MenuItemNode[]): Node[] => items.map((item) => ({ ...item, key: item.id ?? newId('item'), children: withKeys(item.children ?? []) }));
const stripKeys = (items: Node[]): MenuItemNode[] => items.map(({ key: _k, id: _id, children, ...rest }) => ({ ...rest, children: stripKeys(children) }));
// Only the fields an editor can change, in a fixed order, for change detection.
const canon = (items: MenuItemNode[]): unknown[] => items.map((item) => [item.label, item.url, item.newTab, item.enabled, canon(item.children ?? [])]);
const makeNode = (label: string, url: string): Node => ({ key: newId('item'), label, url, newTab: false, enabled: true, children: [] });

const hints: Record<MenuLocation, string> = {
  header: 'The navigation at the top of every page across the whole site.',
  footer: 'The primary links column in the footer, shown on every page.',
};

// ---------------------------------------------------------------------------
// Left panel: add menu items from pages, homepage sections, or a custom link.
// ---------------------------------------------------------------------------

function PanelSection({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="border-b border-zinc-100 last:border-b-0">
      <button type="button" className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-zinc-800 hover:bg-zinc-50" onClick={onToggle} aria-expanded={open}>
        {title}
        <ChevronRight className={cn('size-4 text-zinc-400 transition-transform', open && 'rotate-90')} aria-hidden="true" />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function CheckList({ options, checked, onToggle }: { options: { value: string; label: string }[]; checked: Set<string>; onToggle: (value: string) => void }) {
  if (options.length === 0) return <p className="py-2 text-xs text-zinc-500">Nothing to add here yet.</p>;
  return (
    <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
      {options.map((option) => (
        <label key={option.value} className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-1 hover:bg-zinc-50">
          <input type="checkbox" className="mt-0.5 size-4 rounded border-zinc-300" checked={checked.has(option.value)} onChange={() => onToggle(option.value)} />
          <span className="min-w-0">
            <span className="block truncate text-sm text-zinc-800">{option.label}</span>
            <span className="block truncate font-mono text-[11px] text-zinc-500">{option.value}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

function AddItemsPanel({ target, onAdd }: { target: LinkTarget; onAdd: (nodes: Node[]) => void }) {
  const [open, setOpen] = useState<'pages' | 'sections' | 'custom'>('pages');
  const [pages, setPages] = useState<Set<string>>(new Set());
  const [sections, setSections] = useState<Set<string>>(new Set());
  const [customUrl, setCustomUrl] = useState('https://');
  const [customLabel, setCustomLabel] = useState('');

  const toggle = (set: Set<string>, setSet: (next: Set<string>) => void, value: string) => {
    const next = new Set(set);
    next.has(value) ? next.delete(value) : next.add(value);
    setSet(next);
  };

  const addPages = () => {
    const nodes = target.options.filter((o) => pages.has(o.value)).map((o) => makeNode(o.label, o.value));
    if (!nodes.length) return;
    onAdd(nodes);
    setPages(new Set());
    toast.success(`Added ${nodes.length} item${nodes.length === 1 ? '' : 's'} to the menu.`);
  };
  const addSections = () => {
    const nodes = anchorOptions.filter((o) => sections.has(o.value)).map((o) => makeNode(o.label, o.value));
    if (!nodes.length) return;
    onAdd(nodes);
    setSections(new Set());
    toast.success(`Added ${nodes.length} item${nodes.length === 1 ? '' : 's'} to the menu.`);
  };
  const addCustom = () => {
    const url = customUrl.trim();
    const label = customLabel.trim();
    if (!url || url === 'https://' || !label) {
      toast.error('Enter a web address and the link text first.');
      return;
    }
    onAdd([makeNode(label, url)]);
    setCustomUrl('https://');
    setCustomLabel('');
    toast.success('Added the link to the menu.');
  };

  return (
    <Card className="lg:sticky lg:top-4">
      <CardHeader title="Add menu items" description="Pick what to add, then select Add to menu. New items appear at the bottom of the structure." />
      <PanelSection title="Pages" open={open === 'pages'} onToggle={() => setOpen('pages')}>
        <CheckList options={target.options} checked={pages} onToggle={(v) => toggle(pages, setPages, v)} />
        <Button size="sm" className="mt-3" icon={<Plus />} disabled={pages.size === 0} onClick={addPages}>Add to menu</Button>
      </PanelSection>
      <PanelSection title="Homepage sections" open={open === 'sections'} onToggle={() => setOpen('sections')}>
        <CheckList options={anchorOptions} checked={sections} onToggle={(v) => toggle(sections, setSections, v)} />
        <Button size="sm" className="mt-3" icon={<Plus />} disabled={sections.size === 0} onClick={addSections}>Add to menu</Button>
      </PanelSection>
      <PanelSection title="Custom link" open={open === 'custom'} onToggle={() => setOpen('custom')}>
        <div className="space-y-3">
          <TextField label="Web address" value={customUrl} onChange={setCustomUrl} placeholder="https://example.com" />
          <TextField label="Link text" value={customLabel} onChange={setCustomLabel} placeholder="Read the guide" />
          <Button size="sm" icon={<Link2 />} onClick={addCustom}>Add to menu</Button>
        </div>
      </PanelSection>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Right panel: the menu structure, with reorder and indent-to-nest.
// ---------------------------------------------------------------------------

function ItemRow({ item, onChange, onRemove, onAddChild, onIndent, onOutdent, handle, depth, errors, target }: {
  item: Node;
  onChange: (next: Node) => void;
  onRemove: () => void;
  onAddChild?: () => void;
  onIndent?: () => void;
  onOutdent?: () => void;
  handle: React.ReactNode;
  depth: number;
  errors: Record<string, string>;
  target: LinkTarget;
}) {
  const [open, setOpen] = useState(!item.label);
  const external = /^https?:\/\//i.test(item.url);
  return (
    <div className={cn('bg-white', !item.enabled && 'bg-zinc-50')}>
      <div className="flex items-center gap-1.5 px-2 py-2">
        {depth > 0 && <CornerDownRight className="ml-1 size-4 shrink-0 text-zinc-300" aria-hidden="true" />}
        {handle}
        <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
          <ChevronRight className={cn('size-4 shrink-0 text-zinc-400 transition-transform', open && 'rotate-90')} aria-hidden="true" />
          <span className="min-w-0">
            <span className={cn('block truncate text-sm font-medium', !item.enabled && 'text-zinc-400 line-through')}>{item.label || 'New link'}</span>
            <span className="flex items-center gap-1 truncate font-mono text-[11px] text-zinc-500">{item.url || '—'}{external && <ExternalLink className="size-3" aria-label="external" />}</span>
          </span>
        </button>
        {item.children.length > 0 && <Badge>{item.children.length} in dropdown</Badge>}
        {onOutdent && <IconButton label="Move out of dropdown (promote)" onClick={onOutdent}><IndentDecrease /></IconButton>}
        {onIndent && <IconButton label="Make a dropdown item of the one above" onClick={onIndent}><IndentIncrease /></IconButton>}
        <IconButton label={item.enabled ? 'Disable link' : 'Enable link'} onClick={() => onChange({ ...item, enabled: !item.enabled })}>{item.enabled ? <Eye /> : <EyeOff />}</IconButton>
        <IconButton label="Remove link" className="hover:text-red-600" onClick={onRemove}><Trash2 /></IconButton>
      </div>
      {open && (
        <div className="grid gap-3 border-t border-zinc-100 px-4 py-4 sm:grid-cols-2" style={{ paddingLeft: depth ? 48 : undefined }}>
          <TextField label="Navigation label" value={item.label} onChange={(label) => onChange({ ...item, label })} error={errors.label} />
          <DestinationField value={item.url} onChange={(url) => onChange({ ...item, url })} target={target} error={errors.url} />
          <Checkbox checked={item.newTab} onChange={(newTab) => onChange({ ...item, newTab })} label="Open in a new tab" />
          {onAddChild && (
            <div className="sm:text-right">
              <Button size="sm" variant="ghost" icon={<Plus />} onClick={onAddChild}>Add dropdown item</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MenuEditor({ menu, onSaved, target }: { menu: MenuData; onSaved: (menu: MenuData) => void; target: LinkTarget }) {
  const confirm = useConfirm();
  const [items, setItems] = useState<Node[]>(() => withKeys(menu.items));
  const [ctaEnabled, setCtaEnabled] = useState(menu.ctaEnabled);
  const [ctaLabel, setCtaLabel] = useState(menu.ctaLabel);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dirty = JSON.stringify([canon(menu.items), menu.ctaEnabled, menu.ctaLabel]) !== JSON.stringify([canon(items), ctaEnabled, ctaLabel]);
  useUnsavedChanges(dirty);

  useEffect(() => {
    setItems(withKeys(menu.items));
    setCtaEnabled(menu.ctaEnabled);
    setCtaLabel(menu.ctaLabel);
  }, [menu]);

  const save = useMutation({
    mutationFn: () => put<{ menu: MenuData }>(`/api/admin/menus/${menu.location}`, { ctaEnabled, ctaLabel, items: stripKeys(items) }),
    onSuccess: (result) => {
      toast.success('Menu saved. It is live on the site.');
      setErrors({});
      onSaved(result.menu);
    },
    onError: (error) => {
      setErrors(fieldErrors(error));
      toast.error(errorMessage(error));
    },
  });

  const errorsFor = (path: string) => Object.fromEntries(Object.entries(errors).filter(([k]) => k.startsWith(path)).map(([k, v]) => [k.slice(path.length), v]));

  // Make a top-level item a dropdown item of the one above it. Only items with
  // no dropdown of their own can nest, so the menu never goes past two levels.
  const indent = (index: number) => {
    if (index === 0) return;
    const moving = items[index];
    if (moving.children.length) {
      toast.error('Remove this item’s dropdown items before nesting it.');
      return;
    }
    const next = items.map((it, i) => (i === index - 1 ? { ...it, children: [...it.children, moving] } : it)).filter((_, i) => i !== index);
    setItems(next);
  };
  // Promote a dropdown item back to the top level, just after its parent.
  const outdent = (parentIndex: number, childIndex: number) => {
    const parent = items[parentIndex];
    const child = parent.children[childIndex];
    const next = [...items];
    next[parentIndex] = { ...parent, children: parent.children.filter((_, i) => i !== childIndex) };
    next.splice(parentIndex + 1, 0, child);
    setItems(next);
  };

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[320px_1fr]">
      <AddItemsPanel target={target} onAdd={(nodes) => setItems([...items, ...nodes])} />

      <div className="space-y-4">
        <Card>
          <CardHeader
            title="Menu structure"
            description="Drag to reorder. Use the indent arrows to make a link a dropdown item of the one above it, or promote it back out."
          />
          {items.length === 0 ? (
            <p className="px-5 py-6 text-sm text-zinc-500">No links yet. Add pages, homepage sections, or a custom link from the panel on the left.</p>
          ) : (
            <SortableList
              items={items}
              getId={(item) => item.key}
              onReorder={setItems}
              className="divide-y divide-zinc-100"
              renderItem={(item, handle, index) => (
                <div>
                  <ItemRow
                    item={item}
                    depth={0}
                    handle={handle}
                    target={target}
                    errors={errorsFor(`items.${index}.`)}
                    onIndent={index > 0 ? () => indent(index) : undefined}
                    onChange={(next) => setItems(items.map((it, i) => (i === index ? next : it)))}
                    onRemove={async () => {
                      if (!item.children.length || (await confirm({ title: 'Remove this link and its dropdown?', message: `Its ${item.children.length} dropdown item${item.children.length === 1 ? '' : 's'} will be removed too.`, confirmLabel: 'Remove' }))) {
                        setItems(items.filter((_, i) => i !== index));
                      }
                    }}
                    onAddChild={() => setItems(items.map((it, i) => (i === index ? { ...it, children: [...it.children, makeNode('', '/')] } : it)))}
                  />
                  {item.children.length > 0 && (
                    <SortableList
                      items={item.children}
                      getId={(child) => child.key}
                      onReorder={(children) => setItems(items.map((it, i) => (i === index ? { ...it, children } : it)))}
                      className="divide-y divide-zinc-100 border-t border-zinc-100 bg-zinc-50/50"
                      renderItem={(child, childHandle, childIndex) => (
                        <ItemRow
                          item={child}
                          depth={1}
                          handle={childHandle}
                          target={target}
                          errors={errorsFor(`items.${index}.children.${childIndex}.`)}
                          onOutdent={() => outdent(index, childIndex)}
                          onChange={(next) => setItems(items.map((it, i) => (i === index ? { ...it, children: it.children.map((c, ci) => (ci === childIndex ? next : c)) } : it)))}
                          onRemove={() => setItems(items.map((it, i) => (i === index ? { ...it, children: it.children.filter((_, ci) => ci !== childIndex) } : it)))}
                        />
                      )}
                    />
                  )}
                </div>
              )}
            />
          )}
        </Card>

        <Card className="space-y-4 p-5">
          <Switch checked={ctaEnabled} onChange={setCtaEnabled} label="Show the demo button" description="The highlighted button beside the links. It opens the demo form, or your booking link if one is set in Settings." />
          {ctaEnabled && <TextField label="Button label" value={ctaLabel} onChange={setCtaLabel} error={errors.ctaLabel} className="max-w-xs" />}
        </Card>

        <div className="flex items-center justify-end gap-3">
          {dirty && <span className="text-xs text-amber-700">Unsaved changes</span>}
          <Button variant="primary" loading={save.isPending} disabled={!dirty} onClick={() => save.mutate()}>Save menu</Button>
        </div>
      </div>
    </div>
  );
}

const corePageLabels: Record<string, string> = {
  '/': 'Home',
  '/pricing': 'Pricing',
  '/resources': 'Resources',
  '/about': 'About',
  '/contact': 'Contact',
  '/partnership': 'Partnership',
  '/privacy-policy': 'Privacy Policy',
  '/terms-and-conditions': 'Terms & Conditions',
};

export function MenusPage() {
  const queryClient = useQueryClient();
  const [location, setLocation] = useState<MenuLocation>('header');
  const query = useQuery({ queryKey: ['menus'], queryFn: ({ signal }) => get<{ items: MenuData[] }>('/api/admin/menus', signal) });
  // Powers the "Pages" add panel, the destination picker, and broken-link
  // warnings. The site works even if this fails, so it falls back to the
  // built-in page paths.
  const pagesQuery = useQuery({ queryKey: ['pages', 'menu-targets'], queryFn: ({ signal }) => get<{ items: PageSummary[] }>('/api/admin/pages', signal) });
  const menu = query.data?.items.find((m) => m.location === location);

  const target = useMemo<LinkTarget>(() => {
    const byPath = new Map<string, string>();
    for (const path of corePagePaths) byPath.set(normalizePath(path), corePageLabels[path] ?? path);
    for (const page of pagesQuery.data?.items ?? []) {
      if (page.path) byPath.set(normalizePath(page.path), page.title || page.path);
    }
    const options = [...byPath.entries()].map(([path, label]) => ({ value: path === '' ? '/' : path, label }));
    return { options, knownPaths: new Set(byPath.keys()) };
  }, [pagesQuery.data]);

  return (
    <>
      <PageHeader title="Menus" description="One header and one footer for the whole website. Saving publishes immediately." />
      <Tabs
        value={location}
        onChange={setLocation}
        tabs={(Object.keys(menuLocationLabels) as MenuLocation[]).map((value) => ({ value, label: menuLocationLabels[value] }))}
        className="mb-5"
      />
      <p className="mb-4 text-sm text-zinc-500">{hints[location]}</p>
      {query.isLoading ? (
        <PageLoader />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : menu ? (
        <MenuEditor
          key={location}
          menu={menu}
          target={target}
          onSaved={(saved) => queryClient.setQueryData<{ items: MenuData[] }>(['menus'], (old) => old && { items: old.items.map((m) => (m.location === saved.location ? saved : m)) })}
        />
      ) : (
        <Notice tone="warn">This menu could not be found.</Notice>
      )}
    </>
  );
}
