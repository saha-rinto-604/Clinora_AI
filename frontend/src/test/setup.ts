import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { toHaveNoViolations } from 'jest-axe';
import { afterEach, expect } from 'vitest';

expect.extend(toHaveNoViolations);

Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: () => undefined,
});

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

class TestIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '0px';
  readonly thresholds = [0];

  disconnect() {}

  observe() {}

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  unobserve() {}
}

if (!window.IntersectionObserver) {
  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    value: TestIntersectionObserver,
  });
}

afterEach(() => {
  cleanup();
});
