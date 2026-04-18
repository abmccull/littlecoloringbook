import Link from "next/link";
import { listAdminRefundQueue } from "@littlecolorbook/db";
import { requireAdminSession } from "../../../lib/auth";

export const dynamic = "force-dynamic";

function formatDateTime(d: Date | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export default async function AdminRefundsPage() {
  await requireAdminSession();
  const queue = await listAdminRefundQueue(50);

  return (
    <main className="admin-main" style={{ padding: "24px" }}>
      <p>
        <Link href="/admin">← admin home</Link>
      </p>
      <h1>Refund queue</h1>
      <p className="muted">
        {queue.length} pending. Sorted oldest first. Auto-approved refunds may also appear here in the "processing"
        state.
      </p>

      {queue.length === 0 ? (
        <p className="muted">Nothing pending. Good.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "16px" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid var(--line)" }}>
              <th style={{ padding: "8px 12px" }}>Status</th>
              <th style={{ padding: "8px 12px" }}>Order</th>
              <th style={{ padding: "8px 12px" }}>Reason</th>
              <th style={{ padding: "8px 12px" }}>Policy tier</th>
              <th style={{ padding: "8px 12px" }}>Amount</th>
              <th style={{ padding: "8px 12px" }}>Requested</th>
              <th style={{ padding: "8px 12px" }}></th>
            </tr>
          </thead>
          <tbody>
            {queue.map((r) => (
              <tr key={r.id} style={{ borderBottom: "1px solid var(--line)" }}>
                <td style={{ padding: "8px 12px" }}>
                  <span className={`status-pill status-pill-${r.status}`}>{r.status}</span>
                </td>
                <td style={{ padding: "8px 12px", fontSize: "0.85rem" }}>
                  <Link href={`/admin?orderId=${r.orderId}`}>{r.orderId.slice(0, 16)}…</Link>
                </td>
                <td style={{ padding: "8px 12px", fontSize: "0.85rem" }}>{r.reason.replace(/_/g, " ")}</td>
                <td style={{ padding: "8px 12px", fontSize: "0.85rem" }}>{r.policyTier.replace(/_/g, " ")}</td>
                <td style={{ padding: "8px 12px" }}>{formatMoney(r.amountCents)}</td>
                <td style={{ padding: "8px 12px", fontSize: "0.85rem" }}>{formatDateTime(r.createdAt)}</td>
                <td style={{ padding: "8px 12px" }}>
                  {r.ticketId ? <Link href={`/admin/tickets/${r.ticketId}`}>Open ticket →</Link> : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
