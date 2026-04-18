// ─── Thompson Sampling — pure functions, no side effects ─────────────────────
//
// Implements Beta-Bernoulli bandits for per-axis creative selection.
// All functions accept an optional `rng` parameter for deterministic testing;
// when omitted Math.random() is used.
//
// References:
//   - Marsaglia & Tsang (2000) "A Simple Method for Generating Gamma Variables"
//   - Wilson (1927) score confidence interval (for `wilsonLowerBound` in repos)

// ─── Core type ────────────────────────────────────────────────────────────────

export type BanditArm = {
  id: string;
  /** Prior α + observed successes (purchases). */
  alpha: number;
  /** Prior β + observed failures (clicks without purchase). */
  beta: number;
  /** Total trials (clicks). */
  sampleCount: number;
  /** Uninformed prior alpha (default 1 → uniform). */
  priorAlpha: number;
  /** Uninformed prior beta (default 1 → uniform). */
  priorBeta: number;
};

// ─── Beta distribution sampling via Marsaglia-Tsang ──────────────────────────

/**
 * Sample from a Gamma(shape, 1) distribution using Marsaglia-Tsang (2000).
 * shape must be > 0. Uses the supplied `rng` for all randomness.
 */
function sampleGamma(shape: number, rng: () => number): number {
  if (shape < 1) {
    // Boost then scale: Gamma(d) = Gamma(d+1) * U^(1/d)
    const u = rng();
    return sampleGamma(shape + 1, rng) * Math.pow(u, 1 / shape);
  }

  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);

  for (let i = 0; i < 200; i++) {
    let x: number;
    let v: number;

    // Box-Muller normal sample
    do {
      const u1 = rng();
      const u2 = rng();
      x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      v = 1 + c * x;
    } while (v <= 0);

    v = v * v * v;
    const u = rng();

    if (u < 1 - 0.0331 * (x * x) * (x * x)) {
      return d * v;
    }
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
      return d * v;
    }
  }

  // Fallback (virtually never reached)
  return d;
}

/**
 * Sample one draw from Beta(alpha, beta) ∈ [0, 1].
 *
 * Uses Marsaglia-Tsang gamma sampling when both params > 0.
 * Boundary values: Beta(1, 1) is uniform; very skewed params are handled fine.
 */
export function sampleBeta(alpha: number, beta: number, rng: () => number = Math.random): number {
  if (alpha <= 0 || beta <= 0) {
    throw new Error(`sampleBeta: alpha and beta must be > 0, got α=${alpha} β=${beta}`);
  }

  const x = sampleGamma(alpha, rng);
  const y = sampleGamma(beta, rng);
  const sum = x + y;

  if (sum === 0) return 0.5;
  return Math.min(1, Math.max(0, x / sum));
}

// ─── Thompson selection ───────────────────────────────────────────────────────

/**
 * Run one Thompson round and return the id of the arm with the highest sampled
 * theta (Beta(alpha, beta) draw).
 */
export function thompsonSample(arms: BanditArm[], rng: () => number = Math.random): string {
  if (arms.length === 0) throw new Error("thompsonSample: arms array is empty");

  let bestId = arms[0]!.id;
  let bestTheta = -Infinity;

  for (const arm of arms) {
    const theta = sampleBeta(arm.alpha, arm.beta, rng);
    if (theta > bestTheta) {
      bestTheta = theta;
      bestId = arm.id;
    }
  }

  return bestId;
}

/**
 * Return k distinct arm ids sampled without replacement via successive Thompson
 * rounds (remove the winner from the pool each round).
 *
 * Returns min(k, arms.length) ids.
 */
export function topK(arms: BanditArm[], k: number, rng: () => number = Math.random): string[] {
  if (arms.length === 0) return [];

  const effective = Math.min(k, arms.length);
  const remaining = [...arms];
  const selected: string[] = [];

  for (let i = 0; i < effective; i++) {
    const winnerId = thompsonSample(remaining, rng);
    selected.push(winnerId);
    const winnerIdx = remaining.findIndex((a) => a.id === winnerId);
    if (winnerIdx !== -1) remaining.splice(winnerIdx, 1);
  }

  return selected;
}

// ─── Credible interval (95%) ─────────────────────────────────────────────────

/**
 * Approximation of the Beta(α, β) 95% credible interval using a normal
 * approximation around the mean, clamped to [0, 1].
 *
 * For small α+β (< 30) the normal approximation is rough — use it for
 * decisions only when sampleCount is substantial.  For agent display purposes
 * this is sufficient.
 *
 * Formula: mean ± 1.96 * sqrt(mean * (1 - mean) / (α + β + 1))
 */
export function confidenceInterval95(
  alpha: number,
  beta: number,
): { lower: number; mean: number; upper: number } {
  const n = alpha + beta;
  const mean = alpha / n;
  const se = Math.sqrt((mean * (1 - mean)) / (n + 1));
  const lower = Math.max(0, mean - 1.96 * se);
  const upper = Math.min(1, mean + 1.96 * se);
  return { lower, mean, upper };
}

// ─── Retirement candidates ────────────────────────────────────────────────────

/**
 * Flag arms that have accumulated enough spend to be meaningful but whose
 * upper 95% bound is still below `maxUpperBound` (default 2% conversion).
 *
 * These are "confident bad" elements — retire them.
 */
export function retirementCandidates(
  arms: Array<BanditArm & { spendCents: number }>,
  {
    minSpendCents = 5000,
    maxUpperBound = 0.02,
  }: { minSpendCents?: number; maxUpperBound?: number } = {},
): string[] {
  return arms
    .filter((arm) => {
      if (arm.spendCents < minSpendCents) return false;
      const { upper } = confidenceInterval95(arm.alpha, arm.beta);
      return upper < maxUpperBound;
    })
    .map((arm) => arm.id);
}

// ─── Hot-streak candidates ────────────────────────────────────────────────────

/**
 * Flag arms that have a high lower confidence bound (consistently good) AND
 * have been used recently (within freshnessHours).
 *
 * These are current momentum winners — lean into them.
 */
export function hotStreakCandidates(
  arms: Array<BanditArm & { lastUsedAt: Date | null }>,
  {
    minLower = 0.05,
    freshnessHours = 72,
  }: { minLower?: number; freshnessHours?: number } = {},
): string[] {
  const now = Date.now();
  const freshnessMs = freshnessHours * 60 * 60 * 1000;

  return arms
    .filter((arm) => {
      const { lower } = confidenceInterval95(arm.alpha, arm.beta);
      if (lower < minLower) return false;
      if (arm.lastUsedAt === null) return false;
      const age = now - arm.lastUsedAt.getTime();
      return age <= freshnessMs;
    })
    .map((arm) => arm.id);
}
