"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { signInWithEmail } from "../actions";

function SubmitButton({ disabled }: Readonly<{ disabled: boolean }>) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="lg"
      variant="secondary"
      disabled={pending || disabled}
      className="w-full"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : null}
      {pending ? "Signing in…" : "Sign in with Email"}
    </Button>
  );
}

export function EmailSignInForm({ callbackUrl }: Readonly<{ callbackUrl?: string }>) {
  const formRef = useRef<HTMLFormElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="grid gap-4">
      <form ref={formRef} action={signInWithEmail} className="grid gap-3">
        {callbackUrl && (
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
        )}

        <div className="grid gap-1.5">
          <Label htmlFor="email" className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Email
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="password" className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Password
          </Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="pr-9"
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
        </div>

        <SubmitButton disabled={!email || !password} />
      </form>
    </div>
  );
}
