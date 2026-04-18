import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderForCustomer } from "@littlecolorbook/db";
import { getCustomerSession } from "../../../../../../lib/auth";
import { NewTicketForm } from "../../../../../../components/account/new-ticket-form";

export const dynamic = "force-dynamic";

export default async function NewTicketForOrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const session = await getCustomerSession();
  if (!session) return null;

  const { orderId } = await params;
  const summary = await getOrderForCustomer({ customerId: session.customerId, orderId });
  if (!summary) notFound();

  return (
    <section className="account-section">
      <div className="portal-card">
        <p>
          <Link href={`/account/orders/${orderId}`}>← back to order</Link>
        </p>
        <span className="pill">New ticket</span>
        <h1>Tell us what's not right.</h1>
        <p className="muted">
          We reply within 24 hours (usually a lot faster). Include what happened, any relevant details, and photos if
          it's a print-quality or shipping issue (reply with them from the ticket once it's open — attachments coming
          soon).
        </p>
      </div>

      <div className="portal-card">
        <NewTicketForm orderId={orderId} customerEmail={session.email} />
      </div>
    </section>
  );
}
