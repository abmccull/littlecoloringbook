import { z } from "zod";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const GammaFormatSchema = z.enum(["presentation", "document", "social"]);
export type GammaFormat = z.infer<typeof GammaFormatSchema>;

export const GammaExportAsSchema = z.enum(["pdf", "png"]);
export type GammaExportAs = z.infer<typeof GammaExportAsSchema>;

export const GammaStatusSchema = z.enum(["pending", "completed", "failed"]);
export type GammaStatus = z.infer<typeof GammaStatusSchema>;

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

export const GammaTextOptionsSchema = z.object({
  /** Verbosity level for slide text. */
  verbosity: z.enum(["brief", "medium", "detailed"]).optional(),
});
export type GammaTextOptions = z.infer<typeof GammaTextOptionsSchema>;

export const GammaCardOptionsSchema = z.object({
  /** Whether to include images on cards. */
  includeImages: z.boolean().optional(),
  /** Image style hint. */
  imageStyle: z.string().optional(),
});
export type GammaCardOptions = z.infer<typeof GammaCardOptionsSchema>;

export const GammaGenerationRequestSchema = z.object({
  /** The text prompt describing the presentation content. */
  inputText: z.string().min(1),
  /** Presentation format. Defaults to "presentation" if omitted. */
  format: GammaFormatSchema.optional(),
  /** Number of cards/slides to generate. */
  numCards: z.number().int().positive().optional(),
  /** Text density options per card. */
  textOptions: GammaTextOptionsSchema.optional(),
  /** Card layout/image options. */
  cardOptions: GammaCardOptionsSchema.optional(),
  /** Gamma theme name to apply. */
  themeName: z.string().optional(),
  /** Export format. Use "png" for per-slide images; "pdf" for a single file. */
  exportAs: GammaExportAsSchema.optional(),
});
export type GammaGenerationRequest = z.infer<typeof GammaGenerationRequestSchema>;

// ---------------------------------------------------------------------------
// Response
// ---------------------------------------------------------------------------

/**
 * A single exported asset returned by Gamma after generation completes.
 * When exportAs="png", Gamma returns one entry per card.
 * When exportAs="pdf", Gamma returns a single consolidated entry.
 */
export const GammaExportResultSchema = z.object({
  /** Card index (1-based) when exportAs="png"; absent for PDF exports. */
  cardIndex: z.number().int().optional(),
  /** Public URL to download this asset. */
  url: z.string().url(),
  /** MIME type (e.g. "image/png", "application/pdf"). */
  contentType: z.string().optional(),
});
export type GammaExportResult = z.infer<typeof GammaExportResultSchema>;

export const GammaGenerationResponseSchema = z.object({
  /** Unique generation ID returned by Gamma. */
  id: z.string(),
  /** Current status of the generation job. */
  status: GammaStatusSchema,
  /** Credits consumed by this generation. */
  credits: z.number().optional(),
  /** URL to view the presentation in the Gamma editor. */
  gammaUrl: z.string().url().optional(),
  /**
   * Export assets, present when status="completed" and exportAs was set.
   * Array has one entry per slide for PNG exports; one entry for PDF exports.
   */
  exports: z.array(GammaExportResultSchema).optional(),
  /** Human-readable failure reason when status="failed". */
  errorMessage: z.string().optional(),
});
export type GammaGenerationResponse = z.infer<typeof GammaGenerationResponseSchema>;

// ---------------------------------------------------------------------------
// Typed error
// ---------------------------------------------------------------------------

export class GammaError extends Error {
  public readonly code: string;
  public readonly statusCode: number | undefined;

  constructor(message: string, code = "GAMMA_ERROR", statusCode?: number) {
    super(message);
    this.name = "GammaError";
    this.code = code;
    this.statusCode = statusCode;
  }
}
