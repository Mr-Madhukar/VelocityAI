"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderGit2, FolderKanban, Layers, Plus, Search } from "lucide-react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "~/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Spinner } from "~/components/ui/spinner";
import { navItems } from "./nav-items";
import { useActiveProject } from "./project-context";
import { TYPE_ICON, TYPE_LABEL, TYPE_ORDER } from "./search-meta";
import type { SearchResult } from "@repo/trpc/server/routes/search/route";
import { trpc } from "~/trpc/client";

const CommandPaletteContext = createContext<{ open: () => void } | null>(null);

export function useCommandPalette() {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) throw new Error("useCommandPalette must be used within CommandPalette");
  return ctx;
}

/** ⌘K palette: live org-wide search + quick navigation. Mounted once in the shell. */
export function CommandPalette({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { projects, activeProjectId, setActiveProjectId } = useActiveProject();

  const trimmed = query.trim();
  const searching = trimmed.length >= 2;
  const { data, isFetching } = trpc.search.global.useQuery(
    { q: trimmed, projectId: activeProjectId ?? undefined },
    { enabled: open && searching, staleTime: 10_000 },
  );
  const results = data?.results ?? [];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function close() {
    setOpen(false);
    setQuery("");
  }

  function go(href: string) {
    close();
    router.push(href);
  }

  function openResult(r: SearchResult) {
    if (r.type === "project" && r.projectId) setActiveProjectId(r.projectId);
    go(r.href);
  }

  const grouped = TYPE_ORDER.map((type) => ({
    type,
    items: results.filter((r) => r.type === type),
  })).filter((g) => g.items.length > 0);

  return (
    <CommandPaletteContext.Provider value={{ open: () => setOpen(true) }}>
      {children}

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogHeader className="sr-only">
          <DialogTitle>Command palette</DialogTitle>
          <DialogDescription>Search projects, features, tasks, PRDs, repos and reviews</DialogDescription>
        </DialogHeader>
        <DialogContent showCloseButton={false} className="overflow-hidden border-border bg-popover p-0">
          <Command shouldFilter={false} className="bg-transparent">
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Search projects, features, tasks, PRDs, repos, reviews…"
            />
            <CommandList>
              {searching ? (
                <>
                  {grouped.length === 0 && !isFetching ? (
                    <CommandEmpty>No results for “{trimmed}”.</CommandEmpty>
                  ) : null}
                  {grouped.map((group) => {
                    const Icon = TYPE_ICON[group.type];
                    return (
                      <CommandGroup key={group.type} heading={TYPE_LABEL[group.type]}>
                        {group.items.map((r) => (
                          <CommandItem key={`${r.type}-${r.id}`} value={`${r.type}-${r.id}`} onSelect={() => openResult(r)}>
                            <Icon />
                            <span className="truncate">{r.title}</span>
                            <span className="ml-auto truncate pl-3 font-mono text-[10px] text-muted-foreground">{r.subtitle}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    );
                  })}
                  <CommandSeparator />
                  <CommandGroup heading="">
                    <CommandItem value="view-all" onSelect={() => go(`/search?q=${encodeURIComponent(trimmed)}`)}>
                      <Search />
                      <span>{isFetching ? "Searching…" : `View all results for “${trimmed}”`}</span>
                      {isFetching ? <Spinner className="ml-auto size-3.5" /> : null}
                    </CommandItem>
                  </CommandGroup>
                </>
              ) : (
                <>
                  <CommandGroup heading="Navigate">
                    {navItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <CommandItem key={item.href} value={`go-${item.label}`} onSelect={() => go(item.href)}>
                          <Icon />
                          <span>{item.label}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>

                  <CommandSeparator />
                  <CommandGroup heading="Scope">
                    <CommandItem value="scope-all" onSelect={() => { setActiveProjectId(null); close(); }}>
                      <Layers />
                      <span>All projects {activeProjectId === null ? "(current)" : ""}</span>
                    </CommandItem>
                    {projects.map((project) => (
                      <CommandItem key={project.id} value={`scope-${project.id}`} onSelect={() => { setActiveProjectId(project.id); close(); }}>
                        <FolderGit2 />
                        <span className="truncate">{project.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>

                  <CommandSeparator />
                  <CommandGroup heading="Actions">
                    <CommandItem value="new-feature" onSelect={() => go("/features/new")}>
                      <Plus />
                      <span>New feature request</span>
                    </CommandItem>
                    <CommandItem value="all-projects" onSelect={() => go("/projects")}>
                      <FolderKanban />
                      <span>Browse projects</span>
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </CommandPaletteContext.Provider>
  );
}
