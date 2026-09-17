import { getServerSession } from "@/features/auth/session";
import { redirect } from "next/navigation";
import { LandingPage } from "./_components/landing-page";

export default async function Home() {
  const session = await getServerSession();
  if (session) redirect("/projects");

  return <LandingPage />;
}
