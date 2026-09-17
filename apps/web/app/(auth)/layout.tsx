import { requireUnauth } from "@/features/auth/session";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUnauth();

  return children;
}
