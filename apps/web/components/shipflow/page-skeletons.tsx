import { cn } from "~/lib/utils";

/** Shimmer block — the atom for every page skeleton. */
function Bar({ className }: { className?: string }) {
  return <div className={cn("animate-pulse bg-foreground/[0.06]", className)} />;
}

/** Static (non-pulsing) bordered box — mirrors the icon containers in the real UI. */
function Box({ className }: { className?: string }) {
  return <div className={cn("border border-border bg-foreground/[0.03]", className)} />;
}

/** Mirrors <PageHeader>: big title + description + optional action. */
export function PageHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2.5">
        <Bar className="h-8 w-52" />
        <Bar className="h-3.5 w-80 max-w-full" />
      </div>
      <Bar className="hidden h-9 w-36 sm:block" />
    </div>
  );
}

/** Mirrors <StatTile>: mono caption + bordered icon box, big value, detail line. */
export function StatTileSkeleton() {
  return (
    <div className="border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <Bar className="h-2.5 w-24" />
        <Box className="size-8" />
      </div>
      <Bar className="mt-5 h-9 w-16" />
      <Bar className="mt-1.5 h-3 w-32" />
    </div>
  );
}

function StatTilesRow() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <StatTileSkeleton key={i} />
      ))}
    </div>
  );
}

/** Simple search input row used on the projects page. */
function SearchBarSkeleton() {
  return (
    <div className="flex items-center gap-2 border border-border bg-card px-3 py-2.5">
      <Bar className="size-4" />
      <Bar className="h-3 w-40" />
    </div>
  );
}

/** Generic single-line row (search results). */
export function RowSkeleton() {
  return (
    <div className="flex items-center justify-between gap-4 border border-border bg-card px-5 py-4">
      <div className="min-w-0 flex-1 space-y-2">
        <Bar className="h-4 w-1/3" />
        <Bar className="h-3 w-2/3" />
      </div>
      <Bar className="h-5 w-20" />
    </div>
  );
}

/** ───────────────────────── Dashboard ───────────────────────── */

// Mirrors the "Delivery pipeline" band: label + 5-cell bordered grid.
function PipelineBandSkeleton() {
  return (
    <div>
      <Bar className="mb-2 h-2.5 w-32" />
      <div className="grid grid-cols-2 overflow-hidden border border-border bg-card sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="border-b border-border p-4 last:border-b-0 sm:border-b-0 lg:border-r lg:last:border-r-0"
          >
            <Bar className="h-2.5 w-12" />
            <Bar className="mt-2 h-7 w-8" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Mirrors the "Active features" SectionCard: header band + divided rows.
function ActiveFeaturesSkeleton() {
  return (
    <div className="overflow-hidden border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-foreground/[0.02] px-5 py-4">
        <div className="space-y-2">
          <Bar className="h-4 w-28" />
          <Bar className="h-3 w-44" />
        </div>
        <Bar className="hidden h-9 w-32 sm:block" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="grid gap-4 px-5 py-4 md:grid-cols-[1.5fr_0.7fr_0.7fr] md:items-center">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <Bar className="h-4 w-40" />
                <Bar className="h-4 w-16" />
              </div>
              <Bar className="h-3 w-3/4" />
            </div>
            <Bar className="h-3 w-16" />
            <div className="flex items-center justify-between">
              <Bar className="h-3 w-24" />
              <Bar className="size-4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Full dashboard-shaped skeleton (stat tiles + pipeline band + active features). */
export function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton />
      <StatTilesRow />
      <PipelineBandSkeleton />
      <ActiveFeaturesSkeleton />
    </div>
  );
}

/** ───────────────────────── Features ───────────────────────── */

// Mirrors the "AI intake starts here" tinted banner.
function IntakeBannerSkeleton() {
  return (
    <div className="space-y-3 border border-primary/30 bg-primary/[0.06] p-5">
      <Bar className="h-4 w-44" />
      <Bar className="h-3 w-full max-w-2xl" />
      <Bar className="h-3 w-2/3 max-w-2xl" />
    </div>
  );
}

// Mirrors a feature card: title + status badge, 3-line description, footer meta.
function FeatureCardSkeleton() {
  return (
    <div className="flex flex-col border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <Bar className="h-4 w-1/2" />
        <Bar className="h-5 w-16" />
      </div>
      <div className="mt-3 space-y-2">
        <Bar className="h-3 w-full" />
        <Bar className="h-3 w-5/6" />
        <Bar className="h-3 w-2/3" />
      </div>
      <div className="mt-5 flex items-center justify-between">
        <Bar className="h-3 w-20" />
        <Bar className="h-3 w-16" />
      </div>
    </div>
  );
}

/** Feature card grid (inline list area of the features page). */
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <FeatureCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Full features-page skeleton (header + intake banner + card grid). */
export function GridPageSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <IntakeBannerSkeleton />
      <CardGridSkeleton />
    </div>
  );
}

/** ───────────────────────── Projects ───────────────────────── */

// Mirrors a project card: icon box + arrow, name, /slug, description, footer meta.
function ProjectCardSkeleton() {
  return (
    <div className="flex flex-col border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <Box className="size-9" />
        <Bar className="size-4" />
      </div>
      <Bar className="mt-4 h-4 w-1/2" />
      <Bar className="mt-1.5 h-2.5 w-20" />
      <div className="mt-2 space-y-2">
        <Bar className="h-3 w-full" />
        <Bar className="h-3 w-2/3" />
      </div>
      <div className="mt-4 border-t border-border pt-3">
        <Bar className="h-2.5 w-24" />
      </div>
    </div>
  );
}

/** Project card grid (inline list area of the projects page). */
export function ProjectsGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <ProjectCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Full projects-page skeleton (header + stat tiles + search + project grid). */
export function ProjectsPageSkeleton() {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton />
      <StatTilesRow />
      <SearchBarSkeleton />
      <ProjectsGridSkeleton />
    </div>
  );
}

/** ───────────────────────── Tasks ───────────────────────── */

// Mirrors a task card: title + description + status badge, then a footer line.
function TaskCardSkeleton() {
  return (
    <div className="border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <Bar className="h-4 w-1/3" />
          <Bar className="h-3 w-2/3" />
        </div>
        <Bar className="h-5 w-20" />
      </div>
      <Bar className="mt-4 h-3 w-56" />
    </div>
  );
}

/** Task card list (inline list area of the tasks page). */
export function TasksListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <TaskCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Full tasks-page skeleton (header + task list). */
export function TasksPageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <TasksListSkeleton rows={rows} />
    </div>
  );
}

/** ───────────────────────── PRDs ───────────────────────── */

// Mirrors a PRD row: icon box + title/status, with a status pill on the right.
function PrdRowSkeleton() {
  return (
    <div className="flex items-center justify-between gap-4 border border-border bg-card px-5 py-4">
      <div className="flex min-w-0 items-center gap-4">
        <Box className="size-10 shrink-0" />
        <div className="space-y-2">
          <Bar className="h-3.5 w-48" />
          <Bar className="h-3 w-28" />
        </div>
      </div>
      <Bar className="h-6 w-24" />
    </div>
  );
}

/** Full PRDs-page skeleton (header + PRD rows). */
export function PrdListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="grid gap-3">
        {Array.from({ length: rows }).map((_, i) => (
          <PrdRowSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

/** ───────────────────────── Reviews ───────────────────────── */

// Mirrors a review row: title + description, with a verdict pill on the right.
function ReviewCardSkeleton() {
  return (
    <div className="border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <Bar className="h-4 w-1/3" />
          <Bar className="h-3 w-2/3" />
        </div>
        <Bar className="h-6 w-28" />
      </div>
    </div>
  );
}

/** Full reviews-page skeleton (header + review rows). */
export function ReviewsListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="grid gap-3">
        {Array.from({ length: rows }).map((_, i) => (
          <ReviewCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

/** ───────────────────────── GitHub ───────────────────────── */

// Mirrors the two-column GitHub page: connection-status card + info/steps card.
function GithubStatusCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card p-8">
      <div className="mb-8 flex items-center gap-4">
        <Box className="size-12 rounded-xl" />
        <div className="space-y-2">
          <Bar className="h-4 w-28" />
          <Bar className="h-3 w-20" />
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-xl border border-border bg-foreground/[0.03] p-4">
        <Box className="size-5 rounded-md" />
        <Bar className="h-3.5 w-24" />
      </div>
      <Bar className="mt-4 h-8 w-40 rounded-lg" />
    </div>
  );
}

function GithubInfoCardSkeleton() {
  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-8">
      <Bar className="h-4 w-40" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3">
          <Box className="size-8 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Bar className="h-3.5 w-1/2" />
            <Bar className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Full GitHub-page skeleton (header + status card + info card). */
export function GithubPageSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="mt-6 grid max-w-5xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <GithubStatusCardSkeleton />
        <GithubInfoCardSkeleton />
      </div>
    </div>
  );
}

/** ───────────────────────── Billing ───────────────────────── */

function UsageBarSkeleton() {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Bar className="h-3 w-28" />
        <Bar className="h-3 w-14" />
      </div>
      <Bar className="h-1.5 w-full rounded-full" />
    </div>
  );
}

function PlanCardSkeleton() {
  return (
    <div className="flex flex-col rounded-lg border border-border bg-card p-5">
      <Bar className="mb-1 h-4 w-16" />
      <Bar className="mb-4 h-7 w-24" />
      <div className="mb-5 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Bar key={i} className="h-3 w-3/4" />
        ))}
      </div>
      <Bar className="mt-auto h-9 w-full" />
    </div>
  );
}

/** Full billing-page skeleton (header + usage card + plan grid). */
export function BillingPageSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="space-y-2">
            <Bar className="h-4 w-28" />
            <Bar className="h-3 w-52 max-w-full" />
          </div>
          <Bar className="h-6 w-16 rounded-full" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <UsageBarSkeleton key={i} />
          ))}
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <PlanCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

/** ───────────────────────── Settings ───────────────────────── */

function SettingsCardSkeleton({ lines = 2 }: { lines?: number }) {
  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-5">
      <Bar className="h-4 w-32" />
      {Array.from({ length: lines }).map((_, i) => (
        <Bar key={i} className="h-3.5 w-full" />
      ))}
    </div>
  );
}

/** Full settings-page skeleton (header + stacked cards in a narrow column). */
export function SettingsPageSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="max-w-2xl space-y-6">
        <SettingsCardSkeleton lines={1} />
        <SettingsCardSkeleton lines={2} />
        <SettingsCardSkeleton lines={3} />
      </div>
    </div>
  );
}

/** ───────────────────────── Copilot ───────────────────────── */

/** Full copilot-page skeleton (header + repo/prompt form card). */
export function CopilotPageSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="space-y-4 border border-border bg-card p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Bar className="h-2.5 w-24" />
              <Bar className="h-9 w-full" />
            </div>
          ))}
        </div>
        <Bar className="h-10 w-full" />
        <Bar className="h-28 w-full" />
        <Bar className="h-9 w-32" />
      </div>
    </div>
  );
}

/** Generic content-area skeleton — the group-level fallback for pages that
 *  don't ship their own loading.tsx (renders inside the real shell). */
export function ContentSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <RowSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
