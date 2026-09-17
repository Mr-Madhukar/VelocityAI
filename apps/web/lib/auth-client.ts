"use client";

import { createAuthClient } from "better-auth/react";
import { deviceAuthorizationClient, organizationClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [organizationClient(), deviceAuthorizationClient()],
});
