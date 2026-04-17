import Link from "next/link";
import { listOrdersForCustomer } from "@littlecolorbook/db";
import { getOfferByCode } from "@littlecolorbook/shared";
import { getCustomerSession } from "../../lib/auth";
import { OrderCard } from "../../components/account/order-card";

export const dynamic = "force-dynamic";

export default async function AccountDashboardPage() {
  const session = await getCustomerSession();

  if (!session) {
    return null;
  }

  const orders = await listOrdersForCustomer(session.customerId, 5);
  const hasOrders = orders.length > 0;

  return (
    <section className="account-section">
      <div className="portal-card">
        <span className="pill">Welcome back</span>
        <h1>Hi {session.displayName ?? "there"}.</h1>
        <p className="muted">
          Everything you need for your books lives here: download PDFs, check shipping, and reach support if anything
          needs a second look. Old magic-link emails still work too.
        </p>
        <div className="account-cta-row">
          <Link className="button button-primary" href="/account/orders">
            View all orders
          </Link>
          <Link className="button button-secondary" href="/create">
            Start a new book
          </Link>
        </div>
      </div>

      <section className="account-section">
        <h2>Recent orders</h2>
        {hasOrders ? (
          <div className="account-order-list">
            {orders.map((order) => {
              const offer = getOfferByCode(order.selectedOfferCode);
              return <OrderCard key={order.id} order={order} offerTitle={offer.title} />;
            })}
          </div>
        ) : (
          <div className="portal-card">
            <p className="muted">No orders yet. Your first book will show up here the moment checkout finishes.</p>
            <Link className="button button-primary" href="/create">
              Build my first book
            </Link>
          </div>
        )}
      </section>
    </section>
  );
}
