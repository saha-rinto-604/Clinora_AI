const ROLE_LANDING_PATHS: Record<string, string> = {
  DOCTOR: '/doctor',
  PATIENT: '/patient',
  RESEARCHER: '/account',
  SYSTEM_ADMIN: '/account',
};

const ROLE_RETURN_PREFIXES: Record<string, readonly string[]> = {
  DOCTOR: ['/doctor'],
  PATIENT: ['/patient'],
  SYSTEM_ADMIN: ['/admin'],
};

export function roleLandingPath(role: string) {
  return ROLE_LANDING_PATHS[role] ?? '/account';
}

export function postLoginDestination(role: string, requestedFrom?: string) {
  const landingPath = roleLandingPath(role);
  if (!isSafeInternalPath(requestedFrom)) return landingPath;

  const pathname = requestedFrom.split(/[?#]/, 1)[0];
  const allowedPrefixes = ROLE_RETURN_PREFIXES[role] ?? [];
  return allowedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
    ? requestedFrom
    : landingPath;
}

function isSafeInternalPath(path?: string): path is string {
  return Boolean(path?.startsWith('/') && !path.startsWith('//'));
}
