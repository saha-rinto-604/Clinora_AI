import { BrainCircuit, FileScan, HeartPulse, KeyRound, LockKeyhole, Microscope, Sparkles } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Container,
  GlassPanel,
} from '../../components/ui';
import { PageMeta } from '../../components/public/page-meta';
import { PublicCta } from '../../components/public/public-cta';
import { PublicPageHero } from '../../components/public/public-page-hero';
import { Reveal } from '../../components/public/reveal';
import { SectionHeader } from '../../components/landing/section-header';

const faqGroups = [
  {
    title: 'Clinora AI',
    Icon: Sparkles,
    items: [
      [
        'What is Clinora AI?',
        'Clinora AI is a planned clinical intelligence platform connecting patients, doctors, hospitals, researchers, blood banks, and system administrators through role-specific healthcare workflows.',
      ],
      [
        'Is the public website the clinical application?',
        'No. The public website explains Clinora’s product vision and workflows. Authenticated healthcare modules are separate implementation phases.',
      ],
    ],
  },
  {
    title: 'AI & Clinical Safety',
    Icon: BrainCircuit,
    items: [
      [
        'Does Clinora replace doctors?',
        'No. AI output is advisory and is designed for qualified professional review. Final clinical decisions remain under healthcare professional authority.',
      ],
      [
        'Does AI output represent a confirmed diagnosis?',
        'No. Possible conditions, confidence context, explanations, and follow-up suggestions are decision-support information, not autonomous diagnoses.',
      ],
    ],
  },
  {
    title: 'Medical Reports & OCR',
    Icon: FileScan,
    items: [
      [
        'What does OCR do?',
        'OCR is designed to extract text and laboratory parameters from supported medical reports so they can be structured and validated before downstream clinical workflows.',
      ],
      [
        'Can I upload a medical report on this public website?',
        'No. The public OCR page is informational. Real report upload belongs to the authenticated patient workflow and is not implemented in this public phase.',
      ],
    ],
  },
  {
    title: 'Emergency Blood Assistance',
    Icon: HeartPulse,
    items: [
      [
        'What is Emergency Blood Assistance?',
        'It is a planned coordination workflow for emergency requests, nearby blood-bank discovery, availability information, responses, and status communication.',
      ],
      [
        'Does Clinora guarantee blood availability?',
        'No. Availability depends on real-world inventory, compatibility, participating organizations, and clinical circumstances.',
      ],
    ],
  },
  {
    title: 'Research',
    Icon: Microscope,
    items: [
      [
        'Can researchers see identifiable patient records?',
        'The research experience is designed around anonymized clinical datasets and should not expose personally identifiable patient information.',
      ],
      [
        'What research capabilities are planned?',
        'Planned capabilities include anonymized datasets, disease analytics, AI model evaluation, governed collaboration, and research reporting.',
      ],
    ],
  },
  {
    title: 'Accounts & Access',
    Icon: KeyRound,
    items: [
      [
        'Can I create an account from the public website?',
        'Not yet. Registration, login, email verification, password recovery, and protected routes belong to the authentication phase and are intentionally not faked on the public website.',
      ],
      [
        'Which roles will Clinora support?',
        'The approved role model includes Patient, Doctor, Hospital Administrator, Researcher, Blood Bank Staff, and System Administrator.',
      ],
    ],
  },
  {
    title: 'Privacy & Security',
    Icon: LockKeyhole,
    items: [
      [
        'How is access intended to be controlled?',
        'Clinora is designed around authentication, role-based access control, resource boundaries, protected medical records, and auditability.',
      ],
      [
        'Does this website claim healthcare certifications?',
        'No. The public site does not claim HIPAA, GDPR, ISO 27001, SOC 2, or other certifications that have not been independently established.',
      ],
    ],
  },
] as const;

export function FaqPage() {
  return (
    <main id="main-content">
      <PageMeta
        title="Clinora AI — FAQ"
        description="Answers to common questions about Clinora AI, clinical AI safety, laboratory OCR, Emergency Blood Assistance, research, privacy, and public website scope."
      />
      <PublicPageHero
        eyebrow="Frequently asked questions"
        title="Clear answers about clinical AI and connected healthcare workflows."
        copy="Understand what Clinora is designed to do, where professional review fits, what the public website does not implement, and how privacy boundaries shape the platform."
        variant="minimal"
        primaryAction={{ label: 'Explore Features', to: '/features' }}
        secondaryAction={{ label: 'Contact Guidance', to: '/contact' }}
      />

      <section className="py-20 lg:py-28">
        <Container>
          <Reveal>
            <SectionHeader
              eyebrow="FAQ library"
              title="Questions grouped by the part of Clinora they explain."
              copy="These answers describe the approved product direction without presenting future application capabilities as already operational."
              align="center"
            />
          </Reveal>
          <div className="mt-12 grid gap-5 lg:grid-cols-2">
            {faqGroups.map(({ title, Icon, items }, groupIndex) => (
              <Reveal key={title} delay={groupIndex * 0.04}>
                <GlassPanel className="h-full border-white/9 bg-slate-950/48 p-5 sm:p-6">
                  <div className="mb-5 flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-2xl border border-cyan-300/12 bg-cyan-300/7 text-cyan-200">
                      <Icon aria-hidden="true" size={19} />
                    </span>
                    <h2 className="text-lg font-semibold text-white">{title}</h2>
                  </div>
                  <Accordion type="single" collapsible>
                    {items.map(([question, answer], index) => (
                      <AccordionItem
                        key={question}
                        value={`${groupIndex}-${index}`}
                        className="border-b border-white/7 last:border-0"
                      >
                        <AccordionTrigger className="py-4 text-base">{question}</AccordionTrigger>
                        <AccordionContent className="pb-5 text-sm leading-7">{answer}</AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </GlassPanel>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      <PublicCta
        title="Need more context about the Clinora product vision?"
        copy="Explore the platform overview or read the privacy principles that shape how clinical information is intended to be handled."
        primary={{ label: 'Explore Features', to: '/features' }}
        secondary={{ label: 'Privacy Principles', to: '/privacy' }}
      />
    </main>
  );
}
