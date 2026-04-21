// Kling budget tracker. Enforces the monthly credit cap by summing
// `kling_usage` rows since the start of the current calendar month
// (or a configurable window). Throws `KlingBudgetExceededError` before
// submission if the estimated spend would push us over the cap.
//
// Also exposes `paceStatus()` for dashboard / cron alerts — tells you
// whether you're burning credits fast enough to use the whole budget
// this month, too fast, or on pace.

import {
  getKlingCreditsSpentSince,
  recordKlingSubmission,
  updateKlingCompletion,
  listRecentKlingUsage,
  type RecordKlingSubmissionInput,
  type UpdateKlingCompletionInput,
} from "@littlecolorbook/db/repositories";

import { KlingBudgetExceededError } from "./types";

export type KlingBudgetConfig = {
  /** Monthly credit cap. Defaults to 600. */
  monthlyCreditBudget: number;
  /** Override "now" for tests. */
  now?: () => Date;
};

export type PaceStatus = {
  budget: number;
  spent: number;
  remaining: number;
  daysIntoMonth: number;
  daysInMonth: number;
  recommendedSpendByNow: number;
  verdict: "under_pace" | "on_pace" | "over_pace" | "exhausted";
};

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export class KlingUsageTracker {
  constructor(private config: KlingBudgetConfig) {}

  private now(): Date {
    return this.config.now ? this.config.now() : new Date();
  }

  /**
   * Read-through budget check. Returns the current month-to-date spend
   * (including pending submissions) so callers can log + decide.
   */
  async creditsSpentThisMonth(): Promise<number> {
    return getKlingCreditsSpentSince(startOfMonth(this.now()));
  }

  /**
   * Pre-flight guard. Call BEFORE submitting a Kling job.
   * Throws `KlingBudgetExceededError` if launching this job would push
   * month-to-date spend over the cap.
   */
  async assertBudget(estimatedCredits: number): Promise<void> {
    const spent = await this.creditsSpentThisMonth();
    if (spent + estimatedCredits > this.config.monthlyCreditBudget) {
      throw new KlingBudgetExceededError(spent, estimatedCredits, this.config.monthlyCreditBudget);
    }
  }

  /**
   * Record a newly-submitted job. Call after `assertBudget` succeeds
   * and the Kling API returns a task_id. Reserves the estimated credit
   * spend immediately so concurrent callers see an accurate balance.
   */
  async recordSubmission(input: RecordKlingSubmissionInput): Promise<void> {
    await recordKlingSubmission(input);
  }

  /**
   * Record terminal state from a poll. Kling's completion response
   * does not always include an authoritative credit count — when
   * present, prefer it over the estimate; when absent, the estimate
   * remains as the recorded cost.
   */
  async recordCompletion(input: UpdateKlingCompletionInput): Promise<void> {
    await updateKlingCompletion(input);
  }

  /**
   * Pace check for dashboards + alerting. "Under pace" means we're
   * burning slower than the budget allows — safe to accept more work.
   * "Over pace" is a warning that if we don't slow down we'll exhaust
   * before month-end.
   */
  async paceStatus(): Promise<PaceStatus> {
    const now = this.now();
    const spent = await this.creditsSpentThisMonth();
    const budget = this.config.monthlyCreditBudget;
    const remaining = Math.max(0, budget - spent);
    const totalDays = daysInMonth(now);
    const daysIntoMonth = Math.min(totalDays, now.getDate());
    const pacePerDay = budget / totalDays;
    const recommendedSpendByNow = Math.round(pacePerDay * daysIntoMonth);

    let verdict: PaceStatus["verdict"];
    if (spent >= budget) verdict = "exhausted";
    else if (spent < recommendedSpendByNow - pacePerDay) verdict = "under_pace";
    else if (spent > recommendedSpendByNow + pacePerDay) verdict = "over_pace";
    else verdict = "on_pace";

    return {
      budget,
      spent,
      remaining,
      daysIntoMonth,
      daysInMonth: totalDays,
      recommendedSpendByNow,
      verdict,
    };
  }

  async recent(limit = 25) {
    return listRecentKlingUsage(limit);
  }
}
