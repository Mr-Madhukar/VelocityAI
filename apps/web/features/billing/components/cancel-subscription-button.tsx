"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { cancelCheckoutSubscription } from "../server/subscription";

export function CancelSubscriptionButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          const result = await cancelCheckoutSubscription();

          if (!result.ok) {
            toast.error(result.error);
            return;
          }

          toast.success("Subscription cancellation requested.");
        });
      }}
    >
      {isPending ? "Checking subscription..." : "Cancel subscription"}
    </Button>
  );
}
