/**
 * STEP 8C: Confidence thresholds for clause extraction.
 * When extraction confidence is below threshold, finding is set to UNCLEAR (no rule evaluation, no score deduction).
 */

export const CONFIDENCE_THRESHOLDS = {
  DEFAULT: 0.75,
  // optional: per clause type overrides later
} as const;

const envThreshold = process.env.CONFIDENCE_THRESHOLD;
const parsed = envThreshold != null ? Number(envThreshold) : NaN;

/** Threshold 0..1; below this, finding is UNCLEAR (LOW_CONFIDENCE). Default 0.75. */
export function getConfidenceThreshold(): number {
  if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) return parsed;
  return CONFIDENCE_THRESHOLDS.DEFAULT;
}

/** Clamp value to [0, 1]. null/undefined → 0. */
export function clampConfidence(value: number | null | undefined): number {
  if (value == null || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
