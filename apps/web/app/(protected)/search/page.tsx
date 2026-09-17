"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";

import { useActiveProject } from "~/components/shipflow/project-context";
import { PageHeader } from "~/components/shipflow/ui-kit";
import { RowSkeleton } from "~/components/shipflow/page-skeletons";
import { TYPE_CHIP_LABEL, TYPE_ICON, TYPE_LABEL, TYPE_ORDER } from "~/components/shipflow/search-meta";
import type { SearchResult, SearchResultType } from "@repo/trpc/server/routes/search/route";
import { cn } from "~/lib/utils";
import { trpc } from "~/trpc/client";

type Filter = "all" | SearchResultType;

function ResultRow({ result, onOpen }: { result: SearchResult; onOpen: (r: SearchResult) => void }) {
  const Icon = TYPE_ICON[result.type];
  return (
    <button
      onClick={() => onOpen(result)}
      className="group flex w-full items-center gap-3 border border-border bg-card px-4 py-3 text-left transition-colors hover:border-foreground/20 hover:bg-foreground/[0.03]"
    >
      <span className="grid size-8 shrink-0 place-items-center border border-border bg-foreground/[0.03] text-muted-foreground transition-colors group-hover:text-primary">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-foreground">{result.title}</span>
        <span className="block truncate font-mono text-[11px] text-muted-foreground">{result.subtitle}</span>
      </span>
      <ArrowRight aria-hidden className="size-4 shrink-0 text-foreground/20 transition-colors group-hover:text-primary" />
    </button>
  );
}

function SearchInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { activeProjectId, setActiveProjectId, scopeLabel } = useActiveProject();

  const [query, setQuery] = useState(params.get("q") ?? "");
  const [debounced, setDebounced] = useState(query);
  const [filter, setFilter] = useState<Filter>("all");

  // Debounce input → query + keep the URL shareable.
  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(query);
      const next = query.trim() ? `/search?q=${encodeURIComponent(query.trim())}` : "/search";
      router.replace(next, { scroll: false });
    }, 250);
    return () => clearTimeout(id);
  }, [query, router]);

  const term = debounced.trim();
  const { data, isFetching } = trpc.search.global.useQuery(
    { q: term, projectId: activeProjectId ?? undefined, limit: 25 },
    { enabled: term.length >= 2, staleTime: 10_000 },
  );
  const results = useMemo(() => data?.results ?? [], [data]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of results) c[r.type] = (c[r.type] ?? 0) + 1;
    return c;
  }, [results]);

  const visible = filter === "all" ? results : results.filter((r) => r.type === filter);
  const grouped = TYPE_ORDER.map((type) => ({ type, items: visible.filter((r) => r.type === type) })).filter(
    (g) => g.items.length > 0,
  );

  function openResult(r: SearchResult) {
    if (r.type === "project" && r.projectId) setActiveProjectId(r.projectId);
    router.push(r.href);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Search" description={`Searching across ${scopeLabel}.`} />

      <div className="flex items-center gap-2 border border-border bg-card px-3 py-2.5">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          placeholder="Search projects, features, tasks, PRDs, repos, reviews…"
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>

      {/* Type filter chips */}
      <div className="flex flex-wrap gap-2">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="All" count={results.length} />
        {TYPE_ORDER.map((type) => (
          <FilterChip
            key={type}
            active={filter === type}
            onClick={() => setFilter(type)}
            label={TYPE_CHIP_LABEL[type]}
            count={counts[type] ?? 0}
          />
        ))}
      </div>

      {term.length < 2 ? (
        <p className="border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          Type at least 2 characters to search.
        </p>
      ) : isFetching && results.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <RowSkeleton key={i} />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <p className="border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          No results for “{term}”.
        </p>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <div key={group.type} className="space-y-2">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                {TYPE_LABEL[group.type]} ({group.items.length})
              </p>
              <div className="space-y-2">
                {group.items.map((r) => (
                  <ResultRow key={`${r.type}-${r.id}`} result={r} onOpen={openResult} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors",
        active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
      <span className={active ? "text-primary" : "text-foreground/40"}>{count}</span>
    </button>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchInner />
    </Suspense>
  );
}
