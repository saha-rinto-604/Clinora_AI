export const publicNavItems = [
  { label: 'Platform', to: '/features' },
  { label: 'AI', to: '/ai-clinical-intelligence' },
  { label: 'OCR', to: '/laboratory-ocr' },
  { label: 'Emergency Assistance', to: '/emergency-blood-assistance' },
  { label: 'Research', to: '/research' },
  { label: 'About', to: '/about' },
  { label: 'FAQ', to: '/faq' },
] as const;

export const footerGroups = [
  {
    label: 'Platform',
    links: [
      { label: 'Features', to: '/features' },
      { label: 'AI Clinical Intelligence', to: '/ai-clinical-intelligence' },
      { label: 'Laboratory OCR', to: '/laboratory-ocr' },
      { label: 'Emergency Blood Assistance', to: '/emergency-blood-assistance' },
      { label: 'Research', to: '/research' },
    ],
  },
  {
    label: 'Company',
    links: [
      { label: 'About', to: '/about' },
      { label: 'Contact', to: '/contact' },
    ],
  },
  {
    label: 'Resources',
    links: [{ label: 'FAQ', to: '/faq' }],
  },
  {
    label: 'Legal',
    links: [
      { label: 'Privacy', to: '/privacy' },
      { label: 'Terms', to: '/terms' },
    ],
  },
] as const;
