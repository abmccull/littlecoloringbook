import { listAdSpendEntries } from "@littlecolorbook/db";
import { AdminNav } from "../../../components/admin/admin-nav";
import { AdSpendForm } from "../../../components/admin/ad-spend-form";
import { requireAdminSession } from "../../../lib/auth";

export const dynamic = "force-dynamic";

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export default async function AdSpendPage() {
  const session = await requireAdminSession();
  const entries = await listAdSpendEntries({ limit: 50 });

  return (
    <main>
      <AdminNav sessionEmail={session.email} />
      <section style={{ padding: "24px", display: "grid", gap: "20px", maxWidth: "920px", margin: "0 auto" }}>
        <h1>Ad spend</h1>
        <p className="muted">
          Log ad spend per day, per platform. CAC and cost-per-sample on the metrics dashboard use this table.
        </p>

        <div className="surface">
          <h3>Add entry</h3>
          <AdSpendForm />
        </div>

        <h2>Recent entries</h2>
        {entries.length === 0 ? (
          <p className="muted">No entries yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "2px solid var(--line)" }}>
                <th style={{ padding: "8px 12px" }}>Date</th>
                <th style={{ padding: "8px 12px" }}>Platform</th>
                <th style={{ padding: "8px 12px" }}>Campaign</th>
                <th style={{ padding: "8px 12px" }}>Amount</th>
                <th style={{ padding: "8px 12px" }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "8px 12px" }}>{e.spendDate}</td>
                  <td style={{ padding: "8px 12px" }}>{e.platform}</td>
                  <td style={{ padding: "8px 12px" }}>{e.campaign ?? "—"}</td>
                  <td style={{ padding: "8px 12px" }}>{formatMoney(e.amountCents)}</td>
                  <td style={{ padding: "8px 12px", fontSize: "0.85rem" }}>{e.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
