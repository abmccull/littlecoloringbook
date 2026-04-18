import Link from "next/link";
import { notFound } from "next/navigation";
import { getBroadcastById } from "@littlecolorbook/db";
import { requireAdminSession } from "../../../../lib/auth";
import { BroadcastActions } from "../../../../components/admin/broadcast-actions";

export const dynamic = "force-dynamic";

export default async function AdminBroadcastDetailPage({
  params,
}: {
  params: Promise<{ broadcastId: string }>;
}) {
  await requireAdminSession();
  const { broadcastId } = await params;
  const broadcast = await getBroadcastById(broadcastId);
  if (!broadcast) notFound();

  const selection = broadcast.selection as Record<string, unknown> | null;
  const payload = broadcast.payload as Record<string, unknown> | null;

  return (
    <main className="admin-main" style={{ padding: "24px" }}>
      <p>
        <Link href="/admin/broadcasts">← back to broadcasts</Link>
      </p>
      <h1>{broadcast.subject ?? broadcast.archetype}</h1>
      <p className="muted">
        <span className={`status-pill status-pill-${broadcast.status}`}>{broadcast.status}</span>
        {" · "}
        {broadcast.archetype.replace(/_/g, " ")}
        {" · "}
        scheduled {broadcast.scheduledFor?.toISOString() ?? "(not set)"}
      </p>

      <section className="surface" style={{ margin: "24px 0" }}>
        <h3>Preview</h3>
        <p>
          <strong>Subject:</strong> {broadcast.subject ?? "—"}
        </p>
        <p>
          <strong>Preheader:</strong> {broadcast.preheader ?? "—"}
        </p>
        <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.8rem", background: "#f8f1e6", padding: "12px", borderRadius: "8px" }}>
          {JSON.stringify(payload, null, 2)}
        </pre>
      </section>

      <section className="surface" style={{ margin: "24px 0" }}>
        <h3>Selection</h3>
        <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.8rem", background: "#f8f1e6", padding: "12px", borderRadius: "8px" }}>
          {JSON.stringify(selection, null, 2)}
        </pre>
      </section>

      <BroadcastActions
        broadcastId={broadcast.id}
        status={broadcast.status}
        resendBroadcastId={broadcast.resendBroadcastId}
      />
    </main>
  );
}
