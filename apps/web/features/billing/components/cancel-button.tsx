"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";

import { cancelCheckoutSubscription } from "../server/subscription";

export function CancelButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await cancelCheckoutSubscription();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Subscription cancelled — you keep access until the end of the current period.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          className="text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-destructive hover:underline"
        >
          Cancel subscription
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel your subscription?</AlertDialogTitle>
          <AlertDialogDescription>
            Your plan stays active until the end of the current billing period, then it
            downgrades to Free. You won&apos;t be charged again.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep plan</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              confirm();
            }}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? "Cancelling…" : "Cancel subscription"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
