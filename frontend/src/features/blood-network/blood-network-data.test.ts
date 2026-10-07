import { describe, expect, it } from 'vitest';
import { bloodRequestSchema } from './blood-request-form';

describe('Blood request validation', () => {
  const valid = {
    bloodGroup: 'B_POSITIVE',
    unitsNeeded: '1',
    hospitalName: 'Hospital',
    hospitalAddress: 'Dhaka',
    neededBy: '2026-11-01T10:00',
    note: '',
  };
  it('requires all five fields while leaving context optional', () => {
    const result = bloodRequestSchema.safeParse({
      bloodGroup: '',
      unitsNeeded: '',
      hospitalName: '  ',
      hospitalAddress: '',
      neededBy: '',
      note: '',
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(new Set(result.error.issues.map((issue) => issue.path[0]))).toEqual(
        new Set(['bloodGroup', 'unitsNeeded', 'hospitalName', 'hospitalAddress', 'neededBy']),
      );
    expect(bloodRequestSchema.safeParse(valid).success).toBe(true);
  });
  it.each(['0', '-1', '1.5', '21', 'abc'])('rejects invalid units: %s', (unitsNeeded) => {
    expect(bloodRequestSchema.safeParse({ ...valid, unitsNeeded }).success).toBe(false);
  });
  it('rejects invalid dates and blood groups', () => {
    expect(bloodRequestSchema.safeParse({ ...valid, neededBy: 'invalid' }).success).toBe(false);
    expect(bloodRequestSchema.safeParse({ ...valid, bloodGroup: 'UNKNOWN' }).success).toBe(false);
  });
});
