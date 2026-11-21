import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button, Card, EmptyState, ErrorState, PageHeader, PageLoader } from '@/components/ui';
import { get, post, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';

type QueueItem = { entityType: 'page' | 'post'; id: string; title: string; workflowState: string; submittedAt: string | null; author?: { name: string } };
type Notification = { id: string; entityType: 'page' | 'post'; entityId: string; message: string; readAt: string | null; createdAt: string };

export function ReviewsPage() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [type, setType] = useState<'post' | 'page'>('post');
  const [queuePage, setQueuePage] = useState(1);
  const [noticePage, setNoticePage] = useState(1);
  const queue = useQuery({ queryKey: ['workflow-queue', type, queuePage], queryFn: ({ signal }) => get<{ items: QueueItem[]; page: number; pages: number }> (`/api/admin/workflow/queue?type=${type}&page=${queuePage}`, signal), enabled: can('workflow.review') });
  const notices = useQuery({ queryKey: ['workflow-notifications', noticePage], queryFn: ({ signal }) => get<{ items: Notification[]; unread: number; page: number; pages: number }>(`/api/admin/workflow/notifications?page=${noticePage}`, signal) });
  const markRead = useMutation({ mutationFn: (id: string) => post(`/api/admin/workflow/notifications/${id}/read`, {}), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workflow-notifications'] }), onError: (error) => toast.error(errorMessage(error)) });
  const href = (type: string, id: string) => `/${type === 'page' ? 'pages' : 'posts'}/${id}`;
  return <>
    <PageHeader title="Editorial inbox" description="Review submitted content and follow decisions on your work." />
    <div className="grid gap-5 xl:grid-cols-2">
      {can('workflow.review') && <Card className="p-5"><div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">Awaiting review</h2><select aria-label="Review content type" className="rounded border p-1 text-xs" value={type} onChange={(event) => { setType(event.target.value as 'post' | 'page'); setQueuePage(1); }}><option value="post">Resources</option><option value="page">Pages</option></select></div>{queue.isLoading ? <PageLoader /> : queue.isError ? <ErrorState error={queue.error} onRetry={() => queue.refetch()} /> : !queue.data?.items.length ? <EmptyState title="Nothing to review" description="Submitted pages and resources appear here." /> : <ul className="divide-y divide-zinc-100">{queue.data.items.map((item) => <li key={`${item.entityType}:${item.id}`} className="py-3"><Link href={href(item.entityType, item.id)} className="text-sm font-medium text-brand-700 hover:underline">{item.title}</Link><p className="text-xs text-zinc-500">{item.entityType} · {item.workflowState.replaceAll('_', ' ')}{item.author ? ` · ${item.author.name}` : ''}{item.submittedAt ? ` · ${formatDateTime(item.submittedAt)}` : ''}</p></li>)}</ul>}{queue.data && queue.data.pages > 1 && <div className="mt-3 flex items-center justify-between text-xs"><Button size="sm" disabled={queuePage === 1} onClick={() => setQueuePage(queuePage - 1)}>Previous</Button>{queuePage} / {queue.data.pages}<Button size="sm" disabled={queuePage >= queue.data.pages} onClick={() => setQueuePage(queuePage + 1)}>Next</Button></div>}</Card>}
      <Card className="p-5"><h2 className="mb-3 text-sm font-semibold">Notifications {notices.data?.unread ? `(${notices.data.unread} unread)` : ''}</h2>{notices.isLoading ? <PageLoader /> : notices.isError ? <ErrorState error={notices.error} onRetry={() => notices.refetch()} /> : !notices.data?.items.length ? <EmptyState title="No notifications" description="Review updates will appear here." /> : <ul className="divide-y divide-zinc-100">{notices.data.items.map((notice) => <li key={notice.id} className="flex items-start justify-between gap-2 py-3"><div><Link href={href(notice.entityType, notice.entityId)} className="text-sm font-medium text-brand-700 hover:underline">{notice.message}</Link><p className="text-xs text-zinc-500">{formatDateTime(notice.createdAt)}</p></div>{!notice.readAt && <Button size="sm" variant="ghost" onClick={() => markRead.mutate(notice.id)}>Mark read</Button>}</li>)}</ul>}{notices.data && notices.data.pages > 1 && <div className="mt-3 flex items-center justify-between text-xs"><Button size="sm" disabled={noticePage === 1} onClick={() => setNoticePage(noticePage - 1)}>Previous</Button>{noticePage} / {notices.data.pages}<Button size="sm" disabled={noticePage >= notices.data.pages} onClick={() => setNoticePage(noticePage + 1)}>Next</Button></div>}</Card>
    </div>
  </>;
}
