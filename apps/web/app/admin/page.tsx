import { getAdminOrderDetail, listAdminOrders } from "@littlecolorbook/db";
import { notFound } from "next/navigation";
import { getIntegrationStatus } from "@littlecolorbook/shared/env";
import { AdminConsole } from "../../components/admin-console";
import { requireAdminSession, isClerkConfigured } from "../../lib/auth";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const integrations = getIntegrationStatus();

  if (!isClerkConfigured()) {
    if (process.env.NODE_ENV === "production") {
      notFound();
    }

    return (
      <main className="form-shell">
        <div className="form-card">
          <span className="pill">Admin</span>
          <h1>Admin auth is not configured yet.</h1>
          <p className="muted">
            Add Clerk keys and an optional <code>CLERK_ADMIN_EMAILS</code> allowlist before using the admin area.
          </p>
          <pre className="surface" style={{ overflowX: "auto" }}>
            {JSON.stringify(integrations, null, 2)}
          </pre>
        </div>
      </main>
    );
  }

  const session = await requireAdminSession();
  const { orderId } = await searchParams;
  const orders = await listAdminOrders(25);
  const selectedOrderId = orderId ?? orders[0]?.id ?? null;
  const selectedOrder = selectedOrderId ? await getAdminOrderDetail(selectedOrderId) : null;

  return (
    <main>
      <AdminConsole orders={orders} selectedOrder={selectedOrder} sessionEmail={session.email} />
    </main>
  );
}
