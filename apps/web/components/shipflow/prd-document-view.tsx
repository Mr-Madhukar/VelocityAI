"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  AtSign,
  Check,
  Download,
  FileText,
  LayoutList,
  Loader2,
  MailWarning,
  Plus,
  Send,
  Share2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { cn } from "~/lib/utils";
import { trpc } from "~/trpc/client";

export type PrdDocFields = {
  version: number;
  problem: string;
  goals: string[];
  nonGoals: string[];
  userStories: string[];
  acceptanceCriteria: string[];
  edgeCases: string[];
  successMetrics: string[];
  technicalRequirements: string[];
  dependencies: string[];
  risks: string[];
  estimatedTotalHours: number | null;
  targetDeadline: string | Date | null;
  approvedAt: string | Date | null;
};

export type PrdDocMeta = {
  featureTitle: string;
  priority: string;
  status: string;
  createdByName: string | null;
  createdAt: string | Date;
  orgName: string | null;
};

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// ── View toggle ─────────────────────────────────────────────────────────
export type PrdView = "structured" | "document";

export function PrdViewToggle({ view, onChange }: Readonly<{ view: PrdView; onChange: (v: PrdView) => void }>) {
  const options: { value: PrdView; label: string; icon: React.ReactNode }[] = [
    { value: "structured", label: "Structured", icon: <LayoutList className="size-3.5" /> },
    { value: "document", label: "Document", icon: <FileText className="size-3.5" /> },
  ];
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-foreground/3 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={view === o.value}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            view === o.value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Toolbar (toggle + download + share) ─────────────────────────────────
export function PrdDocActions({
  view,
  onView,
  featureId,
  prdId,
  featureTitle,
}: Readonly<{
  view: PrdView;
  onView: (v: PrdView) => void;
  featureId: string;
  prdId: string;
  featureTitle: string;
}>) {
  const [shareOpen, setShareOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/features/${featureId}/prd-pdf`);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = (/filename="?([^"]+)"?/).exec(disposition);
      const filename = match?.[1] ?? "PRD.pdf";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Could not download the PDF");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <PrdViewToggle view={view} onChange={onView} />
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleDownload}
          disabled={downloading}
          className="gap-1.5 border-foreground/10 bg-foreground/5 text-foreground hover:bg-foreground/10"
        >
          {downloading ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
          {downloading ? "Preparing…" : "Download PDF"}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => setShareOpen(true)}
          className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary"
        >
          <Share2 className="size-3.5" />
          Share
        </Button>
      </div>
      <PrdShareDialog open={shareOpen} onOpenChange={setShareOpen} prdId={prdId} featureId={featureId} featureTitle={featureTitle} />
    </div>
  );
}

// ── Share dialog ────────────────────────────────────────────────────────
function initials(name: string | null, email: string): string {
  const src = (name ?? email ?? "?").trim();
  return src.slice(0, 1).toUpperCase();
}

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

function PrdShareDialog({
  open,
  onOpenChange,
  prdId,
  featureId,
  featureTitle,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prdId: string;
  featureId: string;
  featureTitle: string;
}>) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [externalEmails, setExternalEmails] = useState<string[]>([]);

  const { data: members = [], isLoading } = trpc.member.list.useQuery(undefined, { enabled: open });

  // Only teammates with a verified email address can receive the PRD — the
  // rest (typically GitHub sign-ins with noreply addresses) show as disabled.
  const eligible = useMemo(
    () => members.filter((m) => m.emailVerified && m.email?.includes("@")),
    [members],
  );
  const eligibleIds = useMemo(() => new Set(eligible.map((m) => m.userId)), [eligible]);

  function reset() {
    setSelected(new Set());
    setMessage("");
    setEmailInput("");
    setExternalEmails([]);
  }

  const share = trpc.prd.share.useMutation({
    onSuccess: ({ sent, failed }) => {
      const recipientSuffix = sent === 1 ? "" : "s";
      const failureSuffix = failed > 0 ? ` · ${failed} failed` : "";
      toast.success(`PRD sent to ${sent} recipient${recipientSuffix}${failureSuffix}`);
      onOpenChange(false);
      reset();
    },
    onError: (error) => toast.error(error.message),
  });

  function toggle(userId: string) {
    if (!eligibleIds.has(userId)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  const allSelected = eligible.length > 0 && selected.size === eligible.length;
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(eligible.map((m) => m.userId)));
  }

  function addEmail(): boolean {
    const email = emailInput.trim().toLowerCase();
    if (!email) return true;
    if (!EMAIL_RE.test(email)) {
      toast.error("Enter a valid email address");
      return false;
    }
    if (!externalEmails.includes(email)) setExternalEmails((prev) => [...prev, email]);
    setEmailInput("");
    return true;
  }

  function handleSend() {
    // Fold a valid, not-yet-added address in the input into the send.
    const pending = emailInput.trim().toLowerCase();
    if (pending && !EMAIL_RE.test(pending)) {
      toast.error("Enter a valid email address");
      return;
    }
    const emails = pending && !externalEmails.includes(pending)
      ? [...externalEmails, pending]
      : externalEmails;

    if (selected.size === 0 && emails.length === 0) return;

    share.mutate({
      prdId,
      featureId,
      recipientUserIds: [...selected],
      externalEmails: emails,
      message: message.trim() || undefined,
    });
  }

  const recipientCount =
    selected.size +
    externalEmails.length +
    (emailInput.trim() && !externalEmails.includes(emailInput.trim().toLowerCase()) ? 1 : 0);

  let sendButtonLabel = "Send";
  if (share.isPending) {
    sendButtonLabel = "Sending…";
  } else if (recipientCount > 0) {
    sendButtonLabel = `Send to ${recipientCount}`;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-foreground/10 bg-card sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Share2 className="size-4 text-primary" />
            Share PRD with your team
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Recipients get an email with a link to view “{featureTitle}” in VelocityAI and the full PRD attached as a PDF. Teammates need a verified email to receive it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Users className="size-3.5" /> Team members
            </p>
            {eligible.length > 0 && (
              <button type="button" onClick={toggleAll} className="text-xs text-primary underline-offset-2 hover:underline">
                {allSelected ? "Clear all" : "Select all"}
              </button>
            )}
          </div>

          <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-foreground/10 bg-foreground/2 p-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : null}
            {!isLoading && members.length === 0 ? (
              <p className="px-3 py-8 text-center text-xs text-muted-foreground">
                No teammates yet. Invite members from Settings → Team, or send the PRD to an email address below.
              </p>
            ) : null}
            {!isLoading && members.length > 0
              ? members.map((m) => {
                  const enabled = eligibleIds.has(m.userId);
                  const checked = selected.has(m.userId);
                  let memberItemClass = "hover:bg-foreground/4";
                  if (!enabled) {
                    memberItemClass = "cursor-not-allowed opacity-50";
                  } else if (checked) {
                    memberItemClass = "bg-primary/10";
                  }
                  return (
                    <button
                      key={m.userId}
                      type="button"
                      onClick={() => toggle(m.userId)}
                      disabled={!enabled}
                      title={enabled ? undefined : "This teammate hasn't verified their email address yet."}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors",
                        memberItemClass,
                      )}
                    >
                      <Checkbox checked={checked} disabled={!enabled} className="pointer-events-none" />
                      {m.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.image} alt={m.name ?? m.email} className="size-7 rounded-full object-cover ring-1 ring-foreground/10" />
                      ) : (
                        <div className="grid size-7 place-items-center rounded-full bg-primary/20 text-xs font-bold text-primary ring-1 ring-foreground/10">
                          {initials(m.name, m.email)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-foreground">{m.name ?? m.email}</p>
                        <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                      </div>
                      {!enabled && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-400/25 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-300">
                          <MailWarning className="size-3" />
                          Unverified
                        </span>
                      )}
                      <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{m.role}</span>
                      {checked && <Check className="size-4 shrink-0 text-primary" />}
                    </button>
                  );
                })
              : null}
          </div>

          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <AtSign className="size-3.5" /> Or send to an email address
            </p>
            <div className="flex items-center gap-2">
              <Input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addEmail();
                  }
                }}
                placeholder="name@company.com"
                className="h-9 flex-1 border-foreground/10 bg-foreground/5 text-sm text-foreground placeholder:text-muted-foreground"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addEmail}
                disabled={!emailInput.trim()}
                className="h-9 gap-1 border-foreground/10 bg-foreground/5 px-3 text-foreground hover:bg-foreground/10"
              >
                <Plus className="size-3.5" />
                Add
              </Button>
            </div>
            {externalEmails.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {externalEmails.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 py-0.5 pl-2.5 pr-1 text-xs font-medium text-primary"
                  >
                    {email}
                    <button
                      type="button"
                      aria-label={`Remove ${email}`}
                      onClick={() => setExternalEmails((prev) => prev.filter((e) => e !== email))}
                      className="rounded-full p-0.5 transition-colors hover:bg-primary/15"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Add a message (optional)</p>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={1000}
              placeholder="e.g. Please review the acceptance criteria before our sync tomorrow."
              className="min-h-20 border-foreground/10 bg-foreground/5 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-foreground/10 bg-foreground/5 text-foreground/80 hover:bg-foreground/10"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={recipientCount === 0 || share.isPending}
            onClick={handleSend}
            className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary disabled:opacity-50"
          >
            {share.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {sendButtonLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── On-screen document view ─────────────────────────────────────────────
function renderBulletMarker(variant: "bullet" | "numbered" | "checklist", index: number): React.ReactNode {
  if (variant === "numbered") {
    return <span className="mt-0.5 w-5 shrink-0 font-mono text-sm font-semibold text-primary/80">{index + 1}.</span>;
  }
  if (variant === "checklist") {
    return <Check className="mt-1 size-4 shrink-0 text-primary/70" />;
  }
  return <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" />;
}

function DocSection({
  title,
  subtitle,
  audience,
  items,
  variant = "bullet",
}: Readonly<{
  title: string;
  subtitle?: string;
  audience?: "Managers" | "Developers" | "Everyone";
  items: string[];
  variant?: "bullet" | "numbered" | "checklist";
}>) {
  if (!items || items.length === 0) return null;
  return (
    <section className="scroll-mt-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <h3 className="border-l-2 border-primary/50 pl-3 text-lg font-semibold text-foreground">{title}</h3>
        {audience && (
          <span className="rounded-full border border-border bg-foreground/3 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            For {audience}
          </span>
        )}
      </div>
      {subtitle && <p className="ml-4 mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
      <ul className="ml-4 mt-3 space-y-0">
        {items.map((item, i) => (
          <li key={item} className="flex gap-3 border-t border-foreground/6 py-2.5 text-[15px] leading-relaxed text-foreground/80 first:border-t-0">
            {renderBulletMarker(variant, i)}
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PrdDocumentView({ fields, meta }: Readonly<{ fields: PrdDocFields; meta: PrdDocMeta }>) {
  const approved = Boolean(fields.approvedAt);
  const metaCards: { label: string; value: string }[] = [
    { label: "Version", value: `v${fields.version}` },
    { label: "Status", value: approved ? "Approved" : meta.status.replaceAll("_", " ") },
    { label: "Priority", value: meta.priority },
    { label: "Est. effort", value: fields.estimatedTotalHours ? `~${fields.estimatedTotalHours}h` : "—" },
    { label: "Target date", value: formatDate(fields.targetDeadline) },
  ];

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="space-y-9 p-6 sm:p-10">
        {/* Header */}
        <header className="border-b border-border pb-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Product Requirements Document</p>
          <h2 className="mt-2.5 text-3xl font-bold leading-tight tracking-tight text-foreground">{meta.featureTitle}</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            {meta.orgName ? `${meta.orgName} · ` : ""}Created by{" "}
            <span className="font-medium text-foreground/80">{meta.createdByName ?? "Unknown"}</span> on {formatDate(meta.createdAt)}
            {approved && <span className="text-foreground/70"> · Approved {formatDate(fields.approvedAt)}</span>}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-5">
            {metaCards.map((c) => (
              <div key={c.label}>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{c.label}</div>
                <div className="mt-1 text-sm font-semibold capitalize text-foreground">{c.value}</div>
              </div>
            ))}
          </div>
        </header>

        {/* Problem / overview */}
        <section>
          <h3 className="border-l-2 border-primary/50 pl-3 text-lg font-semibold text-foreground">Overview &amp; Problem</h3>
          <div className="ml-4 mt-3 rounded-lg border-l-2 border-border bg-foreground/2 p-5 text-[15px] leading-relaxed text-foreground/85">
            {fields.problem}
          </div>
        </section>

        <DocSection title="Goals" subtitle="What this feature must achieve." audience="Managers" items={fields.goals} variant="checklist" />
        <DocSection title="Non-Goals" subtitle="Explicitly out of scope." audience="Managers" items={fields.nonGoals} />
        <DocSection title="User Stories" subtitle="Who benefits and how." audience="Everyone" items={fields.userStories} variant="numbered" />
        <DocSection title="Success Metrics" subtitle="How we know it worked." audience="Managers" items={fields.successMetrics} />
        <DocSection title="Technical Requirements" audience="Developers" items={fields.technicalRequirements} />
        <DocSection title="Acceptance Criteria" subtitle="Must all pass before shipping." audience="Developers" items={fields.acceptanceCriteria} variant="checklist" />
        <DocSection title="Dependencies" audience="Developers" items={fields.dependencies} />
        <DocSection title="Edge Cases" audience="Developers" items={fields.edgeCases} />

        {fields.risks.length > 0 && (
          <section>
            <h3 className="flex items-center gap-2 border-l-2 border-primary/50 pl-3 text-lg font-semibold text-foreground">
              Risks &amp; Mitigations
            </h3>
            <ul className="ml-4 mt-3 space-y-0">
              {fields.risks.map((risk) => (
                <li key={risk} className="flex gap-3 border-t border-foreground/6 py-2.5 text-[15px] leading-relaxed text-foreground/80 first:border-t-0">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500/80" />
                  <span>{risk}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Footer */}
        <footer className="border-t border-border pt-5 text-xs text-muted-foreground">
          End of document · {meta.featureTitle} · v{fields.version}
        </footer>
      </div>
    </article>
  );
}
