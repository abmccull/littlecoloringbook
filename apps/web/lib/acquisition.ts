export type AcquisitionPayload = {
  acquisitionPath: "sample_first" | "direct_buy" | "unknown";
  entrySource?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
};

function readOptionalParam(params: URLSearchParams, key: string) {
  const value = params.get(key)?.trim();
  return value ? value : undefined;
}

export function getAcquisitionPayload(
  params: URLSearchParams,
  fallbackPath: AcquisitionPayload["acquisitionPath"],
  fallbackSource: string,
): AcquisitionPayload {
  return {
    acquisitionPath: (readOptionalParam(params, "acquisitionPath") as AcquisitionPayload["acquisitionPath"] | undefined) ?? fallbackPath,
    entrySource: readOptionalParam(params, "source") ?? fallbackSource,
    utmSource: readOptionalParam(params, "utm_source"),
    utmMedium: readOptionalParam(params, "utm_medium"),
    utmCampaign: readOptionalParam(params, "utm_campaign"),
    utmContent: readOptionalParam(params, "utm_content"),
    utmTerm: readOptionalParam(params, "utm_term"),
  };
}

export function getAcquisitionPayloadFromRecord(
  params: Record<string, string | undefined>,
  fallbackPath: AcquisitionPayload["acquisitionPath"],
  fallbackSource: string,
): AcquisitionPayload {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  return getAcquisitionPayload(searchParams, fallbackPath, fallbackSource);
}
