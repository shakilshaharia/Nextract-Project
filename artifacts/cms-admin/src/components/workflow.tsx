import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { errorMessage, get, post } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { Badge, Button, Card, PageLoader, Select, Textarea } from './ui';

type Workflow = { state: string; version: number; approvedVersion: number | null; ownerId: string | null; reviewer: { id: string; name: string } | null; submittedAt: string | null; reviewedAt: string | null };
type Revision = { id: string; version: number; action: string; comment: string; actorName: string; createdAt: string };
type Detail = { workflow: Workflow; revisions: Revision[]; total: number; page: number; pages: number };

export function WorkflowPanel({ type, id, saveBefore, onChanged }: { type: 'page' | 'post'; id: string; saveBefore: () => Promise<void>; onChanged: () => void }) {
  const { can, user } = useAuth();
  const queryClient = useQueryClient();
  const [revisionPage, setRevisionPage] = useState(1);
  const query = useQuery({ queryKey: ['workflow', type, id, revisionPage], queryFn: ({ signal }) => get<Detail>(`/api/admin/workflow/${type}/${id}?page=${revisionPage}`, signal) });
  const reviewers = useQuery({ queryKey: ['workflow-reviewers'], queryFn: ({ signal }) => get<{ items: { id: string; name: string }[] }>('/api/admin/workflow/reviewers', signal) });
  const [reviewerId, setReviewerId] = useState('');
  const [comment, setComment] = useState('');
  const [selected, setSelected] = useState<{ id: string; snapshot: unknown } | null>(null);
  const act = useMutation({
    mutationFn: async (action: string) => {
      if (action === 'submit') await saveBefore();
      return post(`/api/admin/workflow/${type}/${id}`, { action, reviewerId: reviewerId || undefined, comment });
    },
    onSuccess: (_, action) => {
      setComment('');
      toast.success(action === 'request-revisions' ? 'Revisions requested.' : `${action.replace('-', ' ')} saved.`);
      setRevisionPage(1);
      queryClient.invalidateQueries({ queryKey: ['workflow', type, id] });
      queryClient.invalidateQueries({ queryKey: ['workflow-queue'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-notifications'] });
      onChanged();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const view = useMutation({ mutationFn: (revisionId: string) => get<{ revision: { id: string; snapshot: unknown } }>(`/api/admin/workflow/${type}/${id}/revisions/${revisionId}`), onSuccess: (data) => setSelected(data.revision), onError: (error) => toast.error(errorMessage(error)) });

  if (query.isLoading) return <Card className="p-5"><PageLoader /></Card>;
  if (!query.data) return <Card className="p-5 text-sm text-red-600">Could not load the review workflow. <Button size="sm" onClick={() => query.refetch()}>Retry</Button></Card>;
  const { workflow, revisions } = query.data;
  const mayReview = can('workflow.review') && (workflow.ownerId !== user?.id || user?.role === 'SUPER_ADMIN') && (!workflow.reviewer || workflow.reviewer.id === user?.id || user?.role === 'SUPER_ADMIN');
  const pending = workflow.state === 'SUBMITTED' || workflow.state === 'IN_REVIEW';
  return <Card className="space-y-4 p-5">
    <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">Editorial review</h2><Badge tone={workflow.state === 'APPROVED' ? 'green' : pending ? 'blue' : 'neutral'}>{workflow.state.replaceAll('_', ' ')}</Badge></div>
    <p className="text-xs text-zinc-500">Draft version {workflow.version}{workflow.reviewer ? ` · Reviewer: ${workflow.reviewer.name}` : ''}</p>
    {['DRAFT', 'CHANGES_REQUESTED'].includes(workflow.state) && <div className="space-y-2">
      <label className="block text-xs font-medium">Assign reviewer</label>
      <Select value={reviewerId} onChange={(event) => setReviewerId(event.target.value)} aria-label="Assign reviewer"><option value="">Any editor</option>{reviewers.data?.items.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</Select>
      <Button variant="primary" className="w-full" loading={act.isPending} onClick={() => act.mutate('submit')}>Submit for review</Button>
    </div>}
    {pending && mayReview && <div className="flex flex-wrap gap-2">
      {workflow.state === 'SUBMITTED' && <Button size="sm" onClick={() => act.mutate('start-review')} loading={act.isPending}>Start review</Button>}
      {workflow.state === 'IN_REVIEW' && <><Button size="sm" variant="primary" onClick={() => act.mutate('approve')} loading={act.isPending}>Approve</Button>
      <Button size="sm" onClick={() => act.mutate('request-revisions')} loading={act.isPending}>Request revisions</Button>
      <Button size="sm" variant="danger" onClick={() => act.mutate('reject')} loading={act.isPending}>Reject</Button></>}
    </div>}
    {pending && can('workflow.review') && <div className="flex gap-2"><Select value={reviewerId} onChange={(event) => setReviewerId(event.target.value)} aria-label="Reassign reviewer"><option value="">Choose reviewer</option>{reviewers.data?.items.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</Select><Button size="sm" disabled={!reviewerId} loading={act.isPending} onClick={() => act.mutate('assign')}>Assign</Button></div>}
    <div className="space-y-2"><label className="block text-xs font-medium" htmlFor={`review-comment-${id}`}>Internal comment</label><Textarea id={`review-comment-${id}`} value={comment} onChange={(event) => setComment(event.target.value)} maxLength={5000} placeholder="Notes for the author or reviewer" /><Button size="sm" disabled={!comment.trim()} loading={act.isPending} onClick={() => act.mutate('comment')}>Add comment</Button></div>
    <div className="border-t border-zinc-100 pt-3"><h3 className="text-xs font-semibold">Revision history ({query.data.total})</h3><div className="mt-2 max-h-64 overflow-y-auto divide-y divide-zinc-100">{revisions.map((revision) => <div key={revision.id} className="py-2 text-xs"><div className="flex items-center justify-between gap-2"><span><strong>{revision.action.replaceAll('-', ' ')}</strong> · {revision.actorName}</span><button type="button" className="text-brand-700 underline" onClick={() => view.mutate(revision.id)}>View snapshot</button></div><p className="text-zinc-500">Version {revision.version} · {formatDateTime(revision.createdAt)}</p>{revision.comment && <p className="mt-1 whitespace-pre-wrap">{revision.comment}</p>}</div>)}{!revisions.length && <p className="text-xs text-zinc-500">No revisions yet.</p>}</div>{query.data.pages > 1 && <div className="mt-2 flex items-center justify-between text-xs"><Button size="sm" disabled={revisionPage === 1} onClick={() => setRevisionPage(revisionPage - 1)}>Newer</Button><span>{revisionPage} / {query.data.pages}</span><Button size="sm" disabled={revisionPage >= query.data.pages} onClick={() => setRevisionPage(revisionPage + 1)}>Older</Button></div>}</div>
    {selected && <div className="rounded-lg bg-zinc-50 p-3 text-xs"><div className="flex justify-between gap-2"><strong>Revision snapshot</strong><button type="button" className="text-brand-700 underline" onClick={() => setSelected(null)}>Close</button></div><pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap">{JSON.stringify(selected.snapshot, null, 2)}</pre></div>}
  </Card>;
}
