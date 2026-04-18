import { requireAdminSession } from "../../../lib/auth";
import { AdminNav } from "../../../components/admin/admin-nav";
import { GrowthNav } from "../../../components/admin/growth-nav";

export default async function GrowthLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdminSession();

  return (
    <main>
      <AdminNav sessionEmail={session.email} />
      <GrowthNav />
      {children}
    </main>
  );
}
