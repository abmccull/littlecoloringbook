import Link from "next/link";
import { listOrdersForCustomer } from "@littlecolorbook/db";
import { getOfferByCode } from "@littlecolorbook/shared";
import { getCustomerSession } from "../../../lib/auth";
import { OrderCard } from "../../../components/account/order-card";

export const dynamic = "force-dynamic";

export default async function AccountOrdersPage() {
  const session = await getCustomerSession();

  if (!session) {
    return null;
  }

  const orders = await listOrdersForCustomer(session.customerId, 50);

  return (
    <section className="account-section">
      <div className="portal-card">
        <span className="pill">Orders</span>
        <h1>Your Little Color Book orders.</h1>
        <p className="muted">
          Every order you've placed under {session.email}. Tap any card for the full status, PDF download, and the
          "get help" button if something isn't right.
        </p>
      </div>

      {orders.length > 0 ? (
        <div className="account-order-list">
          {orders.map((order) => {
            const offer = getOfferByCode(order.selectedOfferCode);
            return <OrderCard key={order.id} order={order} offerTitle={offer.title} />;
          })}
        </div>
      ) : (
        <div className="portal-card">
          <p className="muted">You haven't placed any paid orders yet.</p>
          <Link className="button button-primary" href="/create">
            Build my first book
          </Link>
        </div>
      )}
    </section>
  );
}
