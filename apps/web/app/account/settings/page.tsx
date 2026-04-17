import { getDatabase, isDatabaseConfigured, customers } from "@littlecolorbook/db";
import { eq } from "drizzle-orm";
import { getCustomerSession } from "../../../lib/auth";
import { ConsentForm } from "../../../components/account/consent-form";

export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  const session = await getCustomerSession();
  if (!session) return null;

  let marketingOptIn = false;
  let featureConsent: boolean | null = null;

  if (isDatabaseConfigured()) {
    const db = getDatabase();
    const row = await db.query.customers.findFirst({ where: eq(customers.id, session.customerId) });
    marketingOptIn = Boolean(row?.marketingOptIn);
    featureConsent = row?.featureConsent ?? null;
  }

  return (
    <section className="account-section">
      <div className="portal-card">
        <span className="pill">Settings</span>
        <h1>Email + sharing preferences.</h1>
        <p className="muted">
          Control how we email you and whether your pages can appear in our weekly newsletter. Signed in as{" "}
          <strong>{session.email}</strong>.
        </p>

        <ConsentForm
          initialMarketingOptIn={marketingOptIn}
          initialFeatureConsent={featureConsent}
        />
      </div>
    </section>
  );
}
