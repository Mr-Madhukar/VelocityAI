import {
  BadgeIndianRupee,
  Bot,
  Boxes,
  FolderKanban,
  GitBranch,
  LayoutDashboard,
  ListChecks,
  ScrollText,
  Settings,
  ShieldCheck,
  UserCircle,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Mono caption groups the sidebar like Neon's dashboard. */
  group: "Delivery" | "Workspace";
  /** Keyboard shortcut, e.g. "alt+d". Rendered in the sidebar + help modal. */
  shortcut: string;
};

export const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Delivery", shortcut: "alt+d" },
  { href: "/features", label: "Features", icon: Boxes, group: "Delivery", shortcut: "alt+f" },
  { href: "/prd", label: "PRDs", icon: ScrollText, group: "Delivery", shortcut: "alt+p" },
  { href: "/tasks", label: "Tasks", icon: ListChecks, group: "Delivery", shortcut: "alt+t" },
  { href: "/reviews", label: "Reviews", icon: ShieldCheck, group: "Delivery", shortcut: "alt+r" },
  { href: "/github", label: "GitHub", icon: GitBranch, group: "Delivery", shortcut: "alt+g" },
  { href: "/agent", label: "Agent", icon: Bot, group: "Delivery", shortcut: "alt+a" },
  { href: "/projects", label: "Projects", icon: FolderKanban, group: "Workspace", shortcut: "alt+o" },
  { href: "/billing", label: "Billing", icon: BadgeIndianRupee, group: "Workspace", shortcut: "alt+b" },
  { href: "/settings/team", label: "Team", icon: Users, group: "Workspace", shortcut: "alt+m" },
  { href: "/profile", label: "Profile", icon: UserCircle, group: "Workspace", shortcut: "alt+u" },
  { href: "/settings", label: "Settings", icon: Settings, group: "Workspace", shortcut: "alt+s" },
];

export const navGroups: NavItem["group"][] = ["Delivery", "Workspace"];

/** Extra (non-navigation) global shortcuts, shown in the help modal. */
export const globalShortcuts: { label: string; shortcut: string }[] = [
  { label: "New feature request", shortcut: "alt+n" },
  { label: "VelocityAI assistant", shortcut: "alt+c" },
  { label: "Command palette / search", shortcut: "mod+k" },
  { label: "Show keyboard shortcuts", shortcut: "shift+?" },
];

/** Split a shortcut string into display tokens, e.g. "alt+d" → ["Alt", "D"]. */
export function shortcutTokens(shortcut: string): string[] {
  return shortcut.split("+").map((part) => {
    switch (part) {
      case "alt":
        return "Alt";
      case "shift":
        return "Shift";
      case "ctrl":
        return "Ctrl";
      case "mod":
        return "⌘";
      default:
        return part.length === 1 ? part.toUpperCase() : part;
    }
  });
}

/**
 * Whether a keyboard event matches a shortcut string. Letter keys are matched by
 * `event.code` (KeyD) so they're layout-independent and unaffected by Alt
 * producing diacritics on some layouts.
 */
export function eventMatchesShortcut(
  event: Pick<KeyboardEvent, "altKey" | "ctrlKey" | "metaKey" | "shiftKey" | "code" | "key">,
  shortcut: string,
): boolean {
  const parts = shortcut.split("+");
  const key = parts[parts.length - 1]!;
  const needAlt = parts.includes("alt");
  const needShift = parts.includes("shift");

  if (needAlt !== event.altKey) return false;
  if (needShift !== event.shiftKey) return false;
  // Navigation shortcuts never use ctrl/meta.
  if (event.ctrlKey || event.metaKey) return false;

  if (key.length === 1 && /[a-z]/.test(key)) {
    return event.code === `Key${key.toUpperCase()}`;
  }
  return event.key === key;
}

/** Best-match nav item for a pathname (handles nested routes like /settings/team). */
export function activeNavHref(pathname: string): string | null {
  const match = navItems
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.href ?? null;
}

/** Human label for the current route, for the top-nav breadcrumb. */
export function routeLabel(pathname: string): string {
  if (pathname.startsWith("/features/new")) return "New request";
  if (/^\/features\/[^/]+$/.test(pathname)) return "Feature detail";
  if (pathname.startsWith("/search")) return "Search";
  const href = activeNavHref(pathname);
  return navItems.find((i) => i.href === href)?.label ?? "VelocityAI";
}
