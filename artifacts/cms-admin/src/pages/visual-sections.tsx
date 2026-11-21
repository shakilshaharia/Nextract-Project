import { useQuery } from "@tanstack/react-query";
import type { VisualLayout } from "@workspace/cms-content";
import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Badge, EmptyState, ErrorState, PageLoader } from "@/components/ui";
import { get } from "@/lib/api";
import { visualSectionInfo } from "./section-catalog";
import { SectionThumbnail } from "./section-thumbnail";

export function VisualSections({
  id,
  canEdit,
  onEdit,
}: {
  id: string;
  canEdit: boolean;
  onEdit: (section: string) => void;
}) {
  const query = useQuery({
    queryKey: ["visual-sections", id],
    queryFn: ({ signal }) =>
      get<{ layout: VisualLayout }>(`/api/admin/pages/${id}/visual`, signal),
  });
  if (query.isLoading) return <PageLoader />;
  if (query.isError)
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data?.layout?.content.length)
    return <EmptyState title="No sections on this page" />;
  return (
    <ul className="divide-y divide-zinc-100">
      {query.data.layout.content.map((block) => {
        const info = visualSectionInfo(block);
        return (
          <li key={block.props.id} className="px-4 py-3">
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-lg p-1 text-left transition-colors hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-brand-500 disabled:cursor-default"
              disabled={!canEdit}
              onClick={() => onEdit(block.props.id)}
              aria-label={`Edit content: ${info.name}`}
            >
              <SectionThumbnail image={info.image} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-zinc-900">
                  {info.name}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-zinc-500">
                  {info.description}
                </span>
              </span>
              {block.props.style?.hidden && <Badge>Hidden</Badge>}
              {canEdit && (
                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-brand-700">
                  Edit content{" "}
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </span>
              )}
            </button>
            {info.shared && (
              <p className="mt-2 pl-1 text-xs text-zinc-500">
                Used across the website.{" "}
                <Link
                  href={info.shared.href}
                  className="font-medium text-brand-700 hover:underline"
                >
                  Edit shared {info.shared.label} →
                </Link>
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
