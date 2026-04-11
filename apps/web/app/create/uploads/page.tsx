import Link from "next/link";
import { getOrderPortalSummaryByOrderId } from "@littlecolorbook/db";
import { BrandLogo } from "../../../components/brand-logo";
import { UploadsStep } from "../../../components/uploads-step";

export default async function CreateUploadsPage({
  searchParams,
}: {
  searchParams: Promise<{ deliveryMode?: string; orderId?: string; selectedOffer?: string }>;
}) {
  const params = await searchParams;
  const summary = params.orderId ? await getOrderPortalSummaryByOrderId(params.orderId) : null;
  const initialUploads = summary
    ? summary.uploads
        .filter(
          (upload): upload is typeof upload & { status: "uploaded" | "failed" } =>
            upload.status === "uploaded" || upload.status === "failed",
        )
        .map((upload) => ({
          fileName: upload.fileName,
          objectPath: upload.objectPath,
          status: upload.status,
        }))
    : [];

  return (
    <main>
      <header className="topbar topbar-flow">
        <BrandLogo href="/" subtitle="photo upload" />
        <Link className="topbar-link" href={`/create${params.selectedOffer ? `?offer=${encodeURIComponent(params.selectedOffer)}` : ""}`}>
          Builder
        </Link>
      </header>
      <UploadsStep
        deliveryMode={params.deliveryMode}
        orderId={params.orderId}
        selectedOffer={params.selectedOffer}
        initialUploadedCount={initialUploads.filter((upload) => upload.status === "uploaded").length}
        initialUploads={initialUploads}
      />
    </main>
  );
}
