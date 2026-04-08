"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { AdminOrderDetail, AdminQueueItem } from "@littlecolorbook/db";
import { getOfferByCode } from "@littlecolorbook/shared";

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function AdminConsole({
  orders,
  selectedOrder,
  sessionEmail,
}: {
  orders: AdminQueueItem[];
  selectedOrder: AdminOrderDetail | null;
  sessionEmail: string | null;
}) {
  const router = useRouter();
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [supportReason, setSupportReason] = useState("");
  const [rerenderReason, setRerenderReason] = useState("");
  const [rerenderPage, setRerenderPage] = useState(1);
  const [emailTemplate, setEmailTemplate] = useState<
    "order-paid" | "pdf-ready" | "print-submitted" | "order-shipped" | "order-delivered"
  >("order-paid");
  const [isPending, startTransition] = useTransition();

  const offer = selectedOrder ? getOfferByCode(selectedOrder.order.selectedOfferCode) : null;

  async function postAction(path: string, body: Record<string, unknown>) {
    setResultMessage(null);
    const response = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error ?? "Request failed");
    }

    return data;
  }

  function handleAction(action: () => Promise<Record<string, unknown>>) {
    startTransition(async () => {
      try {
        const data = await action();
        setResultMessage(JSON.stringify(data, null, 2));
        router.refresh();
      } catch (error) {
        setResultMessage(error instanceof Error ? error.message : "Action failed");
      }
    });
  }

  return (
    <div className="admin-layout">
      <aside className="surface admin-sidebar">
        <div className="section-copy" style={{ marginBottom: 0 }}>
          <span className="pill">Operations</span>
          <h2>Recent orders</h2>
          <p className="lede">Signed in as {sessionEmail ?? "admin"}. Use this queue for support, rerenders, and manual lifecycle actions.</p>
        </div>
        <div className="admin-order-list">
          {orders.map((order) => {
            const orderOffer = getOfferByCode(order.selectedOfferCode);
            return (
              <Link className={`admin-order-row ${selectedOrder?.order.id === order.id ? "is-active" : ""}`} href={`/admin?orderId=${order.id}`} key={order.id}>
                <div>
                  <strong>{orderOffer.title}</strong>
                  <p className="muted">{order.customerEmail ?? "guest"}</p>
                </div>
                <div className="admin-order-meta">
                  <span className={`status-pill status-pill-${order.status}`}>{order.status.replaceAll("_", " ")}</span>
                  <span className="muted">{formatMoney(order.totalCents)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </aside>

      <section className="admin-main">
        {!selectedOrder ? (
          <div className="surface">
            <h2>No orders yet</h2>
            <p className="muted">Once orders are created, they will appear here.</p>
          </div>
        ) : (
          <>
            <div className="surface admin-overview">
              <span className="pill">Selected order</span>
              <h1>{offer?.title ?? selectedOrder.order.id}</h1>
              <p className="lede">
                {selectedOrder.customer?.email ?? "guest checkout"} · {selectedOrder.order.designCount} designs · {formatMoney(selectedOrder.order.totalCents)}
              </p>
              <div className="key-value-grid">
                <div>
                  <span className="muted">Status</span>
                  <strong>{selectedOrder.order.status.replaceAll("_", " ")}</strong>
                </div>
                <div>
                  <span className="muted">Created</span>
                  <strong>{formatDate(selectedOrder.order.createdAt)}</strong>
                </div>
                <div>
                  <span className="muted">Delivery</span>
                  <strong>{selectedOrder.order.deliveryMode}</strong>
                </div>
                <div>
                  <span className="muted">PDF asset</span>
                  <strong>{selectedOrder.assets.downloadPdfPath ? "Ready path seeded" : "Not yet staged"}</strong>
                </div>
              </div>
            </div>

            <div className="admin-grid">
              <div className="surface">
                <h3>Generation jobs</h3>
                <div className="timeline-list">
                  {selectedOrder.generationJobs.length > 0 ? (
                    selectedOrder.generationJobs.map((job) => (
                      <div className="timeline-item" key={job.id}>
                        <strong>{job.kind.replaceAll("_", " ")} · {job.status}</strong>
                        <p className="muted">
                          target {job.targetPages} · approved {job.approvedPages} · failed {job.failedPages}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="muted">No generation jobs recorded yet.</p>
                  )}
                </div>
              </div>

              <div className="surface">
                <h3>Timeline</h3>
                <div className="timeline-list">
                  {selectedOrder.events.length > 0 ? (
                    selectedOrder.events.map((event) => (
                      <div className="timeline-item" key={event.id}>
                        <strong>{event.eventType}</strong>
                        <p className="muted">{formatDate(event.createdAt)}</p>
                      </div>
                    ))
                  ) : (
                    <p className="muted">No order events recorded yet.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="admin-grid">
              <div className="surface action-panel">
                <h3>Mark support required</h3>
                <textarea className="text-input textarea-input" value={supportReason} onChange={(event) => setSupportReason(event.target.value)} placeholder="Explain what needs manual review." />
                <button className="button button-primary" disabled={isPending || supportReason.trim().length === 0} onClick={() => handleAction(() => postAction(`/api/admin/orders/${selectedOrder.order.id}/support`, { reason: supportReason }))} type="button">
                  Mark for support
                </button>
              </div>

              <div className="surface action-panel">
                <h3>Request page rerender</h3>
                <input className="text-input" min={1} onChange={(event) => setRerenderPage(Number(event.target.value) || 1)} type="number" value={rerenderPage} />
                <textarea className="text-input textarea-input" value={rerenderReason} onChange={(event) => setRerenderReason(event.target.value)} placeholder="Optional note for the rerender queue." />
                <button className="button button-secondary" disabled={isPending} onClick={() => handleAction(() => postAction(`/api/admin/orders/${selectedOrder.order.id}/rerender-page`, { pageNumber: rerenderPage, reason: rerenderReason || undefined }))} type="button">
                  Queue rerender
                </button>
              </div>

              <div className="surface action-panel">
                <h3>Send lifecycle email</h3>
                <select className="text-input" onChange={(event) => setEmailTemplate(event.target.value as typeof emailTemplate)} value={emailTemplate}>
                  <option value="order-paid">Order paid</option>
                  <option value="pdf-ready">PDF ready</option>
                  <option value="print-submitted">Print submitted</option>
                  <option value="order-shipped">Order shipped</option>
                  <option value="order-delivered">Order delivered</option>
                </select>
                <button className="button button-secondary" disabled={isPending} onClick={() => handleAction(() => postAction(`/api/admin/orders/${selectedOrder.order.id}/send-email`, { template: emailTemplate, force: true }))} type="button">
                  Send email now
                </button>
              </div>

              <div className="surface action-panel">
                <h3>Resubmit Lulu</h3>
                <p className="muted">Use this after correcting files or shipping details on a print order.</p>
                <button className="button button-secondary" disabled={isPending || selectedOrder.order.deliveryMode !== "print"} onClick={() => handleAction(() => postAction(`/api/admin/orders/${selectedOrder.order.id}/resubmit-lulu`, {}))} type="button">
                  Requeue print submission
                </button>
              </div>
            </div>

            <div className="admin-grid">
              <div className="surface">
                <h3>Recent lifecycle emails</h3>
                <div className="timeline-list">
                  {selectedOrder.emails.length > 0 ? (
                    selectedOrder.emails.map((email) => (
                      <div className="timeline-item" key={email.id}>
                        <strong>{email.template}</strong>
                        <p className="muted">{email.status} · {formatDate(email.createdAt)}</p>
                      </div>
                    ))
                  ) : (
                    <p className="muted">No lifecycle emails recorded yet.</p>
                  )}
                </div>
              </div>

              <div className="surface">
                <h3>Support actions</h3>
                <div className="timeline-list">
                  {selectedOrder.supportActions.length > 0 ? (
                    selectedOrder.supportActions.map((action) => (
                      <div className="timeline-item" key={action.id}>
                        <strong>{action.actionType.replaceAll("_", " ")}</strong>
                        <p className="muted">{action.notes ?? "No note"}</p>
                      </div>
                    ))
                  ) : (
                    <p className="muted">No support actions recorded yet.</p>
                  )}
                </div>
              </div>
            </div>

            {resultMessage ? (
              <pre className="surface admin-result">{resultMessage}</pre>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
