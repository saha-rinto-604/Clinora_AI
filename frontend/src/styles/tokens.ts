export const designTokens = {
  color: {
    background: '#020617',
    primary: '#0F172A',
    medicalCyan: '#0EA5E9',
    medicalTeal: '#14B8A6',
    success: '#22C55E',
    warning: '#F59E0B',
    danger: '#EF4444',
    glass: 'rgba(255,255,255,.08)',
    glassBorder: 'rgba(255,255,255,.15)',
  },
  layout: {
    maxWidth: '1400px',
    containerPadding: '32px',
    columns: 12,
  },
  radius: {
    component: '24px',
    largeCard: '32px',
  },
  glass: {
    blur: '18px',
    shadow: '0 20px 50px rgba(0,0,0,.35)',
  },
  motion: {
    fast: '150ms',
    normal: '300ms',
    slow: '500ms',
  },
  breakpoint: {
    mobile: '390px',
    tablet: '768px',
    laptop: '1024px',
    desktop: '1440px',
  },
} as const;
