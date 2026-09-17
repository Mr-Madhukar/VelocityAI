"use client";

import Script from "next/script";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { cn } from "~/lib/utils";

import { createCheckoutSubscription } from "../server/subscription";

type RazorpayCheckout = {
  open: () => void;
};

type RazorpayOptions = {
  key: string;
  subscription_id: string;
  name: string;
  description: string;
  theme?: { color?: string };
  handler?: () => void;
  modal?: { ondismiss?: () => void };
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayCheckout;
  }
}

export function UpgradeButton({
  plan,
  label,
  highlight,
}: {
  plan: "pro" | "scale";
  label: string;
  highlight?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [scriptReady, setScriptReady] = useState(false);

  function launch() {
    startTransition(async () => {
      const result = await createCheckoutSubscription(plan);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      if (!scriptReady || !window.Razorpay) {
        toast.message("Checkout is still loading — please try again in a moment.");
        return;
      }

      const checkout = new window.Razorpay({
        key: result.keyId,
        subscription_id: result.subscriptionId,
        name: "VelocityAI",
        description: `${label} plan subscription`,
        theme: { color: "#22d3ee" },
        handler: () => {
          toast.success("Payment received — your plan will update shortly.");
        },
        modal: {
          ondismiss: () => toast.message("Checkout closed."),
        },
      });

      checkout.open();
    });
  }

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
        onReady={() => setScriptReady(true)}
      />
      <button
        type="button"
        disabled={isPending}
        onClick={launch}
        className={cn(
          "w-full rounded-md py-2 text-sm font-semibold transition disabled:opacity-50",
          highlight
            ? "bg-primary text-primary-foreground hover:bg-primary"
            : "border border-foreground/10 text-foreground/80 hover:border-foreground/20",
        )}
      >
        {isPending ? "Preparing checkout…" : `Upgrade to ${label}`}
      </button>
    </>
  );
}
