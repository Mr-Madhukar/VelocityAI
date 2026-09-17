"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2, XCircle, Mail } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";

type State =
  | { status: "loading" }
  | { status: "needs-signin" }
  | { status: "accepting" }
  | { status: "success"; orgName: string }
  | { status: "wrong-account"; invitedEmail: string; currentEmail: string }
  | { status: "error"; message: string };

export default function InvitePage() {
  return (
    <Suspense>
      <InvitePageContent />
    </Suspense>
  );
}

function InvitePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [state, setState] = useState<State>({ status: "loading" });

  const { data: session, isPending: sessionPending } = authClient.useSession();

  const inviteQuery = trpc.member.getInvitation.useQuery(
    { invitationId: token ?? "" },
    { enabled: !!token, retry: false },
  );

  const acceptMutation = trpc.member.acceptInvitation.useMutation({
    onSuccess: (data) => {
      setState({ status: "success", orgName: data.orgName ?? "your organization" });
      // Refresh router cache so the new activeOrganizationId is picked up from the session
      router.refresh();
      setTimeout(() => router.push("/projects"), 2000);
    },
    onError: (err) => setState({ status: "error", message: err.message }),
  });

  useEffect(() => {
    if (sessionPending || inviteQuery.isPending) return;

    if (!token) {
      setState({ status: "error", message: "Invalid invitation link." });
      return;
    }

    if (inviteQuery.error) {
      setState({ status: "error", message: inviteQuery.error.message });
      return;
    }

    if (!session?.user) {
      setState({ status: "needs-signin" });
      return;
    }

    if (inviteQuery.data && state.status === "loading") {
      // Signed in, but with a different email than the invite was sent to —
      // membership attaches to the signed-in account, so guide them to switch
      // rather than silently joining the wrong identity.
      const invitedEmail = inviteQuery.data.email.trim().toLowerCase();
      const currentEmail = (session.user.email ?? "").trim().toLowerCase();
      if (invitedEmail !== currentEmail) {
        setState({
          status: "wrong-account",
          invitedEmail: inviteQuery.data.email,
          currentEmail: session.user.email ?? "",
        });
        return;
      }

      // Emails match — auto-accept.
      setState({ status: "accepting" });
      acceptMutation.mutate({ invitationId: token });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, sessionPending, inviteQuery.isPending, inviteQuery.data, inviteQuery.error]);

  function handleSignIn() {
    const callbackUrl = `/invite?token=${token}`;
    router.push(`/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  async function handleSwitchAccount() {
    // Sign the current account out, then send them to sign in with the invited
    // email — coming back here to finish accepting.
    await authClient.signOut().catch(() => {});
    const callbackUrl = `/invite?token=${token}`;
    window.location.href = `/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  }

  const invite = inviteQuery.data;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#090b10] px-4">
      <div className="w-full max-w-md rounded-2xl border border-foreground/10 bg-[#0d1118] p-10 text-center shadow-2xl">
        <div className="mb-8 flex items-center justify-center gap-2">
          <Image src="/icons/velocity-mark.svg" alt="VelocityAI" width={32} height={32} className="size-8" priority />
          <span className="text-xl font-bold tracking-tight text-primary">VelocityAI</span>
        </div>

        {(state.status === "loading" || state.status === "accepting") && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="size-10 animate-spin text-primary" />
            <p className="text-muted-foreground">
              {state.status === "accepting" ? "Accepting invitation…" : "Verifying your invitation…"}
            </p>
          </div>
        )}

        {state.status === "needs-signin" && invite && (
          <div className="flex flex-col items-center gap-6">
            <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
              <Mail className="size-8 text-primary" />
            </div>
            <div>
              <p className="text-xl font-semibold text-foreground">You&apos;re invited to join</p>
              <p className="mt-1 text-2xl font-bold text-primary">{invite.orgName}</p>
              <p className="mt-3 text-sm text-muted-foreground">
                as a <span className="font-medium text-foreground/80">{invite.role}</span>
              </p>
            </div>
            <Button
              onClick={handleSignIn}
              className="w-full bg-primary text-primary-foreground hover:bg-primary"
            >
              Sign in to accept
            </Button>
            <p className="text-xs text-muted-foreground">
              Don&apos;t have an account? You can sign up on the next page.
            </p>
          </div>
        )}

        {state.status === "success" && (
          <div className="flex flex-col items-center gap-4">
            <CheckCircle2 className="size-14 text-success" />
            <p className="text-xl font-semibold text-foreground">You&apos;re in!</p>
            <p className="text-sm text-muted-foreground">
              Welcome to <span className="text-foreground">{state.orgName}</span>. Redirecting to your dashboard…
            </p>
          </div>
        )}

        {state.status === "wrong-account" && (
          <div className="flex flex-col items-center gap-5">
            <div className="flex size-16 items-center justify-center rounded-full bg-amber-500/10">
              <Mail className="size-8 text-amber-400" />
            </div>
            <div>
              <p className="text-xl font-semibold text-foreground">Almost there</p>
              <p className="mt-3 text-sm text-muted-foreground">
                This invitation was sent to{" "}
                <span className="font-medium text-foreground">{state.invitedEmail}</span>, but you&apos;re
                signed in as{" "}
                <span className="font-medium text-foreground">{state.currentEmail}</span>.
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                Sign in with{" "}
                <span className="font-medium text-foreground">{state.invitedEmail}</span> to accept and
                access the organization and its projects.
              </p>
            </div>
            <Button
              onClick={handleSwitchAccount}
              className="w-full bg-primary text-primary-foreground hover:bg-primary"
            >
              Sign in with the invited email
            </Button>
          </div>
        )}

        {state.status === "error" && (
          <div className="flex flex-col items-center gap-4">
            <XCircle className="size-14 text-red-400" />
            <p className="text-xl font-semibold text-foreground">Invitation invalid</p>
            <p className="text-sm text-muted-foreground">{state.message}</p>
            <Button
              variant="ghost"
              onClick={() => router.push("/")}
              className="text-muted-foreground hover:text-foreground"
            >
              Go to homepage
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
