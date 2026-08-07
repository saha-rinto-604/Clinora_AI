import {
  Activity,
  BrainCircuit,
  Building2,
  DatabaseZap,
  FileScan,
  HeartPulse,
  Hospital,
  LockKeyhole,
  Microscope,
  Network,
  ShieldCheck,
  Stethoscope,
  UserRound,
  UsersRound,
} from 'lucide-react';

export const navItems = [
  { label: 'Platform', href: '#platform' },
  { label: 'AI & OCR', href: '#ai-ocr' },
  { label: 'Emergency Assistance', href: '#emergency-assistance' },
  { label: 'Research', href: '#research' },
  { label: 'Security', href: '#security' },
  { label: 'FAQ', href: '#faq' },
];

export const trustSignals = ['Human-in-the-loop AI', 'Privacy-conscious architecture', 'Explainable clinical support'];

export const ecosystemCards = [
  {
    title: 'Patients',
    copy: 'Understand reports, follow care history, and coordinate care through secure patient-centered tools.',
    Icon: UserRound,
  },
  {
    title: 'Doctors',
    copy: 'Review clinical context, AI-assisted reasoning, and longitudinal patient information while retaining authority.',
    Icon: Stethoscope,
  },
  {
    title: 'Hospitals',
    copy: 'Coordinate departments, clinicians, appointments, and organization-wide healthcare operations.',
    Icon: Hospital,
  },
  {
    title: 'Researchers',
    copy: 'Work with privacy-preserving datasets, disease analytics, and AI evaluation workflows.',
    Icon: Microscope,
  },
  {
    title: 'Blood Banks',
    copy: 'Support emergency coordination with inventory visibility and nearby availability workflows.',
    Icon: HeartPulse,
  },
  {
    title: 'System Administration',
    copy: 'Govern access, auditability, infrastructure configuration, and platform operations.',
    Icon: ShieldCheck,
  },
];

export const intelligenceCards = [
  {
    title: 'Laboratory report workflow',
    copy: 'Transforms uploaded laboratory reports into structured clinical information for easier review and continuity.',
    Icon: FileScan,
  },
  {
    title: 'AI-assisted clinical reasoning',
    copy: 'Surfaces possible clinical hypotheses and supporting context for qualified professionals to assess.',
    Icon: BrainCircuit,
  },
  {
    title: 'Explainable insights',
    copy: 'Prioritizes transparent summaries and patient-friendly language over opaque automated conclusions.',
    Icon: Activity,
  },
  {
    title: 'Physician review',
    copy: 'Keeps AI output advisory so medical decisions remain under licensed clinical judgment.',
    Icon: UsersRound,
  },
];

export const workflowSteps = [
  'Medical report',
  'OCR extraction',
  'Structured clinical data',
  'AI-assisted reasoning',
  'Professional review',
];

export const roleCards = [
  {
    label: 'Patient',
    copy: 'Secure medical records, report explanations, appointments, and care continuity.',
  },
  {
    label: 'Doctor',
    copy: 'AI-assisted clinical reasoning, consultations, prescriptions, and follow-up planning.',
  },
  {
    label: 'Hospital Administrator',
    copy: 'Departments, doctors, resources, appointments, and organizational visibility.',
  },
  {
    label: 'Researcher',
    copy: 'Anonymized datasets, disease analytics, AI model evaluation, and collaboration.',
  },
  {
    label: 'Blood Bank Staff',
    copy: 'Inventory coordination, emergency requests, reservations, and availability support.',
  },
  {
    label: 'System Administrator',
    copy: 'Security governance, audit logs, access boundaries, and platform configuration.',
  },
];

export const securityItems = [
  {
    title: 'Role-aware access',
    copy: 'Separates experiences and data access according to healthcare responsibility and authorization.',
    Icon: LockKeyhole,
  },
  {
    title: 'Protected medical reports',
    copy: 'Treats clinical documents as sensitive assets handled through authorized platform workflows.',
    Icon: DatabaseZap,
  },
  {
    title: 'Auditability',
    copy: 'Supports traceability and accountability for sensitive actions across the platform.',
    Icon: Network,
  },
  {
    title: 'Anonymized research data',
    copy: 'Keeps identifying patient information outside privacy-preserving research experiences.',
    Icon: Building2,
  },
];

export const careSteps = [
  { label: 'Upload', copy: 'A medical report enters a protected intake workflow.' },
  { label: 'Extract', copy: 'OCR structures clinical text and values for review.' },
  { label: 'Analyze', copy: 'AI assistance adds advisory reasoning and relevant clinical context.' },
  { label: 'Review', copy: 'A qualified professional validates, modifies, or rejects AI output.' },
  { label: 'Continue Care', copy: 'The patient and care team continue through the appropriate care workflow.' },
];

export const faqs = [
  {
    question: 'What is Clinora AI?',
    answer:
      'Clinora AI is a clinical intelligence platform designed to connect patients, clinicians, hospitals, researchers, blood banks, and administrators through secure AI-assisted healthcare workflows.',
  },
  {
    question: 'Does Clinora replace doctors?',
    answer:
      'No. Clinora is designed for human-in-the-loop clinical support. AI output is advisory and requires review by qualified healthcare professionals.',
  },
  {
    question: 'How does AI analysis work?',
    answer:
      'Medical reports move through protected processing where OCR structures report information and AI assistance evaluates the resulting clinical context. Results return through the platform for professional review rather than being treated as an autonomous diagnosis.',
  },
  {
    question: 'What happens to uploaded reports?',
    answer:
      'Medical reports are intended to remain protected clinical assets handled through authenticated, role-aware workflows with validation, controlled access, and traceability.',
  },
  {
    question: 'How is research data protected?',
    answer:
      'Research experiences are designed around anonymized clinical datasets and privacy-preserving analytics rather than personally identifiable patient records.',
  },
  {
    question: 'What is Emergency Blood Assistance?',
    answer:
      'Emergency Blood Assistance supports emergency request coordination, nearby blood-bank discovery, availability updates, and status communication. It supports coordination but cannot guarantee supply.',
  },
  {
    question: 'Who can use Clinora AI?',
    answer:
      'Clinora supports Patients, Doctors, Hospital Administrators, Researchers, Blood Bank Staff, and System Administrators through role-specific healthcare experiences.',
  },
];

export const proofBadges = [
  'Advisory AI',
  'Human review required',
  'Protected service boundaries',
  'Privacy-conscious data flow',
];

export const footerLinks = [...navItems, { label: 'Workflow', href: '#workflow' }];
