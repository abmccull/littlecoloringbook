import { getAdminOrderDetail, listAdminOrders } from "@littlecolorbook/db";
import { AdminConsole } from "../../components/admin-console";
import { requireAdminSession } from "../../lib/auth";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
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
