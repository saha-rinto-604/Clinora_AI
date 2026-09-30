import { describe, expect, it } from 'vitest';
import { doctorBackTarget, doctorNavigationState } from './doctor-navigation';

describe('Doctor navigation context', () => {
  const fallback = { to: '/doctor/schedule', label: 'Back to appointments' };

  it('keeps a validated clinical return chain', () => {
    const patient = { to: '/doctor/patients/patient-1?tab=timeline', label: 'Back to patient' };
    const state = doctorNavigationState(
      '/doctor/appointments/appointment-1/consultation',
      'Back to consultation',
      patient,
    );

    expect(doctorBackTarget(state, fallback, (path) => path.endsWith('/consultation'))).toEqual({
      to: '/doctor/appointments/appointment-1/consultation',
      label: 'Back to consultation',
      state: { doctorBack: patient },
    });
  });

  it('uses the explicit fallback for direct links and rejects unrelated context', () => {
    expect(doctorBackTarget(undefined, fallback, () => true)).toEqual(fallback);
    expect(
      doctorBackTarget(doctorNavigationState('/doctor/patients/another-patient', 'Back to patient'), fallback, () => false),
    ).toEqual(fallback);
  });

  it('rejects destinations outside the Doctor workspace', () => {
    const state = { doctorBack: { to: '/patient/reports', label: 'Unsafe return' } };
    expect(doctorBackTarget(state, fallback, () => true)).toEqual(fallback);
  });
});
