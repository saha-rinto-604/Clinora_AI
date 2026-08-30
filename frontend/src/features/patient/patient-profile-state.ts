import { ContactRound, HeartPulse, History, UserRound } from 'lucide-react';
import type { PatientProfile } from './patient-types';

export type ProfileSectionId = 'personal' | 'basic' | 'medical' | 'emergency';

export const profileSections = [
  { id: 'personal' as const, label: 'Personal details', icon: UserRound },
  { id: 'basic' as const, label: 'Basic health', icon: HeartPulse },
  { id: 'medical' as const, label: 'Medical history', icon: History },
  { id: 'emergency' as const, label: 'Emergency contact', icon: ContactRound },
];

export function sectionCompletion(profile: PatientProfile) {
  return {
    personal: Boolean(profile.dateOfBirth && profile.gender && profile.phone && profile.address),
    basic: Boolean(profile.bloodGroup && profile.heightCm && profile.weightKg),
    medical: Boolean(profile.familyMedicalHistory && profile.lifestyleInformation),
    emergency: profile.emergencyContact.configured,
  } satisfies Record<ProfileSectionId, boolean>;
}

export function completedSectionCount(profile: PatientProfile) {
  return Object.values(sectionCompletion(profile)).filter(Boolean).length;
}
