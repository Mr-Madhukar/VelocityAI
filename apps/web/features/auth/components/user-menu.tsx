"use client";

import { LogOut, User, UserRound } from "lucide-react";
import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";

import { SIGN_IN_PATH } from "../utils";

export type UserMenuUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

export function getDisplayName(user: UserMenuUser) {
  return user.name?.trim() || user.email?.split("@")[0] || "VelocityAI user";
}

export function getInitials(user: UserMenuUser) {
  const source = user.name?.trim() || user.email || "SU";
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

export function UserMenu({
  user,
  plan = "Free",
}: {
  user: UserMenuUser;
  plan?: string;
}) {
  const displayName = getDisplayName(user);

  async function handleSignOut() {
    try {
      await authClient.signOut();
    } finally {
      // Hard navigation so the router cache + cached RSC payloads are cleared —
      // combined with no-store on protected routes this stops the back button
      // from restoring the authenticated UI after sign-out. In `finally` so the
      // user is redirected even if the sign-out request fails.
      window.location.href = SIGN_IN_PATH;
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-10 justify-start gap-2 px-2">
          <Avatar className="size-7">
            {user.image ? (
              <AvatarImage src={user.image} alt={displayName} />
            ) : null}
            <AvatarFallback>{getInitials(user)}</AvatarFallback>
          </Avatar>
          <span className="max-w-32 truncate text-sm">{displayName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex items-start gap-2">
          <UserRound className="mt-0.5 size-4 text-muted-foreground" />
          <span className="min-w-0">
            <span className="block truncate text-sm">{displayName}</span>
            {user.email ? (
              <span className="block truncate text-xs text-muted-foreground">
                {user.email}
              </span>
            ) : null}
            <Badge variant="secondary" className="mt-2">
              {plan} plan
            </Badge>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <User className="size-4" />
            My profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
          <LogOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function UserMenuWithSession() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending || !session?.user) {
    return null;
  }

  return <UserMenu user={session.user} />;
}
