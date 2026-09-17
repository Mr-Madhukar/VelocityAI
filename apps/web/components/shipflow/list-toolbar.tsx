"use client";

import { ArrowDownUp, Check, Search, X } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { cn } from "~/lib/utils";

export type ToolbarOption<T extends string> = { value: T; label: string };

/**
 * Shared, sticky search + filter + sort bar for the org-wide list pages (PRDs,
 * Tasks, Reviews). Single row: filters (as an evenly-spaced segmented control)
 * and sort sit on the left, search on the right. Every control is optional.
 *
 * Sticky note: this renders its own `sticky` band, so it must be a *plain* child
 * of the scrolling page container — do NOT wrap it in a `transform`-animated
 * `motion.div`, which would create a containing block and pin stickiness to the
 * toolbar's own box (i.e. it would never actually stick).
 */
export function ListToolbar<F extends string, S extends string>({
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  filters,
  activeFilter,
  onFilterChange,
  sortOptions,
  activeSort,
  onSortChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: ToolbarOption<F>[];
  activeFilter?: F;
  onFilterChange?: (value: F) => void;
  sortOptions?: ToolbarOption<S>[];
  activeSort?: S;
  onSortChange?: (value: S) => void;
}) {
  const activeSortLabel =
    sortOptions?.find((option) => option.value === activeSort)?.label ?? "Sort";

  return (
    // Sticks to the top of the app's <main> scrollport (which sits below the
    // top nav), with a blurred background band so scrolling content never
    // peeks through above the bar.
    <div className="sticky top-0 z-20 -mx-1 bg-background/80 px-1 py-3 backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-border bg-card/90 p-1.5 shadow-sm ring-1 ring-black/[0.02]">
        {/* LEFT — filters + sort (grows to fill the row) */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {filters && onFilterChange ? (
            <div className="flex flex-1 items-center gap-0.5 rounded-lg bg-foreground/[0.04] p-1">
              {filters.map((filter) => {
                const active = activeFilter === filter.value;
                return (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => onFilterChange(filter.value)}
                    aria-pressed={active}
                    className={cn(
                      "flex-1 whitespace-nowrap rounded-md px-3 py-2.5 text-xs font-medium tracking-tight transition-all",
                      active
                        ? "bg-primary/15 text-primary shadow-sm ring-1 ring-primary/30"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>
          ) : null}

          {sortOptions && onSortChange ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-3.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40">
                <ArrowDownUp className="size-3.5" />
                <span className="hidden sm:inline">{activeSortLabel}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {sortOptions.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onSelect={() => onSortChange(option.value)}
                    className="cursor-pointer text-sm"
                  >
                    <span className="truncate">{option.label}</span>
                    {option.value === activeSort ? (
                      <Check className="ml-auto size-3.5 text-primary" />
                    ) : null}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        {/* RIGHT — search */}
        <div className="relative w-full sm:w-64 sm:shrink-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-11 w-full rounded-lg border border-border bg-background pl-9 pr-8 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
          />
          {search ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
