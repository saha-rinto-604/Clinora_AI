import { ContactRound, HeartPulse, History, ShieldCheck, UserRound } from 'lucide-react';
import type { PatientProfile } from './patient-types';

export type ProfileSectionId = 'personal' | 'basic' | 'medical' | 'emergency' | 'privacy';

export const profileSections = [
  { id: 'personal' as const, label: 'Personal details', icon: UserRound },
  { id: 'basic' as const, label: 'Basic health', icon: HeartPulse },
  { id: 'medical' as const, label: 'Medical background', icon: History },
  { id: 'emergency' as const, label: 'Emergency contact', icon: ContactRound },
];

export const privacySection = { id: 'privacy' as const, label: 'Research & Privacy', icon: ShieldCheck };

export function getProfileSections(role?: string) {
  if (role === 'RESEARCHER') {
    return profileSections.filter((s) => s.id !== 'medical');
  }
  return [...profileSections, privacySection];
}

export function sectionCompletion(profile: PatientProfile) {
  return {
    personal: Boolean(profile.dateOfBirth && profile.gender && profile.phone && profile.address),
    basic: Boolean(profile.bloodGroup && profile.heightCm && profile.weightKg),
    medical: Boolean(profile.familyMedicalHistory && profile.lifestyleInformation),
    emergency: profile.emergencyContact.configured,
    privacy: true,
  } satisfies Record<ProfileSectionId, boolean>;
}

export function completedSectionCount(profile: PatientProfile, role?: string) {
  const sections = getProfileSections(role).filter((s) => s.id !== 'privacy');
  const completion = sectionCompletion(profile);
  return sections.filter((s) => completion[s.id]).length;
}
