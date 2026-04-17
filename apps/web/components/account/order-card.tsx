import Link from "next/link";
import type { AdminQueueItem } from "@littlecolorbook/db";

function formatMoney(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(value);
}

function formatStatusLabel(status: string) {
  return status.replace(/_/g, " ");
}

export function OrderCard({ order, offerTitle }: { order: AdminQueueItem; offerTitle: string }) {
  return (
    <Link className="account-order-card" href={`/account/orders/${order.id}`}>
      <div className="account-order-card-head">
        <span className={`status-pill status-pill-${order.status}`}>{formatStatusLabel(order.status)}</span>
        <span className="muted mini-note">{formatDate(order.createdAt)}</span>
      </div>
      <h3>{offerTitle}</h3>
      <p className="muted">
        {order.designCount} designs · {formatMoney(order.totalCents)}
      </p>
      {order.childFirstName ? <p className="mini-note">For {order.childFirstName}</p> : null}
      <p className="account-order-card-cta">View order →</p>
    </Link>
  );
}
