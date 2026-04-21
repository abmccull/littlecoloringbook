// Generate the two bonus PDFs and write them to /tmp for visual inspection
import { writeFile, mkdir } from "node:fs/promises";
import { renderPhotoPickerGuidePdf, renderPartyKitPdf } from "@littlecolorbook/pdf-templates";

const outDir = "tmp/bonus-pdfs-preview";
await mkdir(outDir, { recursive: true });

console.log("Rendering photo-picker-guide.pdf...");
const guide = await renderPhotoPickerGuidePdf();
await writeFile(`${outDir}/photo-picker-guide.pdf`, guide);
console.log(`  ✓ ${guide.length} bytes`);

console.log("Rendering party-kit.pdf (no name)...");
const kitNoName = await renderPartyKitPdf();
await writeFile(`${outDir}/party-kit-no-name.pdf`, kitNoName);
console.log(`  ✓ ${kitNoName.length} bytes`);

console.log('Rendering party-kit.pdf (with name "Mila")...');
const kitNamed = await renderPartyKitPdf({ childFirstName: "Mila" });
await writeFile(`${outDir}/party-kit-mila.pdf`, kitNamed);
console.log(`  ✓ ${kitNamed.length} bytes`);

console.log(`\nAll 3 PDFs written to ${outDir}/`);
