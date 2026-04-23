"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { AdminOrderDetail, AdminQueueItem } from "@littlecolorbook/db";
import { getOfferByCode } from "@littlecolorbook/shared";

const ADMIN_TIME_ZONE = "America/Denver";

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
    timeZone: ADMIN_TIME_ZONE,
  }).format(new Date(value));
}

function formatStatus(value: string) {
  return value.replaceAll("_", " ");
}

function describeNextAction(selectedOrder: AdminOrderDetail) {
  const { order, assets, fulfillment } = selectedOrder;

  if (order.status === "support_required") {
    return "Review the issue, queue a rerender if the art is wrong, then send the customer a status update.";
  }

  if (order.status === "pdf_ready" && order.deliveryMode === "print") {
    return "Confirm the file package is ready, then resubmit the print handoff if Lulu has not picked it up.";
  }

  if (order.status === "pdf_ready") {
    return "Email the customer the PDF-ready update or verify that the download path is staged correctly.";
  }

  if (order.status === "submitted_to_lulu" || order.status === "in_production") {
    return "Monitor fulfillment sync and only intervene if tracking or provider status stalls.";
  }

  switch (order.status) {
    case "paid":
    case "preprocessing":
    case "generating":
    case "qa_review":
    case "assembling_pdf":
    return "Watch generation progress and escalate to support if the order stalls or throws failed pages.";
  }

  if (!assets.downloadPdfPath) {
    return "The deliverable is not staged yet. Inspect generation activity before contacting the customer.";
  }

  if (fulfillment?.trackingNumber) {
    return "The order is already in motion. Use customer comms only if there is a delivery exception.";
  }

  return "Check the latest activity, then use the operator actions on the right to move the order forward.";
}

function buildActivityFeed(selectedOrder: AdminOrderDetail) {
  const items = [
    ...selectedOrder.generationJobs.map((job) => ({
      id: `job-${job.id}`,
      title: `${formatStatus(job.kind)} / ${job.status}`,
      detail: `Target ${job.targetPages}. Approved ${job.approvedPages}. Failed ${job.failedPages}.`,
      timestamp: job.updatedAt,
      kind: "Generation" as const,
    })),
    ...selectedOrder.events.map((event) => ({
      id: `event-${event.id}`,
      title: formatStatus(event.eventType),
      detail: "Lifecycle event recorded on the order timeline.",
      timestamp: event.createdAt,
      kind: "Order" as const,
    })),
    ...selectedOrder.emails.map((email) => ({
      id: `email-${email.id}`,
      title: `${email.template} / ${email.status}`,
      detail: "Lifecycle email activity for this customer.",
      timestamp: email.sentAt ?? email.createdAt,
      kind: "Email" as const,
    })),
    ...selectedOrder.supportActions.map((action) => ({
      id: `support-${action.id}`,
      title: formatStatus(action.actionType),
      detail: action.notes ?? "Support action logged without a note.",
      timestamp: action.createdAt,
      kind: "Support" as const,
    })),
  ];

  return items.sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime()).slice(0, 12);
}

function getQueueTitle(order: AdminQueueItem) {
  const offer = getOfferByCode(order.selectedOfferCode);
  if (order.childFirstName) {
    return `${order.childFirstName}'s ${offer.title}`;
  }
  return offer.title;
}

export function AdminConsole({
  orders,
  selectedOrder,
}: {
  orders: AdminQueueItem[];
  selectedOrder: AdminOrderDetail | null;
}) {
  const router = useRouter();
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [supportReason, setSupportReason] = useState("");
  const [rerenderReason, setRerenderReason] = useState("");
  const [rerenderPage, setRerenderPage] = useState(1);
  const [emailTemplate, setEmailTemplate] = useState<
    "order-paid" | "order-processing" | "pdf-ready" | "print-submitted" | "order-shipped" | "order-delivered"
  >("order-paid");
  const [isPending, startTransition] = useTransition();

  const offer = selectedOrder ? getOfferByCode(selectedOrder.order.selectedOfferCode) : null;
  const activityFeed = useMemo(
    () => (selectedOrder ? buildActivityFeed(selectedOrder) : []),
    [selectedOrder],
  );

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
      <aside className="surface admin-sidebar admin-queue-panel">
        <div className="admin-panel-head">
          <div className="section-copy" style={{ marginBottom: 0 }}>
                    <span className="pill">Orders queue</span>
                    <h2>Recent orders</h2>
                    <p className="lede">
                      Select a live order to inspect production state, support history, and customer communications
                      without leaving the operator surface.
                    </p>
                  </div>
          <span className="mini-note">{orders.length} newest orders</span>
        </div>

        <div className="admin-order-list">
          {orders.map((order) => (
            <Link
              className={`admin-order-row ${selectedOrder?.order.id === order.id ? "is-active" : ""}`}
              href={`/admin?orderId=${order.id}`}
              key={order.id}
            >
              <div className="admin-order-row-copy">
                <strong>{getQueueTitle(order)}</strong>
                <p className="muted">{order.customerEmail ?? "guest checkout"}</p>
                <p className="mini-note">
                  {formatDate(order.createdAt)} / {order.deliveryMode} / {order.designCount} pages
                </p>
              </div>
              <div className="admin-order-meta">
                <span className={`status-pill status-pill-${order.status}`}>{formatStatus(order.status)}</span>
                <span className="muted">{formatMoney(order.totalCents)}</span>
              </div>
            </Link>
          ))}
        </div>
      </aside>

      <section className="admin-main">
        {!selectedOrder ? (
          <div className="surface admin-empty-state">
            <span className="pill">Nothing selected</span>
            <h2>Choose an order from the queue.</h2>
            <p className="muted">
              The console will show production state, customer context, and the right operator controls once an
              order is selected.
            </p>
          </div>
        ) : (
          <>
            <div className="surface admin-order-hero">
              <div className="admin-order-hero-copy">
                <span className="pill">Selected order</span>
                <div className="admin-order-hero-headline">
                  <h1>{offer?.title ?? selectedOrder.order.id}</h1>
                  <span className={`status-pill status-pill-${selectedOrder.order.status}`}>
                    {formatStatus(selectedOrder.order.status)}
                  </span>
                </div>
                <p className="lede">
                  {selectedOrder.customer?.email ?? "guest checkout"} / {selectedOrder.order.deliveryMode} /{" "}
                  {formatMoney(selectedOrder.order.totalCents)}
                </p>
                <p className="admin-order-next-step">
                  <strong>Next step:</strong> {describeNextAction(selectedOrder)}
                </p>
              </div>

              <div className="admin-order-hero-stats">
                <div className="admin-hero-stat">
                  <span className="mini-note">Created</span>
                  <strong>{formatDate(selectedOrder.order.createdAt)}</strong>
                </div>
                <div className="admin-hero-stat">
                  <span className="mini-note">Designs</span>
                  <strong>{selectedOrder.order.designCount}</strong>
                </div>
                <div className="admin-hero-stat">
                  <span className="mini-note">Generated pages</span>
                  <strong>{selectedOrder.assets.generatedPageCount}</strong>
                </div>
                <div className="admin-hero-stat">
                  <span className="mini-note">PDF package</span>
                  <strong>{selectedOrder.assets.downloadPdfPath ? "Ready" : "Pending"}</strong>
                </div>
              </div>
            </div>

            <div className="admin-detail-grid">
              <div className="admin-detail-column">
                <div className="surface admin-section-card">
                  <div className="admin-section-head">
                    <div>
                      <h3>Production snapshot</h3>
                      <p className="muted">What exists, what is missing, and where fulfillment currently stands.</p>
                    </div>
                  </div>

                  <div className="key-value-grid admin-facts-grid">
                    <div>
                      <span className="muted">Delivery mode</span>
                      <strong>{selectedOrder.order.deliveryMode}</strong>
                    </div>
                    <div>
                      <span className="muted">Bundle</span>
                      <strong>{selectedOrder.order.bundleSelection ?? "Single book"}</strong>
                    </div>
                    <div>
                      <span className="muted">Preview assets</span>
                      <strong>{selectedOrder.assets.previewCount}</strong>
                    </div>
                    <div>
                      <span className="muted">Portal</span>
                      <strong>{selectedOrder.portalHref ? "Available" : "Unavailable"}</strong>
                    </div>
                    <div>
                      <span className="muted">Fulfillment</span>
                      <strong>{selectedOrder.fulfillment ? formatStatus(selectedOrder.fulfillment.status) : "Not started"}</strong>
                    </div>
                    <div>
                      <span className="muted">Tracking</span>
                      <strong>{selectedOrder.fulfillment?.trackingNumber ?? "Not yet"}</strong>
                    </div>
                  </div>

                  <div className="timeline-list admin-job-list">
                    {selectedOrder.generationJobs.length > 0 ? (
                      <>
                        {selectedOrder.generationJobs.map((job) => (
                          <div className="timeline-item" key={job.id}>
                            <strong>
                              {formatStatus(job.kind)} / {job.status}
                            </strong>
                            <p className="muted">
                              Target {job.targetPages}. Approved {job.approvedPages}. Failed {job.failedPages}.
                            </p>
                            {job.model ? <p className="mini-note">Model: {job.model}</p> : null}
                          </div>
                        ))}
                        <Link className="button button-secondary admin-job-debug-link" href={`/admin/orders/${selectedOrder.order.id}/generation`}>
                          Open generation debug
                        </Link>
                      </>
                    ) : (
                      <p className="muted">No generation jobs recorded yet.</p>
                    )}
                  </div>
                </div>

                <div className="admin-two-up">
                  <div className="surface admin-section-card">
                    <div className="admin-section-head">
                      <div>
                        <h3>Customer and delivery</h3>
                        <p className="muted">Who this order belongs to and where it ships.</p>
                      </div>
                    </div>

                    <div className="key-value-grid admin-facts-grid">
                      <div>
                        <span className="muted">Customer</span>
                        <strong>{selectedOrder.customer?.email ?? "Guest checkout"}</strong>
                      </div>
                      <div>
                        <span className="muted">Phone</span>
                        <strong>{selectedOrder.customer?.phone ?? "Not provided"}</strong>
                      </div>
                      <div>
                        <span className="muted">Offer</span>
                        <strong>{offer?.title ?? "Custom order"}</strong>
                      </div>
                      <div>
                        <span className="muted">Total</span>
                        <strong>{formatMoney(selectedOrder.order.totalCents)}</strong>
                      </div>
                    </div>

                    {selectedOrder.shippingAddress ? (
                      <address className="admin-address-block">
                        <strong>{selectedOrder.shippingAddress.fullName ?? "Shipping recipient"}</strong>
                        <span>{selectedOrder.shippingAddress.line1}</span>
                        {selectedOrder.shippingAddress.line2 ? (
                          <span>{selectedOrder.shippingAddress.line2}</span>
                        ) : null}
                        <span>
                          {selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state}{" "}
                          {selectedOrder.shippingAddress.postalCode}
                        </span>
                        <span>{selectedOrder.shippingAddress.countryCode}</span>
                      </address>
                    ) : (
                      <p className="muted">No shipping address recorded.</p>
                    )}
                  </div>

                  <div className="surface admin-section-card">
                    <div className="admin-section-head">
                      <div>
                        <h3>Files and portal</h3>
                        <p className="muted">Quick access to what the customer can already see or download.</p>
                      </div>
                    </div>

                    <div className="key-value-grid admin-facts-grid">
                      <div>
                        <span className="muted">Uploads</span>
                        <strong>{selectedOrder.uploads.length}</strong>
                      </div>
                      <div>
                        <span className="muted">Quotes</span>
                        <strong>{selectedOrder.quotes.length}</strong>
                      </div>
                      <div>
                        <span className="muted">Interior PDF</span>
                        <strong>{selectedOrder.assets.interiorPdfPath ? "Staged" : "Missing"}</strong>
                      </div>
                      <div>
                        <span className="muted">Cover PDF</span>
                        <strong>{selectedOrder.assets.coverPdfPath ? "Staged" : "Missing"}</strong>
                      </div>
                    </div>

                    <div className="admin-link-list">
                      <a href={selectedOrder.portalHref} rel="noreferrer" target="_blank">
                        Open customer portal
                      </a>
                      {selectedOrder.fulfillment?.trackingUrl ? (
                        <a href={selectedOrder.fulfillment.trackingUrl} rel="noreferrer" target="_blank">
                          Open tracking link
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="surface admin-section-card">
                  <div className="admin-section-head">
                    <div>
                      <h3>Latest activity</h3>
                      <p className="muted">One combined feed so operators can understand the order without scanning four cards.</p>
                    </div>
                  </div>

                  <div className="timeline-list">
                    {activityFeed.length > 0 ? (
                      activityFeed.map((item) => (
                        <div className="timeline-item admin-activity-item" key={item.id}>
                          <div className="admin-activity-meta">
                            <span className="mini-note">{item.kind}</span>
                            <span className="mini-note">{formatDate(item.timestamp)}</span>
                          </div>
                          <strong>{item.title}</strong>
                          <p className="muted">{item.detail}</p>
                        </div>
                      ))
                    ) : (
                      <p className="muted">No production, support, or email activity recorded yet.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="admin-detail-column admin-action-column">
                <div className="surface admin-action-cluster">
                  <div className="admin-section-head">
                    <div>
                      <h3>Support and rerenders</h3>
                      <p className="muted">Escalate broken orders and send corrected pages back through the queue.</p>
                    </div>
                  </div>

                  <div className="action-panel">
                    <div className="field-head">
                      <span className="field-label">Support reason</span>
                      <span className="field-note">Required before marking the order for manual review.</span>
                    </div>
                    <textarea
                      className="text-input textarea-input"
                      onChange={(event) => setSupportReason(event.target.value)}
                      placeholder="Explain what needs human attention."
                      value={supportReason}
                    />
                    <button
                      className="button button-primary"
                      disabled={isPending || supportReason.trim().length === 0}
                      onClick={() =>
                        handleAction(() =>
                          postAction(`/api/admin/orders/${selectedOrder.order.id}/support`, {
                            reason: supportReason,
                          }),
                        )
                      }
                      type="button"
                    >
                      Mark for support
                    </button>
                  </div>

                  <div className="action-panel">
                    <div className="field-head">
                      <span className="field-label">Queue page rerender</span>
                      <span className="field-note">Use this when one page needs a new generation pass.</span>
                    </div>
                    <input
                      className="text-input"
                      min={1}
                      onChange={(event) => setRerenderPage(Number(event.target.value) || 1)}
                      type="number"
                      value={rerenderPage}
                    />
                    <textarea
                      className="text-input textarea-input"
                      onChange={(event) => setRerenderReason(event.target.value)}
                      placeholder="Optional note for the generation queue."
                      value={rerenderReason}
                    />
                    <button
                      className="button button-secondary"
                      disabled={isPending}
                      onClick={() =>
                        handleAction(() =>
                          postAction(`/api/admin/orders/${selectedOrder.order.id}/rerender-page`, {
                            pageNumber: rerenderPage,
                            reason: rerenderReason || undefined,
                          }),
                        )
                      }
                      type="button"
                    >
                      Queue rerender
                    </button>
                  </div>
                </div>

                <div className="surface admin-action-cluster">
                  <div className="admin-section-head">
                    <div>
                      <h3>Customer communication</h3>
                      <p className="muted">Force-send lifecycle updates without leaving the operator flow.</p>
                    </div>
                  </div>

                  <div className="action-panel">
                    <div className="field-head">
                      <span className="field-label">Lifecycle email</span>
                      <span className="field-note">Choose the exact milestone you want the customer to receive.</span>
                    </div>
                    <select
                      className="text-input"
                      onChange={(event) => setEmailTemplate(event.target.value as typeof emailTemplate)}
                      value={emailTemplate}
                    >
                      <option value="order-paid">Order confirmed / upload photos</option>
                      <option value="order-processing">Order processing</option>
                      <option value="pdf-ready">PDF ready</option>
                      <option value="print-submitted">Print submitted</option>
                      <option value="order-shipped">Order shipped</option>
                      <option value="order-delivered">Order delivered</option>
                    </select>
                    <button
                      className="button button-secondary"
                      disabled={isPending}
                      onClick={() =>
                        handleAction(() =>
                          postAction(`/api/admin/orders/${selectedOrder.order.id}/send-email`, {
                            template: emailTemplate,
                            force: true,
                          }),
                        )
                      }
                      type="button"
                    >
                      Send lifecycle email
                    </button>
                  </div>
                </div>

                <div className="surface admin-action-cluster">
                  <div className="admin-section-head">
                    <div>
                      <h3>Print fulfillment</h3>
                      <p className="muted">For print orders only. Use after files or shipping details have been corrected.</p>
                    </div>
                  </div>

                  <div className="action-panel">
                    <div className="admin-inline-note">
                      <span className="mini-note">Current provider status</span>
                      <strong>
                        {selectedOrder.fulfillment ? formatStatus(selectedOrder.fulfillment.status) : "No print job"}
                      </strong>
                    </div>
                    <button
                      className="button button-secondary"
                      disabled={isPending || selectedOrder.order.deliveryMode !== "print"}
                      onClick={() =>
                        handleAction(() =>
                          postAction(`/api/admin/orders/${selectedOrder.order.id}/resubmit-lulu`, {}),
                        )
                      }
                      type="button"
                    >
                      Requeue print submission
                    </button>
                    {selectedOrder.order.deliveryMode !== "print" ? (
                      <p className="field-note">This order is digital-only, so print controls are disabled.</p>
                    ) : null}
                  </div>
                </div>

                {resultMessage ? <pre className="surface admin-result admin-result-live">{resultMessage}</pre> : null}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
