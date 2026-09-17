"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Phase = "idle" | "working" | "approved" | "denied" | "error";

// Approve/deny a device code from the browser. Talks to BetterAuth's
// device-authorization REST endpoints directly (cookie session sent along).
export function DeviceApproval({
  initialUserCode,
  userEmail,
}: {
  initialUserCode: string;
  userEmail: string | null;
}) {
  const [code, setCode] = useState(initialUserCode.toUpperCase());
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function submit(action: "approve" | "deny") {
    const userCode = code.trim().toUpperCase();
    if (!userCode) {
      setPhase("error");
      setMessage("Enter the code shown in your terminal.");
      return;
    }

    setPhase("working");
    setMessage(null);
    try {
      // BetterAuth requires a "verifying session" to claim the code first: GET
      // /device?user_code=… attaches this signed-in user to the pending row.
      // Without it, approve/deny fail with "device code has not been claimed".
      const claim = await fetch(
        `/api/auth/device?user_code=${encodeURIComponent(userCode)}`,
        { credentials: "include" },
      );
      if (!claim.ok) {
        setPhase("error");
        setMessage("That code is invalid or has expired. Start a new login from the CLI.");
        return;
      }

      const res = await fetch(`/api/auth/device/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userCode }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error_description?: string; message?: string }
          | null;
        setPhase("error");
        setMessage(
          data?.error_description ??
            data?.message ??
            "That code is invalid or has expired. Start a new login from the CLI.",
        );
        return;
      }

      setPhase(action === "approve" ? "approved" : "denied");
    } catch {
      setPhase("error");
      setMessage("Network error — please try again.");
    }
  }

  if (phase === "approved") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Terminal connected ✅</CardTitle>
          <CardDescription>
            You can close this tab and return to your terminal — the VelocityAI CLI is now
            signed in{userEmail ? ` as ${userEmail}` : ""}.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (phase === "denied") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Request denied</CardTitle>
          <CardDescription>
            The terminal login request was rejected. Nothing was granted.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Connect your terminal</CardTitle>
        <CardDescription>
          The VelocityAI CLI is requesting access{userEmail ? ` to your account (${userEmail})` : ""}.
          Confirm the code shown in your terminal to continue.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Label htmlFor="user-code">Device code</Label>
        <Input
          id="user-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="XXXX-XXXX"
          autoComplete="off"
          autoCapitalize="characters"
          className="text-center text-lg tracking-[0.3em] font-mono"
        />
        {message ? <p className="text-sm text-destructive">{message}</p> : null}
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button
          type="button"
          className="flex-1"
          onClick={() => submit("approve")}
          disabled={phase === "working"}
        >
          {phase === "working" ? "Connecting…" : "Approve"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => submit("deny")}
          disabled={phase === "working"}
        >
          Deny
        </Button>
      </CardFooter>
    </Card>
  );
}
