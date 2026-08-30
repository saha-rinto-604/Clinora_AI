export type PatientGender = 'FEMALE' | 'MALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';
export type BloodGroup =
  | 'A_POSITIVE'
  | 'A_NEGATIVE'
  | 'B_POSITIVE'
  | 'B_NEGATIVE'
  | 'AB_POSITIVE'
  | 'AB_NEGATIVE'
  | 'O_POSITIVE'
  | 'O_NEGATIVE';

export interface EmergencyContact {
  name: string | null;
  phone: string | null;
  relationship: string | null;
  configured: boolean;
}

export interface PatientProfile {
  id: string | null;
  profileCreated: boolean;
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth: string | null;
  gender: PatientGender | null;
  bloodGroup: BloodGroup | null;
  phone: string | null;
  address: string | null;
  heightCm: number | null;
  weightKg: number | null;
  familyMedicalHistory: string | null;
  lifestyleInformation: string | null;
  emergencyContact: EmergencyContact;
  allergies: string[];
  chronicConditions: string[];
  currentMedications: string[];
  completenessPercent: number;
  missingProfileFields: string[];
  updatedAt: string | null;
}

export interface UpdatePatientProfileInput {
  dateOfBirth: string | null;
  gender: PatientGender | null;
  bloodGroup: BloodGroup | null;
  phone: string | null;
  address: string | null;
  heightCm: number | null;
  weightKg: number | null;
  familyMedicalHistory: string | null;
  lifestyleInformation: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelationship: string | null;
  allergies: string[];
  chronicConditions: string[];
  currentMedications: string[];
}

export interface PatientDashboard {
  firstName: string;
  lastName: string;
  profileCreated: boolean;
  profileCompletenessPercent: number;
  missingProfileFields: string[];
  bloodGroup: BloodGroup | null;
  dateOfBirth: string | null;
  heightCm: number | null;
  weightKg: number | null;
  bmi: number | null;
  allergyCount: number;
  chronicConditionCount: number;
  medicationCount: number;
  emergencyContactConfigured: boolean;
  profileUpdatedAt: string | null;
  activeReportCount: number;
  latestReport: PatientDashboardReport | null;
}

export interface PatientDashboardReport {
  id: string;
  reportName: string;
  reportType: import('../patient-reports/patient-report-types').PatientReportType;
  reportDate: string | null;
  providerLaboratory: string | null;
  uploadedAt: string;
}

export const bloodGroupLabels: Record<BloodGroup, string> = {
  A_POSITIVE: 'A+',
  A_NEGATIVE: 'A−',
  B_POSITIVE: 'B+',
  B_NEGATIVE: 'B−',
  AB_POSITIVE: 'AB+',
  AB_NEGATIVE: 'AB−',
  O_POSITIVE: 'O+',
  O_NEGATIVE: 'O−',
};

export const genderLabels: Record<PatientGender, string> = {
  FEMALE: 'Female',
  MALE: 'Male',
  OTHER: 'Other',
  PREFER_NOT_TO_SAY: 'Prefer not to say',
};
