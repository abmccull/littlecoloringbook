import React from "react";
import { Document, renderToBuffer } from "@react-pdf/renderer";
import type { BookPayload } from "../types";
import { registerFonts } from "../fonts/register";
import { computePageDims, PremiumCoverPage } from "./premium-cover-components";

registerFonts();

export async function renderCoverPdf(payload: BookPayload): Promise<Buffer> {
  const dims = computePageDims(payload.trim);
  const doc = (
    <Document>
      <PremiumCoverPage payload={payload} dims={dims} />
    </Document>
  );

  return renderToBuffer(doc);
}
