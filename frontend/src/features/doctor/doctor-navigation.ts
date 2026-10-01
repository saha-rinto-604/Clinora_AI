export type DoctorBackTarget = {
  to: string;
  label: string;
  state?: DoctorNavigationState;
};

export type DoctorNavigationState = {
  doctorBack?: DoctorBackTarget;
};

export function doctorNavigationState(to: string, label: string, parent?: DoctorBackTarget): DoctorNavigationState {
  return {
    doctorBack: {
      to,
      label,
      ...(parent ? { state: { doctorBack: parent } } : {}),
    },
  };
}

export function doctorBackTarget(
  state: unknown,
  fallback: DoctorBackTarget,
  isAllowed: (path: string) => boolean,
): DoctorBackTarget {
  const candidate = readBackTarget(state);
  return candidate && isAllowed(candidate.to) ? candidate : fallback;
}

function readBackTarget(state: unknown): DoctorBackTarget | null {
  if (!isRecord(state) || !isRecord(state.doctorBack)) return null;
  const { to, label } = state.doctorBack;
  if (
    typeof to !== 'string' ||
    (to !== '/doctor' && !to.startsWith('/doctor/')) ||
    typeof label !== 'string' ||
    label.length > 80
  ) {
    return null;
  }
  const parent = readBackTarget(state.doctorBack.state);
  return { to, label, ...(parent ? { state: { doctorBack: parent } } : {}) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
