import { getAdSpendBreakdownInWindow, listAdSpendEntries } from "@littlecolorbook/db";
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
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - 30);
  const spend = await getAdSpendBreakdownInWindow({ start, end });

  return (
    <main>
      <AdminNav sessionEmail={session.email} />
      <section style={{ padding: "24px", display: "grid", gap: "20px", maxWidth: "920px", margin: "0 auto" }}>
        <h1>Ad spend</h1>
        <p className="muted">
          Meta spend sync powers CAC and cost-per-sample automatically. Use this page for non-Meta spend, manual
          corrections, or temporary Meta fallback entries when sync data is missing.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px" }}>
          <div className="surface" style={{ display: "grid", gap: "6px" }}>
            <span className="mini-note">Meta synced (30d)</span>
            <strong style={{ fontSize: "1.35rem" }}>{formatMoney(spend.meta_synced_cents)}</strong>
            <span className="mini-note">
              {spend.meta_source_level ? `Source: ${spend.meta_source_level} daily metrics` : "No synced Meta spend in window"}
            </span>
          </div>
          <div className="surface" style={{ display: "grid", gap: "6px" }}>
            <span className="mini-note">Manual adjustments (30d)</span>
            <strong style={{ fontSize: "1.35rem" }}>{formatMoney(spend.manual_cents)}</strong>
            <span className="mini-note">
              {spend.manual_meta_fallback_cents > 0
                ? `Includes ${formatMoney(spend.manual_meta_fallback_cents)} manual Meta fallback`
                : "Non-Meta spend and operator corrections"}
            </span>
          </div>
          <div className="surface" style={{ display: "grid", gap: "6px" }}>
            <span className="mini-note">Reporting total (30d)</span>
            <strong style={{ fontSize: "1.35rem" }}>{formatMoney(spend.total_cents)}</strong>
            <span className="mini-note">This is the spend source used by the metrics dashboard.</span>
          </div>
        </div>

        <div className="surface">
          <h3>Add manual entry</h3>
          <AdSpendForm />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>Recent manual entries</h2>
          <a href="/api/admin/ad-spend/export" style={{ fontSize: "0.9rem" }}>
            Export CSV
          </a>
        </div>
        {entries.length === 0 ? (
          <p className="muted">No manual entries yet.</p>
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
              {entries.map((entry) => (
                <tr key={entry.id} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "8px 12px" }}>{entry.spendDate}</td>
                  <td style={{ padding: "8px 12px" }}>{entry.platform}</td>
                  <td style={{ padding: "8px 12px" }}>{entry.campaign ?? "—"}</td>
                  <td style={{ padding: "8px 12px" }}>{formatMoney(entry.amountCents)}</td>
                  <td style={{ padding: "8px 12px", fontSize: "0.85rem" }}>{entry.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
