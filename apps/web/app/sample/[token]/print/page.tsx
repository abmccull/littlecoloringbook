import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderPortalSummary } from "@littlecolorbook/db";
import { PrintDialogButton } from "../../../../components/sample-print-controls";

type SamplePrintPageProps = {
  params: Promise<{ token: string }>;
};

export default async function SamplePrintPage({ params }: SamplePrintPageProps) {
  const { token } = await params;
  const summary = await getOrderPortalSummary(token);

  if (!summary) {
    notFound();
  }

  const generatedPagePath = summary.assets.generatedPagePaths[0];

  if (!generatedPagePath) {
    notFound();
  }

  const printImageHref = `/api/orders/portal/${token}/generated-page`;

  return (
    <main className="sample-print-main">
      <section className="sample-print-shell">
        <div className="sample-print-toolbar">
          <div className="stack-tight">
            <span className="pill pill-sun">Letter portrait print</span>
            <p className="muted">Sized for an 8.5 × 11 page so the sample prints cleanly without the rest of the sales layout.</p>
          </div>
          <div className="sample-print-toolbar-actions">
            <PrintDialogButton className="button button-primary">Print Sample Page</PrintDialogButton>
            <Link className="button button-secondary" href={`/sample/${token}`}>
              Back to preview
            </Link>
          </div>
        </div>

        <div className="sample-print-sheet">
          <img alt="Printable sample coloring page" className="sample-print-image" src={printImageHref} />
        </div>
      </section>
    </main>
  );
}
