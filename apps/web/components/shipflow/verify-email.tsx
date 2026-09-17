"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { BadgeCheck, Loader2, MailWarning, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "~/components/ui/input-otp";
import { cn } from "~/lib/utils";
import { trpc } from "~/trpc/client";

const VERIFY_TOAST_ID = "email-verify-prompt";
const DISMISS_KEY = "VelocityAI-email-verify-dismissed";
const RESEND_COOLDOWN_SECONDS = 30;

// ── Verified / unverified badge ─────────────────────────────────────────
export function EmailVerifiedBadge({
  verified,
  className,
}: {
  verified: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        verified
          ? "border-success/25 bg-success/10 text-success"
          : "border-amber-400/25 bg-amber-400/10 text-amber-600 dark:text-amber-300",
        className,
      )}
    >
      {verified ? <BadgeCheck className="size-3" /> : <MailWarning className="size-3" />}
      {verified ? "Verified" : "Unverified"}
    </span>
  );
}

// ── OTP dialog ──────────────────────────────────────────────────────────
export function VerifyEmailDialog({
  open,
  onOpenChange,
  onVerified,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified?: () => void;
}) {
  const utils = trpc.useUtils();
  const { data: status } = trpc.profile.emailStatus.useQuery(undefined, { enabled: open });

  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const sentForOpenRef = useRef(false);

  const sendCode = trpc.profile.sendEmailVerificationCode.useMutation({
    onSuccess: (data) => {
      if (data.alreadyVerified) {
        void utils.profile.emailStatus.invalidate();
        onOpenChange(false);
        return;
      }
      setCooldown(RESEND_COOLDOWN_SECONDS);
    },
    onError: (error) => toast.error(error.message),
  });

  const verify = trpc.profile.verifyEmailCode.useMutation({
    onSuccess: async () => {
      toast.dismiss(VERIFY_TOAST_ID);
      toast.success("Email verified", {
        description: "You can now receive PRDs and invitations by email.",
      });
      await Promise.all([
        utils.profile.emailStatus.invalidate(),
        utils.member.list.invalidate(),
      ]);
      onOpenChange(false);
      onVerified?.();
    },
    onError: (error) => {
      setCode("");
      toast.error(error.message);
    },
  });

  // Send a fresh code once per dialog opening.
  useEffect(() => {
    if (!open) {
      sentForOpenRef.current = false;
      setCode("");
      return;
    }
    if (!sentForOpenRef.current) {
      sentForOpenRef.current = true;
      sendCode.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Resend cooldown ticker.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const submit = useCallback(
    (value: string) => {
      if (value.length === 6 && !verify.isPending) verify.mutate({ code: value });
    },
    [verify],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-foreground/10 bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <ShieldCheck className="size-4 text-primary" />
            Verify your email
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {sendCode.isPending ? (
              "Sending a 6-digit code…"
            ) : (
              <>
                We sent a 6-digit code to{" "}
                <span className="font-medium text-foreground">{status?.email ?? "your email"}</span>.
                Enter it below to verify your address.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-5 py-2">
          <InputOTP
            maxLength={6}
            pattern={REGEXP_ONLY_DIGITS}
            value={code}
            onChange={setCode}
            onComplete={submit}
            disabled={verify.isPending || sendCode.isPending}
            autoFocus
          >
            <InputOTPGroup className="gap-2">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <InputOTPSlot
                  key={i}
                  index={i}
                  className="size-11 rounded-md border border-foreground/15 bg-foreground/[0.03] text-base font-semibold first:rounded-l-md last:rounded-r-md"
                />
              ))}
            </InputOTPGroup>
          </InputOTP>

          <Button
            type="button"
            className="w-full gap-1.5 bg-primary text-primary-foreground hover:bg-primary disabled:opacity-50"
            disabled={code.length !== 6 || verify.isPending || sendCode.isPending}
            onClick={() => submit(code)}
          >
            {verify.isPending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
            {verify.isPending ? "Verifying…" : "Verify email"}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Didn&apos;t get it?{" "}
            <button
              type="button"
              disabled={cooldown > 0 || sendCode.isPending}
              onClick={() => sendCode.mutate()}
              className="font-medium text-primary underline-offset-2 enabled:hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            >
              {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
            </button>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Persistent bottom-right prompt ──────────────────────────────────────
// Mounted once inside the protected layout. If the signed-in user's email is
// unverified (typical after a GitHub sign-in), raise a sticky toast — it never
// auto-dismisses, but the user can dismiss it for the rest of the session.
export function EmailVerificationPrompt() {
  const { data: status } = trpc.profile.emailStatus.useQuery();
  const [dialogOpen, setDialogOpen] = useState(false);
  const raisedRef = useRef(false);

  useEffect(() => {
    if (!status) return;

    if (status.emailVerified) {
      if (raisedRef.current) toast.dismiss(VERIFY_TOAST_ID);
      return;
    }
    if (raisedRef.current) return;
    if (typeof window !== "undefined" && sessionStorage.getItem(DISMISS_KEY) === "1") return;

    raisedRef.current = true;
    toast.custom(
      (t) => (
        <div className="pointer-events-auto flex w-[360px] max-w-[calc(100vw-2rem)] items-start gap-3 rounded-xl border border-amber-400/25 bg-popover p-4 shadow-lg shadow-black/20">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-amber-400/25 bg-amber-400/10">
            <MailWarning className="size-4 text-amber-500 dark:text-amber-300" />
          </div>
          <div className="min-w-0 flex-1 space-y-2.5">
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-popover-foreground">Verify your email</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                <span className="break-all font-medium text-popover-foreground/80">{status.email}</span>{" "}
                isn&apos;t verified yet, so you can&apos;t receive shared PRDs or invitations.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                className="h-7 gap-1.5 bg-primary px-2.5 text-xs text-primary-foreground hover:bg-primary"
                onClick={() => setDialogOpen(true)}
              >
                <ShieldCheck className="size-3.5" />
                Verify email
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  sessionStorage.setItem(DISMISS_KEY, "1");
                  toast.dismiss(t);
                }}
              >
                Not now
              </Button>
            </div>
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => {
              sessionStorage.setItem(DISMISS_KEY, "1");
              toast.dismiss(t);
            }}
            className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ),
      { id: VERIFY_TOAST_ID, duration: Infinity, position: "bottom-right" },
    );
  }, [status]);

  return <VerifyEmailDialog open={dialogOpen} onOpenChange={setDialogOpen} />;
}
