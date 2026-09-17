"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, type Variants } from "framer-motion";
import {
  CheckCircle2, ChevronRight, ExternalLink, GitBranch, Github,
  Loader2, Lock, Globe, Search, ShieldCheck, Link2, Settings, Unlink2,
  FolderGit2, FolderPlus, Plus,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "~/components/shipflow/ui-kit";
import { GithubPageSkeleton } from "~/components/shipflow/page-skeletons";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import { ProjectTag, useActiveProject } from "~/components/shipflow/project-context";
import { GithubRepoDashboard, type ConnectedRepo } from "~/components/shipflow/github-repo-dashboard";
import { trpc } from "~/trpc/client";
import {
  listAppInstallations,
  listInstallationRepos,
  saveInstallationAction,
  type AppInstallation,
  type GithubRepo,
} from "@/features/github/actions";
import { refreshRepoContextAction } from "@/features/copilot/server/actions";

const FADE_UP: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
};

const GITHUB_APP_NAME = process.env.NEXT_PUBLIC_GITHUB_APP_NAME;

// First-time install: GitHub's "install this app" screen. Returns null when the
// app name isn't configured so callers can surface a clear error instead of
// sending the user to GitHub's app-creation page.
function getInstallUrl() {
  return GITHUB_APP_NAME
    ? `https://github.com/apps/${GITHUB_APP_NAME}/installations/new`
    : null;
}

// Already installed: jump straight to THIS installation's repository-access
// page. Reusing `installations/new` for an app that's already installed often
// dead-ends on GitHub without redirecting back (the popup appears to stall), so
// manage flows must target the installation directly.
function getManageUrl(installationId: number) {
  return `https://github.com/settings/installations/${installationId}`;
}

function slugifyProject(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Dialog shown when a repo is connected without an active project selected.
 * Lets the user pick one of the org's existing projects — or create a new one
 * inline — as the connection target, then connects the repo to it.
 */
function ProjectPickerDialog({
  open,
  onOpenChange,
  repoName,
  onPick,
  connecting,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  repoName: string;
  onPick: (projectId: string, projectName: string) => void;
  connecting: boolean;
}) {
  const { projects, setActiveProjectId } = useActiveProject();
  const utils = trpc.useUtils();
  const [creating, setCreating] = useState(projects.length === 0);
  const [name, setName] = useState("");

  // With no projects at all there's nothing to pick — go straight to create.
  useEffect(() => {
    if (open) setCreating(projects.length === 0);
  }, [open, projects.length]);

  const createProject = trpc.project.create.useMutation({
    onError: (err) => toast.error(err.message),
    onSuccess: (project) => {
      if (!project) return;
      void utils.project.list.invalidate();
      // Make the new project the active scope so later connects default to it.
      setActiveProjectId(project.id);
      onPick(project.id, project.name);
    },
  });

  const slug = slugifyProject(name);
  const busy = connecting || createProject.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-popover sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect {repoName}</DialogTitle>
          <DialogDescription>
            {creating
              ? "Create a project to connect this repository to."
              : "Select the project you want to connect this repository to, or create a new one."}
          </DialogDescription>
        </DialogHeader>

        {!creating ? (
          <div className="space-y-3 py-1">
            <div className="max-h-64 space-y-1.5 overflow-y-auto" data-lenis-prevent>
              {projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={busy}
                  onClick={() => onPick(p.id, p.name)}
                  className="flex w-full items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5 text-left transition hover:border-primary/40 hover:bg-foreground/[0.04] disabled:opacity-50"
                >
                  <FolderGit2 className="size-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{p.name}</span>
                    {p.description ? (
                      <span className="block truncate text-xs text-muted-foreground">{p.description}</span>
                    ) : null}
                  </span>
                  <Link2 className="size-3.5 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary transition hover:underline"
            >
              <Plus className="size-3.5" />
              Create a new project instead
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim() || !slug) return;
              createProject.mutate({ name: name.trim(), slug });
            }}
            className="space-y-3 py-1"
          >
            <div className="grid gap-1.5">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Project name, e.g. Mobile App"
                autoFocus
                required
              />
              {slug ? <p className="font-mono text-[11px] text-muted-foreground">/{slug}</p> : null}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={!name.trim() || !slug || busy}
                className="inline-flex h-9 items-center justify-center gap-2 bg-primary px-4 text-sm font-medium text-primary-foreground transition-transform hover:opacity-95 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <FolderPlus className="size-4" />}
                Create &amp; connect
              </button>
              {projects.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="h-9 rounded-lg border border-foreground/10 px-3 text-sm text-muted-foreground transition hover:bg-foreground/5"
                >
                  Back
                </button>
              )}
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RepoRow({
  repo,
  projectId,
  installationId,
  onConnected,
}: {
  repo: GithubRepo;
  projectId: string | null;
  installationId: number;
  onConnected: (repo: ConnectedRepo) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const { activeProject } = useActiveProject();

  const connectRepo = trpc.github.connectRepo.useMutation({
    onError: (err) => toast.error(err.message),
  });

  function connectTo(pid: string, pname: string) {
    connectRepo.mutate(
      {
        projectId: pid,
        fullName: repo.fullName,
        githubRepoId: repo.id,
        installationId,
      },
      {
        onSuccess: (connected) => {
          toast.success(`${repo.name} connected to ${pname}`);
          setPickerOpen(false);
          // Kick off the AI repo analysis in the background so the dashboard's
          // summary (and the Agent's repo context) is ready without a manual
          // "Generate" click. Best-effort — the dashboard can retry.
          if (connected?.id) void refreshRepoContextAction(connected.id);
          onConnected({
            id: connected?.id ?? null,
            fullName: repo.fullName,
            name: repo.name,
            installationId,
            defaultBranch: repo.defaultBranch,
            projectId: pid,
          });
        },
      },
    );
  }

  return (
    <div className="flex items-center gap-4 px-5 py-3.5">
      <div className="text-muted-foreground">
        {repo.private ? <Lock className="size-4" /> : <Globe className="size-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{repo.fullName}</p>
        <p className="text-xs text-muted-foreground">default: {repo.defaultBranch}</p>
      </div>
      <Button
        size="sm"
        disabled={connectRepo.isPending}
        onClick={() => {
          // With an active project, connect straight to it. Otherwise let the
          // user pick or create the target project first.
          if (projectId) {
            connectTo(projectId, activeProject?.name ?? "project");
          } else {
            setPickerOpen(true);
          }
        }}
        className="shrink-0 bg-primary text-primary-foreground hover:bg-primary disabled:opacity-40"
      >
        {connectRepo.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Link2 className="size-3.5" />}
        Connect
      </Button>

      <ProjectPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        repoName={repo.name}
        onPick={connectTo}
        connecting={connectRepo.isPending}
      />
    </div>
  );
}

function ConnectedRepoRow({
  repo,
  isDeletedOnGithub,
  onSelect,
}: {
  repo: { id: string; fullName: string; name: string; defaultBranch: string | null; installationId: number | null; projectId: string | null };
  isDeletedOnGithub: boolean;
  onSelect: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const utils = trpc.useUtils();

  const disconnect = trpc.github.disconnectRepo.useMutation({
    onSuccess: () => {
      toast.success(`${repo.name} disconnected`);
      void utils.github.repositories.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className={cn("flex w-full items-center gap-4 px-5 py-3.5 transition hover:bg-foreground/[0.03]", !isDeletedOnGithub && "cursor-pointer")}>
      <CheckCircle2 className={cn("size-4 shrink-0", isDeletedOnGithub ? "text-destructive/60" : "text-success")} />

      {isDeletedOnGithub ? (
        <div className="flex-1 min-w-0 text-left">
          <p className="truncate text-sm font-medium text-foreground/40 line-through decoration-foreground/40">
            {repo.fullName}
          </p>
          <p className="text-xs text-destructive/70">Deleted from GitHub account</p>
        </div>
      ) : (
        <button type="button" onClick={onSelect} className="flex-1 min-w-0 cursor-pointer text-left">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-foreground">{repo.fullName}</p>
            <ProjectTag projectId={repo.projectId} className="shrink-0" />
          </div>
          <p className="text-xs text-muted-foreground">branch: {repo.defaultBranch ?? "main"}</p>
        </button>
      )}

      {!isDeletedOnGithub && !confirming && (
        <button
          type="button"
          onClick={onSelect}
          className="inline-flex shrink-0 cursor-pointer items-center gap-1 text-xs text-primary transition hover:underline"
        >
          View dashboard <ChevronRight className="size-3.5" />
        </button>
      )}

      {confirming ? (
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-muted-foreground">Disconnect?</span>
          <button
            type="button"
            onClick={() => disconnect.mutate({ repoId: repo.id })}
            disabled={disconnect.isPending}
            className="inline-flex items-center gap-1 rounded border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive transition hover:bg-destructive/20 disabled:opacity-50"
          >
            {disconnect.isPending && <Loader2 className="size-3 animate-spin" />}
            Yes
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded border border-foreground/10 px-2 py-1 text-xs font-medium text-muted-foreground transition hover:bg-foreground/5"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setConfirming(true); }}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-foreground/10 bg-foreground/5 px-2.5 py-1.5 text-xs text-muted-foreground transition hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
        >
          <Unlink2 className="size-3.5" />
          {isDeletedOnGithub ? "Remove" : "Disconnect"}
        </button>
      )}
    </div>
  );
}

export default function GithubPage() {
  const searchParams = useSearchParams();
  const urlInstallationId = searchParams.get("installationId");

  const { activeProjectId, activeProject } = useActiveProject();
  const utils = trpc.useUtils();
  const { data: installStatus = { installed: false, installation: null }, refetch, isLoading: statusLoading } =
    trpc.github.getInstallationStatus.useQuery();
  // All repos connected anywhere in the org. We scope the displayed list to the
  // active project below, and use the full set to hide already-connected repos
  // from the "Available" pool (one repo → one project).
  const { data: orgRepos = [] } = trpc.github.repositories.useQuery(undefined, {
    enabled: installStatus.installed,
  });
  const connectedRepos = activeProjectId
    ? orgRepos.filter((r) => r.projectId === activeProjectId)
    : orgRepos;

  const [githubRepos, setGithubRepos] = useState<GithubRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [reposLoaded, setReposLoaded] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<ConnectedRepo | null>(null);
  const [detectedInstalls, setDetectedInstalls] = useState<AppInstallation[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [repoQuery, setRepoQuery] = useState("");
  const [debouncedRepoQuery, setDebouncedRepoQuery] = useState("");

  // Debounce the filter term — the input stays instant, the list re-filters
  // after typing settles.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedRepoQuery(repoQuery), 200);
    return () => clearTimeout(id);
  }, [repoQuery]);

  // Latest installation id, kept in a ref so the popup-close handler (a stale
  // closure) can always reload repos against the current installation.
  const installationIdRef = useRef<number | null>(null);
  useEffect(() => {
    installationIdRef.current = installStatus.installation?.installationId ?? null;
  }, [installStatus.installation?.installationId]);

  // Saving goes through a server action that verifies the installation id
  // actually belongs to this user before writing (ids are guessable, so the
  // client-supplied value is never trusted).
  const [savingInstallation, setSavingInstallation] = useState(false);
  async function saveInstallation(installationId: number) {
    if (!Number.isFinite(installationId)) return;
    setSavingInstallation(true);
    const res = await saveInstallationAction({ installationId });
    setSavingInstallation(false);
    if (res.ok) {
      toast.success("GitHub installation connected");
      refetch();
      utils.github.repositories.invalidate();
    } else {
      toast.error(res.error);
    }
  }

  // When GitHub redirects back with ?installationId=..., save it immediately
  useEffect(() => {
    if (urlInstallationId && !installStatus.installed) {
      void saveInstallation(Number(urlInstallationId));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlInstallationId]);

  // Fallback: if GitHub didn't redirect back, auto-detect an existing installation.
  async function detectInstallations(auto = false) {
    setDetecting(true);
    const installs = await listAppInstallations();
    setDetectedInstalls(installs);
    setDetecting(false);
    // If exactly one installation exists, connect it automatically. Account
    // details are resolved server-side during verification, not passed in.
    if (auto && installs.length === 1) {
      void saveInstallation(installs[0]!.installationId);
    }
  }

  useEffect(() => {
    if (!installStatus.installed && !urlInstallationId && detectedInstalls.length === 0) {
      void detectInstallations(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installStatus.installed, urlInstallationId]);

  // Load the installation's accessible repos from the GitHub API
  async function loadGithubRepos(id: number) {
    setLoadingRepos(true);
    const repos = await listInstallationRepos(id);
    setGithubRepos(repos);
    setLoadingRepos(false);
    setReposLoaded(true);
  }

  // Once installed, fetch repos from GitHub API
  useEffect(() => {
    const id = installStatus.installation?.installationId;
    if (!id) return;
    void loadGithubRepos(id);
  }, [installStatus.installation?.installationId]);

  // Listen for the popup's "installed" message (BroadcastChannel + postMessage),
  // verify origin + CSRF state, then save the installation in this first-party
  // window (where the session cookie lives).
  useEffect(() => {
    function handlePayload(data: { installationId?: string | null; state?: string | null }) {
      if (!data?.installationId) return;
      const expected = sessionStorage.getItem("gh_oauth_state");
      // If a state was round-tripped, it must match; missing state is tolerated.
      if (data.state && expected && data.state !== expected) return;
      sessionStorage.removeItem("gh_oauth_state");
      void saveInstallation(Number(data.installationId));
    }

    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "shipflow:github-installed") handlePayload(event.data);
    }

    window.addEventListener("message", onMessage);
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("shipflow-github");
      bc.onmessage = (event) => {
        if (event.data?.type === "shipflow:github-installed") handlePayload(event.data);
      };
    } catch {
      /* BroadcastChannel unsupported — postMessage still covers it */
    }

    return () => {
      window.removeEventListener("message", onMessage);
      bc?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Open GitHub's install/configure screen in a centered popup. On close we
  // refresh installation + repo state so the UI reflects any changes.
  function openGithubPopup(baseUrl: string | null) {
    if (!baseUrl) {
      toast.error("GitHub App isn't configured. Set NEXT_PUBLIC_GITHUB_APP_NAME and redeploy.");
      return;
    }

    const state = crypto.randomUUID();
    sessionStorage.setItem("gh_oauth_state", state);
    const url = `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}state=${state}`;

    const w = 1020;
    const h = 820;
    const left = window.screenX + Math.max(0, (window.outerWidth - w) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - h) / 2);
    const popup = window.open(
      url,
      "shipflow-github",
      `popup=yes,width=${w},height=${h},left=${left},top=${top}`,
    );

    if (!popup) {
      toast.error("Popup blocked — allow popups for this site and try again.");
      return;
    }
    popup.focus();

    // Even if GitHub never redirects back to our handoff page (common when the
    // app is already installed), closing the popup must fully refresh state —
    // including reloading the installation's repos against the current id.
    const timer = window.setInterval(() => {
      if (popup.closed) {
        window.clearInterval(timer);
        refetch();
        utils.github.repositories.invalidate();
        const id = installationIdRef.current;
        if (id) void loadGithubRepos(id);
      }
    }, 700);
  }

  // Hide repos already connected to ANY project in the org from the pool.
  const connectedAnywhere = new Set(orgRepos.map((r) => r.fullName));
  const unconnectedRepos = githubRepos.filter((r) => !connectedAnywhere.has(r.fullName));
  const githubFullNames = new Set(githubRepos.map((r) => r.fullName));

  // Repo search — only worth showing once there's more than one repo to sift.
  const q = debouncedRepoQuery.trim().toLowerCase();
  const matchesQuery = (fullName: string) => fullName.toLowerCase().includes(q);
  const visibleConnected = q ? connectedRepos.filter((r) => matchesQuery(r.fullName)) : connectedRepos;
  const visibleUnconnected = q ? unconnectedRepos.filter((r) => matchesQuery(r.fullName)) : unconnectedRepos;
  const showRepoSearch = connectedRepos.length + unconnectedRepos.length > 1;

  // If a repo is selected, show its detailed dashboard.
  if (selectedRepo) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={selectedRepo.name}
          description={activeProject ? `Repository in ${activeProject.name}.` : "Connected repository."}
        />
        <GithubRepoDashboard repo={selectedRepo} onBack={() => setSelectedRepo(null)} />
      </div>
    );
  }

  // Show the layout-matched skeleton until the connection status resolves, so we
  // never flash the "Install" state at an org that's already connected.
  if (statusLoading) {
    return <GithubPageSkeleton />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="GitHub Integration"
        description="Connect repositories to enable AI code review and track PRs, commits, and contributors."
      />
      <motion.div
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}
        className="mt-6 grid max-w-5xl gap-6 lg:grid-cols-[0.9fr_1.1fr]"
      >
        {/* Connection status card */}
        <motion.div variants={FADE_UP} className="group relative overflow-hidden rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-foreground/5 blur-3xl transition-all group-hover:bg-primary/20" />

          <div className="mb-8 flex items-center gap-4">
            <div className="grid size-12 place-items-center rounded-xl bg-foreground/5 text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
              <Github className="size-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">GitHub App</h2>
              <p className="text-sm text-muted-foreground">Repository access</p>
            </div>
          </div>

          {savingInstallation ? (
            <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/10 p-4">
              <Loader2 className="size-5 animate-spin text-primary" />
              <p className="text-sm font-medium text-primary">Saving installation…</p>
            </div>
          ) : installStatus.installed ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl border border-success/20 bg-success/10 p-4">
                <ShieldCheck className="size-5 text-success" />
                <div>
                  <p className="font-medium text-success">Connected</p>
                  {installStatus.installation?.accountLogin && (
                    <p className="text-xs text-success/70">@{installStatus.installation.accountLogin}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => openGithubPopup(getManageUrl(installStatus.installation!.installationId))}
                className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-1.5 text-xs text-foreground/80 transition hover:bg-foreground/10"
              >
                <Settings className="size-3.5" />
                Manage repositories
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Install the VelocityAI GitHub App to automatically sync pull requests, trigger AI code reviews, and post status checks directly to your repositories.
              </p>
              <button
                type="button"
                onClick={() => openGithubPopup(getInstallUrl())}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground shadow-sm transition-all hover:scale-[1.02] hover:opacity-95 active:scale-[0.98]"
              >
                Install / Connect GitHub App
                <ExternalLink className="size-4" />
              </button>
              {getInstallUrl() && (
                <a
                  href={getInstallUrl()!}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-center text-xs text-muted-foreground underline-offset-2 hover:text-foreground/80 hover:underline"
                >
                  Popup blocked? Open in a new tab instead
                </a>
              )}

              {/* Fallback: already installed but GitHub didn't redirect back */}
              <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4">
                <p className="text-xs font-medium text-foreground/80">Already installed the app?</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  If GitHub didn&apos;t bring you back automatically, detect your existing installation here.
                </p>

                {detecting ? (
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" /> Looking for installations…
                  </div>
                ) : detectedInstalls.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {detectedInstalls.map((inst) => (
                      <div key={inst.installationId} className="flex items-center gap-3 rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-2">
                        {inst.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={inst.avatarUrl} alt={inst.accountLogin ?? ""} className="size-6 rounded-full" />
                        ) : (
                          <Github className="size-5 text-muted-foreground" />
                        )}
                        <span className="flex-1 truncate text-sm text-foreground">
                          {inst.accountLogin ?? `Installation ${inst.installationId}`}
                        </span>
                        <Button
                          size="sm"
                          disabled={savingInstallation}
                          onClick={() => void saveInstallation(inst.installationId)}
                          className="bg-primary text-primary-foreground hover:bg-primary"
                        >
                          {savingInstallation ? <Loader2 className="size-3.5 animate-spin" /> : <Link2 className="size-3.5" />}
                          Connect
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => detectInstallations(false)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-1.5 text-xs text-foreground/80 transition hover:bg-foreground/10"
                  >
                    <Github className="size-3.5" />
                    Detect installation
                  </button>
                )}
              </div>
            </div>
          )}
        </motion.div>

        {/* How it works */}
        <motion.div variants={FADE_UP} className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <GitBranch className="size-5 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">How it works</h2>
          </div>
          <div className="relative border-l border-foreground/10 pl-6 space-y-8">
            {[
              { title: "Install the GitHub App", desc: "Grant access to your selected repositories." },
              { title: "Connect a repo to this project", desc: `Repos connect to ${activeProject?.name ?? "the active project"}.` },
              { title: "Create a feature branch", desc: "Use the format feature/{featureId} for automatic tracking." },
              { title: "Open a pull request", desc: "VelocityAI detects the new PR and caches it here." },
              { title: "Automated AI Review", desc: "Code is reviewed against the PRD and shown in the Review tab." },
            ].map((step, i) => (
              <div key={i} className="relative">
                <span className="absolute -left-[37px] grid size-7 place-items-center rounded-full border border-primary/30 bg-card font-mono text-[11px] font-bold text-primary">
                  {i + 1}
                </span>
                <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>

      {/* Repo connection section — only shown when GitHub is connected */}
      {installStatus.installed && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-8 max-w-5xl space-y-6"
        >
          {!activeProjectId && (
            <p className="rounded-xl border border-foreground/10 bg-foreground/[0.03] px-4 py-3 text-sm text-muted-foreground">
              No project selected — you&apos;ll pick (or create) the project to connect a repository to when you hit Connect.
            </p>
          )}

          {/* Search — surfaced once more than one repo is accessible */}
          {showRepoSearch && (
            <div className="relative max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={repoQuery}
                onChange={(e) => setRepoQuery(e.target.value)}
                placeholder="Search repositories…"
                aria-label="Search repositories"
                className="w-full rounded-xl border border-foreground/10 bg-foreground/[0.03] py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none"
              />
            </div>
          )}

          {/* Connected repos — clickable into the dashboard */}
          {connectedRepos.length > 0 && (
            <div>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <CheckCircle2 className="size-4 text-success" />
                Connected repositories ({connectedRepos.length})
              </h2>
              {visibleConnected.length === 0 ? (
                <div className="rounded-xl border border-foreground/10 py-8 text-center text-sm text-muted-foreground">
                  No connected repositories match “{debouncedRepoQuery}”.
                </div>
              ) : (
                <div className="divide-y divide-foreground/5 overflow-hidden rounded-xl border border-foreground/10">
                  {visibleConnected.map((r) => (
                    <ConnectedRepoRow
                      key={r.id}
                      repo={r}
                      isDeletedOnGithub={reposLoaded && !githubFullNames.has(r.fullName)}
                      onSelect={() =>
                        setSelectedRepo({
                          id: r.id,
                          fullName: r.fullName,
                          name: r.name,
                          installationId: r.installationId,
                          defaultBranch: r.defaultBranch,
                          projectId: r.projectId,
                        })
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Available repos to connect */}
          <div>
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                {loadingRepos ? "Loading repositories…" : `Available repositories (${unconnectedRepos.length})`}
              </h2>
              <span className="text-xs text-muted-foreground">
                {activeProject ? (
                  <>Connecting to <span className="font-medium text-primary">{activeProject.name}</span></>
                ) : (
                  "Choose a project on connect"
                )}
              </span>
            </div>

            {loadingRepos ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl border border-foreground/10 bg-foreground/[0.03]" />
                ))}
              </div>
            ) : unconnectedRepos.length === 0 ? (
              <div className="rounded-xl border border-foreground/10 py-12 text-center text-sm text-muted-foreground">
                All accessible repositories are already connected.
              </div>
            ) : visibleUnconnected.length === 0 ? (
              <div className="rounded-xl border border-foreground/10 py-12 text-center text-sm text-muted-foreground">
                No repositories match “{debouncedRepoQuery}”.
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-foreground/10 divide-y divide-foreground/5">
                {visibleUnconnected.map((repo) => (
                  <RepoRow
                    key={repo.id}
                    repo={repo}
                    projectId={activeProjectId}
                    installationId={installStatus.installation!.installationId}
                    onConnected={(connected) => {
                      utils.github.repositories.invalidate();
                      setSelectedRepo(connected);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
