import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/getAdminSession";

export default async function BarbersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();

  if (session?.role !== "owner") {
    redirect("/admin/dashboard");
  }

  return <>{children}</>;
}