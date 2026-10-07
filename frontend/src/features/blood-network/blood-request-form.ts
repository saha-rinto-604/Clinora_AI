import { z } from 'zod';
import { bloodGroupOptions } from './blood-network-api';

export const bloodRequestSchema = z.object({
  bloodGroup: z
    .string()
    .refine((value) => bloodGroupOptions.some((group) => group.value === value), 'Blood group is required.'),
  unitsNeeded: z
    .string()
    .refine((value) => value.trim() !== '' && Number(value) >= 1, 'Units needed must be at least 1.')
    .refine(
      (value) => Number.isInteger(Number(value)) && Number(value) <= 20,
      'Units needed must be a whole number from 1 to 20.',
    ),
  hospitalName: z.string().trim().min(1, 'Hospital / donation centre is required.').max(180),
  hospitalAddress: z.string().trim().min(1, 'Request location is required.').max(500),
  neededBy: z
    .string()
    .min(1, 'Needed by date is required.')
    .refine((value) => !value || Number.isFinite(new Date(value).getTime()), 'Enter a valid needed by date.'),
  note: z.string().trim().max(600),
});

export type BloodRequestFormValues = z.infer<typeof bloodRequestSchema>;
