export function parseUserAgent(userAgent: string | null) {
  if (!userAgent)
    return { label: 'Unknown browser/device', browser: 'Unknown browser', os: 'Unknown operating system' };
  const edge = userAgent.match(/Edg\/([\d.]+)/);
  const chrome = userAgent.match(/(?:Chrome|CriOS)\/([\d.]+)/);
  const firefox = userAgent.match(/(?:Firefox|FxiOS)\/([\d.]+)/);
  const safari = chrome ? null : userAgent.match(/Version\/([\d.]+).*Safari/);
  const browserName = edge ? 'Edge' : chrome ? 'Chrome' : firefox ? 'Firefox' : safari ? 'Safari' : 'Unknown browser';
  const version = edge?.[1] ?? chrome?.[1] ?? firefox?.[1] ?? safari?.[1];
  const os = /iPhone/.test(userAgent)
    ? 'iPhone'
    : /Android/.test(userAgent)
      ? 'Android'
      : /Windows/.test(userAgent)
        ? 'Windows'
        : /Linux/.test(userAgent)
          ? 'Linux'
          : /Mac OS X/.test(userAgent)
            ? 'macOS'
            : 'Unknown device';
  return {
    label: browserName === 'Unknown browser' ? 'Unknown browser/device' : `${browserName} on ${os}`,
    browser: version ? `${browserName} ${version}` : browserName,
    os,
  };
}
