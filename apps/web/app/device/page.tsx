import { redirect } from "next/navigation";

import { getServerSession } from "@/features/auth/session";
import { SIGN_IN_PATH } from "@/features/auth/utils";

import { DeviceApproval } from "./device-approval";

// Device Authorization approval screen (RFC 8628). The CLI opens the browser
// here (verification_uri_complete carries `?user_code=…`). A signed-in user
// confirms the code to grant the terminal a session.
export default async function DevicePage({
  searchParams,
}: {
  searchParams: Promise<{ user_code?: string }>;
}) {
  const { user_code: userCode } = await searchParams;
  const session = await getServerSession();

  if (!session) {
    const callback = userCode
      ? `/device?user_code=${encodeURIComponent(userCode)}`
      : "/device";
    redirect(`${SIGN_IN_PATH}?callbackUrl=${encodeURIComponent(callback)}`);
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4">
      <DeviceApproval
        initialUserCode={userCode ?? ""}
        userEmail={session.user.email ?? null}
      />
    </main>
  );
}
