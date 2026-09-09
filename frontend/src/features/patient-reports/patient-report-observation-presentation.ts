import type { PatientReportObservation } from './patient-report-extraction-types';
import type { PatientObservationRangeState } from './patient-report-range-state';

export function rangeStateLabel(state: PatientObservationRangeState) {
  return state === 'IN_RANGE'
    ? 'Within expected range'
    : state === 'REPORTED'
      ? 'Range status unavailable'
      : state === 'HIGH'
        ? 'Higher than expected'
        : 'Lower than expected';
}

export function formatObservationValue(observation: PatientReportObservation) {
  const value = observation.numericValue != null
    ? `${observation.comparator ?? ''}${observation.numericValue}`
    : observation.textValue || 'Reported';
  return observation.unit ? `${value} ${observation.unit}` : value;
}

export function formatReference(observation: PatientReportObservation) {
  if (observation.referenceRangeRaw) return observation.referenceRangeRaw;
  if (observation.referenceLow != null && observation.referenceHigh != null) return `${observation.referenceLow}–${observation.referenceHigh}`;
  if (observation.referenceLow != null) return `≥ ${observation.referenceLow}`;
  if (observation.referenceHigh != null) return `≤ ${observation.referenceHigh}`;
  return 'Not stated on report';
}
