import type { PatientReportObservation } from './patient-report-extraction-types';

export type PatientObservationRangeState = 'LOW' | 'IN_RANGE' | 'HIGH' | 'REPORTED';

type ParsedReference =
  | { kind: 'UPPER'; threshold: number; inclusive: boolean }
  | { kind: 'LOWER'; threshold: number; inclusive: boolean }
  | { kind: 'INTERVAL'; low: number; high: number };

function parseNumber(value: string) {
  const parsed = Number(value.replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function safeTrailingReference(value: string) {
  const candidate = value.trim();
  if (!candidate) return true;
  if (/[<>≤≥;]/u.test(candidate)) return false;
  if (/\b(?:negative|positive|equivocal|borderline|reactive|non[- ]?reactive|indeterminate)\b/iu.test(candidate)) {
    return false;
  }
  const normalizedUnits = candidate.normalize('NFKC').replace(/(?:(?:x|×|\*)\s*)?10\s*(?:\^\s*)?[+-]?\d+/giu, ' ');
  if (/(?<![A-Za-z])\d+(?:\.\d+)?(?![A-Za-z])/u.test(normalizedUnits)) return false;
  return true;
}

function parseSimpleReference(raw: string | null | undefined): ParsedReference | null {
  const normalized = (raw ?? '').trim();
  if (!normalized) return null;

  const oneSided = normalized.match(
    /^\s*(<=|>=|<|>|≤|≥)\s*([+-]?(?:\d[\d,]*(?:\.\d+)?|\.\d+))(.*)$/u,
  );
  if (oneSided && safeTrailingReference(oneSided[3])) {
    const threshold = parseNumber(oneSided[2]);
    if (threshold == null) return null;
    const comparator = oneSided[1];
    if (comparator === '<' || comparator === '<=' || comparator === '≤') {
      return { kind: 'UPPER', threshold, inclusive: comparator === '<=' || comparator === '≤' };
    }
    return { kind: 'LOWER', threshold, inclusive: comparator === '>=' || comparator === '≥' };
  }

  const interval = normalized.match(
    /^\s*([+-]?(?:\d[\d,]*(?:\.\d+)?|\.\d+))\s*(?:-|–|—|to)\s*([+-]?(?:\d[\d,]*(?:\.\d+)?|\.\d+))(.*)$/iu,
  );
  if (!interval || !safeTrailingReference(interval[3])) return null;

  const low = parseNumber(interval[1]);
  const high = parseNumber(interval[2]);
  if (low == null || high == null || low > high) return null;
  return { kind: 'INTERVAL', low, high };
}

function stateFromSimpleReference(value: number, reference: ParsedReference): PatientObservationRangeState {
  if (reference.kind === 'INTERVAL') {
    if (value < reference.low) return 'LOW';
    if (value > reference.high) return 'HIGH';
    return 'IN_RANGE';
  }

  if (reference.kind === 'UPPER') {
    const inside = reference.inclusive ? value <= reference.threshold : value < reference.threshold;
    return inside ? 'IN_RANGE' : 'HIGH';
  }

  const inside = reference.inclusive ? value >= reference.threshold : value > reference.threshold;
  return inside ? 'IN_RANGE' : 'LOW';
}

/**
 * Patient-facing range classification for an already verified observation.
 *
 * Keep this intentionally conservative and aligned with the AI service:
 * structured bounds win, verified flags are next, and only simple raw numeric
 * reference expressions are interpreted as a final fallback. Complex
 * qualitative/multi-cutoff assay rules remain REPORTED instead of being guessed.
 */
export function patientObservationRangeState(
  observation: PatientReportObservation,
): PatientObservationRangeState {
  if (observation.valueType === 'NUMERIC' && observation.numericValue != null) {
    if (observation.referenceLow != null && observation.numericValue < observation.referenceLow) return 'LOW';
    if (observation.referenceHigh != null && observation.numericValue > observation.referenceHigh) return 'HIGH';
    if (observation.referenceLow != null || observation.referenceHigh != null) return 'IN_RANGE';
  }

  const flag = (observation.derivedRangeFlag || observation.sourceFlag || '').toUpperCase();
  if (flag.includes('ABOVE') || /\bHIGH\b/.test(flag) || flag === 'H') return 'HIGH';
  if (flag.includes('BELOW') || /\bLOW\b/.test(flag) || flag === 'L') return 'LOW';
  if (flag.includes('WITHIN') || flag.includes('NORMAL') || flag.includes('IN_RANGE')) return 'IN_RANGE';

  if (observation.valueType === 'NUMERIC' && observation.numericValue != null) {
    const parsedReference = parseSimpleReference(observation.referenceRangeRaw);
    if (parsedReference) return stateFromSimpleReference(observation.numericValue, parsedReference);
  }

  return 'REPORTED';
}
