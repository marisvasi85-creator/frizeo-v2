import { redirect } from "next/navigation";
import { getCurrentRole } from "@/lib/auth/getCurrentRole";

export default async function BarbersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const role = await getCurrentRole();

  if (role !== "owner") {
    redirect("/admin/dashboard");
  }

  return <>{children}</>;
}