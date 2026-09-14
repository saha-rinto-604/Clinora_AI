export function formatDoctorDateTime(value: string, timezone?: string | null) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone || undefined,
  }).format(new Date(value));
}

export function formatDoctorDate(value?: string | null) {
  if (!value) return 'Not recorded';
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

export function doctorStatusLabel(status: string) {
  if (status === 'BOOKED') return 'Confirmed';
  if (status === 'COMPLETED') return 'Completed';
  if (status === 'CANCELLED') return 'Cancelled';
  return status;
}

export function doctorStatusTone(status: string): 'info' | 'success' | 'danger' | 'neutral' {
  if (status === 'BOOKED') return 'info';
  if (status === 'COMPLETED') return 'success';
  if (status === 'CANCELLED') return 'danger';
  return 'neutral';
}

export function bloodGroupLabel(value?: string | null) {
  const labels: Record<string, string> = {
    A_POSITIVE: 'A+',
    A_NEGATIVE: 'A−',
    B_POSITIVE: 'B+',
    B_NEGATIVE: 'B−',
    AB_POSITIVE: 'AB+',
    AB_NEGATIVE: 'AB−',
    O_POSITIVE: 'O+',
    O_NEGATIVE: 'O−',
  };
  return value ? (labels[value] ?? value) : 'Not recorded';
}

export function genderLabel(value?: string | null) {
  if (!value) return 'Not recorded';
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function reportTypeLabel(value?: string | null) {
  if (!value) return 'Medical report';
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
