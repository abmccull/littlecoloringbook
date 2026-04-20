export type SampleBlockReason = "email" | "visitor" | "ip";

type SampleLimitEnv = Record<string, string | undefined>;

export type SampleLimitPolicy = {
  maxSamplesPerEmail: number;
  maxSamplesPerVisitor: number;
  maxSamplesPerIp: number;
  ipWindowDays: number;
  bypassEmails: Set<string>;
  bypassIps: Set<string>;
};

export type SampleLimitCounts = {
  emailCount: number;
  visitorCount: number;
  ipCount: number;
};

export type SampleLimitEvaluationInput = {
  email: string;
  visitorId?: string | null;
  clientIp?: string | null;
  counts: SampleLimitCounts;
  policy?: SampleLimitPolicy;
};

export type SampleLimitEvaluation = {
  blocked: boolean;
  blockedBy: SampleBlockReason[];
  bypassed: boolean;
  limits: {
    email: number;
    visitor: number;
    ip: number;
    ipWindowDays: number;
  };
};

const DEFAULT_MAX_SAMPLES_PER_IP = 4;
const DEFAULT_IP_WINDOW_DAYS = 30;
const DEFAULT_TESTER_BYPASS_EMAILS = ["handscrapedflooring@gmail.com"];
const DEFAULT_TESTER_BYPASS_IPS = ["160.223.185.14"];

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function parseCsvSet(rawValue: string | undefined, normalize: (value: string) => string) {
  return new Set(
    (rawValue ?? "")
      .split(",")
      .map((value) => normalize(value))
      .filter(Boolean),
  );
}

function parsePositiveInt(rawValue: string | undefined, fallback: number) {
  const parsed = Number.parseInt(rawValue ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

export function getSampleLimitPolicy(env: SampleLimitEnv = process.env): SampleLimitPolicy {
  return {
    maxSamplesPerEmail: 1,
    maxSamplesPerVisitor: 1,
    maxSamplesPerIp: parsePositiveInt(env.SAMPLE_LIMIT_IP_MAX, DEFAULT_MAX_SAMPLES_PER_IP),
    ipWindowDays: parsePositiveInt(env.SAMPLE_LIMIT_IP_WINDOW_DAYS, DEFAULT_IP_WINDOW_DAYS),
    // Keep the operator requested production tester carve-out even if env
    // configuration has not been applied yet, then extend it via env.
    bypassEmails: new Set([
      ...DEFAULT_TESTER_BYPASS_EMAILS.map(normalizeEmail),
      ...parseCsvSet(env.SAMPLE_LIMIT_BYPASS_EMAILS, normalizeEmail),
    ]),
    bypassIps: new Set([
      ...DEFAULT_TESTER_BYPASS_IPS.map((value) => value.trim()),
      ...parseCsvSet(env.SAMPLE_LIMIT_BYPASS_IPS, (value) => value.trim()),
    ]),
  };
}

export function evaluateSampleLimit(input: SampleLimitEvaluationInput): SampleLimitEvaluation {
  const policy = input.policy ?? getSampleLimitPolicy();
  const normalizedEmail = normalizeEmail(input.email);
  const clientIp = input.clientIp?.trim() ?? "";
  const bypassed =
    policy.bypassEmails.has(normalizedEmail) ||
    (clientIp.length > 0 && clientIp !== "unknown" && policy.bypassIps.has(clientIp));

  if (bypassed) {
    return {
      blocked: false,
      blockedBy: [],
      bypassed: true,
      limits: {
        email: policy.maxSamplesPerEmail,
        visitor: policy.maxSamplesPerVisitor,
        ip: policy.maxSamplesPerIp,
        ipWindowDays: policy.ipWindowDays,
      },
    };
  }

  const blockedBy: SampleBlockReason[] = [];
  if (input.counts.emailCount >= policy.maxSamplesPerEmail) {
    blockedBy.push("email");
  }
  if (input.visitorId && input.counts.visitorCount >= policy.maxSamplesPerVisitor) {
    blockedBy.push("visitor");
  }
  if (
    clientIp.length > 0 &&
    clientIp !== "unknown" &&
    input.counts.ipCount >= policy.maxSamplesPerIp
  ) {
    blockedBy.push("ip");
  }

  return {
    blocked: blockedBy.length > 0,
    blockedBy,
    bypassed: false,
    limits: {
      email: policy.maxSamplesPerEmail,
      visitor: policy.maxSamplesPerVisitor,
      ip: policy.maxSamplesPerIp,
      ipWindowDays: policy.ipWindowDays,
    },
  };
}
