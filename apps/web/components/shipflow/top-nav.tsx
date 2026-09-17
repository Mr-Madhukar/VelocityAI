"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Github, LogOut, Menu, Plus, Search, Settings, User as UserIcon } from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { ThemeToggle } from "~/components/theme-toggle";
import { NotificationsMenu } from "./notifications-menu";
import { ProjectSwitcher, useActiveProject } from "./project-context";
import { useCommandPalette } from "./command-palette";
import { LinkPending } from "./link-pending";
import { routeLabel } from "./nav-items";
import { cn } from "~/lib/utils";
import { trpc } from "~/trpc/client";
import { authClient } from "@/lib/auth-client";

function initialsOf(name?: string | null) {
  if (!name) return "U";
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// Netflix-style colorful fallback avatars: a vivid gradient picked
// deterministically from the user's identity, so the same person always gets
// the same color when they have no profile image.
const AVATAR_COLORS = [
  "bg-gradient-to-br from-rose-500 to-pink-600",
  "bg-gradient-to-br from-orange-500 to-amber-600",
  "bg-gradient-to-br from-emerald-500 to-teal-600",
  "bg-gradient-to-br from-sky-500 to-indigo-600",
  "bg-gradient-to-br from-violet-500 to-fuchsia-600",
  "bg-gradient-to-br from-cyan-500 to-blue-600",
];

function avatarColor(key: string) {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function UserMenu() {
  const { data: session } = authClient.useSession();
  const user = session?.user;

  // Nudge to connect a repo (below the profile), shown until the active project
  // — or the org, in "All" scope — has a connected repository.
  const { activeProjectId, ready, isLoading } = useActiveProject();
  const { data: repos = [] } = trpc.github.repositories.useQuery(
    { projectId: activeProjectId ?? undefined },
    { enabled: ready && !isLoading },
  );
  const needsRepo = ready && !isLoading && repos.length === 0;

  async function signOut() {
    try {
      await authClient.signOut();
    } finally {
      // Full document navigation (not router.push) so the Next.js router cache and
      // any cached RSC payloads are dropped — back button can't restore the app.
      // Runs even if the request fails so the user is never stranded signed-in.
      window.location.href = "/sign-in";
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="shrink-0 border border-border transition-colors hover:border-foreground/20 focus:outline-none"
      >
        <Avatar className="size-9 rounded-none">
          {user?.image ? <AvatarImage src={user.image} alt={user.name ?? "User"} /> : null}
          <AvatarFallback
            className={cn(
              "rounded-none font-mono text-xs font-semibold text-white",
              avatarColor(user?.email ?? user?.name ?? "U"),
            )}
          >
            {initialsOf(user?.name)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 border-border bg-popover">
        <div className="px-2 py-2">
          <p className="truncate text-sm text-foreground">{user?.name ?? "User"}</p>
          <p className="truncate text-xs text-muted-foreground">{user?.email ?? ""}</p>
        </div>
        <DropdownMenuSeparator className="bg-border" />
        {needsRepo ? (
          <>
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link href="/github" className="flex-col !items-start gap-1 py-2">
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Github className="size-4 text-primary" /> Connect a repository
                </span>
                <span className="pl-6 text-xs leading-5 text-muted-foreground">
                  Better tech-stack detection, prompt generation &amp; codebase context.
                </span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border" />
          </>
        ) : null}
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href="/profile">
            <UserIcon className="size-4" /> Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href="/settings">
            <Settings className="size-4" /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-border" />
        <DropdownMenuItem
          onSelect={signOut}
          className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
        >
          <LogOut className="size-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TopNav({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const pathname = usePathname() ?? "";
  const { open } = useCommandPalette();
  const label = routeLabel(pathname);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/70 backdrop-blur-xl">
      <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onOpenMobileNav}
            aria-label="Open menu"
            className="grid size-9 shrink-0 place-items-center border border-border bg-foreground/[0.03] text-muted-foreground transition-colors hover:text-foreground lg:hidden"
          >
            <Menu className="size-4" />
          </button>

          <Breadcrumb className="hidden min-w-0 sm:block">
            <BreadcrumbList className="font-mono text-xs">
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
                    VelocityAI
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-foreground/30" />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-foreground">{label}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="hidden md:block">
            <ProjectSwitcher />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={open}
            className="hidden h-9 items-center gap-2 border border-border bg-foreground/[0.03] px-2.5 text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground sm:flex"
          >
            <Search className="size-4" />
            <span className="text-sm">Search…</span>
            <kbd className="ml-3 border border-border bg-foreground/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              ⌘K
            </kbd>
          </button>
          <button
            type="button"
            onClick={open}
            aria-label="Search"
            className="grid size-9 place-items-center border border-border bg-foreground/[0.03] text-muted-foreground transition-colors hover:text-foreground sm:hidden"
          >
            <Search className="size-4" />
          </button>

          <ThemeToggle />
          <NotificationsMenu />

          <Link
            href="/features/new"
            className="inline-flex h-9 items-center gap-2 border border-primary bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-transparent hover:text-foreground active:scale-[0.97]"
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">New feature</span>
            <LinkPending />
          </Link>

          <UserMenu />
        </div>
      </div>
    </header>
  );
}
