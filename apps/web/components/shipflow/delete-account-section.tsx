"use client";

import { useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

/**
 * Settings → Account danger zone. Deleting is irreversible, so the dialog
 * requires re-typing the account email before the mutation fires. On success
 * the (already invalidated) session is signed out client-side and the user
 * lands back on the public home page.
 */
export function DeleteAccountSection({ email }: { email: string | null }) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");

  const deleteAccount = trpc.profile.deleteAccount.useMutation({
    onSuccess: async () => {
      toast.success("Your account has been deleted.");
      // The server already removed the session rows; signOut just clears the
      // stale cookie. Ignore failures — the redirect is what matters.
      await authClient.signOut().catch(() => undefined);
      window.location.href = "/";
    },
    onError: (err) => toast.error(err.message),
  });

  const emailMatches =
    !!email && confirmation.trim().toLowerCase() === email.toLowerCase();

  return (
    <div className="rounded-lg border border-red-500/25 bg-red-500/[0.04] p-5">
      <div className="flex items-center gap-2">
        <TriangleAlert className="size-4 text-red-500" />
        <h2 className="text-sm font-semibold text-foreground">Danger zone</h2>
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        Permanently delete your account. Organizations where you are the only member are deleted
        with all their data (projects, features, PRDs, tasks, reviews). Content in organizations
        you share with others stays with those organizations. This cannot be undone.
      </p>
      <Button
        variant="destructive"
        size="sm"
        className="mt-4"
        onClick={() => {
          setConfirmation("");
          setOpen(true);
        }}
      >
        Delete account
      </Button>

      <Dialog open={open} onOpenChange={(v) => !deleteAccount.isPending && setOpen(v)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This permanently removes your account, sign-in methods, and every organization where
              you are the only member — including all of its projects, features, PRDs, and tasks.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Type <span className="font-medium text-foreground">{email ?? "your email"}</span> to
              confirm.
            </p>
            <Input
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder={email ?? "you@example.com"}
              autoComplete="off"
              disabled={deleteAccount.isPending}
            />
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={deleteAccount.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!emailMatches || deleteAccount.isPending}
              onClick={() => deleteAccount.mutate({ confirmation })}
            >
              {deleteAccount.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete my account"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
