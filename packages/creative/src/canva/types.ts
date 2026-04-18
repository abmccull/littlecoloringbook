// ─── Canva Connect API types ──────────────────────────────────────────────────

export type CanvaImageField = {
  type: "image";
  asset_id: string;
};

export type CanvaTextField = {
  type: "text";
  text: string;
};

export type CanvaAutofillField = CanvaImageField | CanvaTextField;

export type CanvaAutofillRequest = {
  brand_template_id: string;
  data: Record<string, CanvaAutofillField>;
};

export type CanvaDesign = {
  id: string;
  urls?: {
    edit_url?: string;
  };
};

export type CanvaAutofillJobResult = {
  job: {
    id: string;
    status: "queued" | "in_progress" | "success" | "failed";
    error?: { code: string; message: string };
    result?: {
      design: CanvaDesign;
    };
  };
};

export type CanvaExportRequest = {
  design_id: string;
  format: {
    type: "png" | "jpg" | "pdf";
  };
};

export type CanvaExportJobResult = {
  job: {
    id: string;
    status: "queued" | "in_progress" | "success" | "failed";
    error?: { code: string; message: string };
    urls?: string[];
  };
};

export type CanvaAssetUploadResult = {
  job: {
    id: string;
    status: "queued" | "in_progress" | "success" | "failed";
    error?: { code: string; message: string };
    asset?: {
      id: string;
    };
  };
};

export type CanvaClientConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  apiBaseUrl?: string;
};

export class CanvaError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status?: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "CanvaError";
  }
}

// ─── Default field-key mapping ────────────────────────────────────────────────

/**
 * Maps Canva template field keys to brief copy fields.
 * Override per-brief via `brief.canvaFieldMapping`.
 */
export const DEFAULT_CANVA_FIELD_MAPPING: Record<
  string,
  "hook" | "body" | "cta" | "hero_image"
> = {
  hero_image: "hero_image",
  hook_text: "hook",
  body_text: "body",
  cta_text: "cta",
};
