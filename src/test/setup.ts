// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { i18n } from "@lingui/core";

// Activate a locale globally so the Lingui macro resolves in any test,
// including plain modules that never render under an I18nProvider. An empty
// catalog means the macro's embedded English source is what comes out, which
// is what assertions here should read.
i18n.loadAndActivate({ locale: "en", messages: {} });

afterEach(() => {
  cleanup();
});

// jsdom implements none of these, and Radix's popper-backed primitives
// (Tooltip, Select, Popover) reach for all of them on mount.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

global.ResizeObserver = class ResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
};

global.IntersectionObserver = class IntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  root = null;
  rootMargin = "";
  thresholds: number[] = [];
} as unknown as typeof globalThis.IntersectionObserver;

// @formkit/auto-animate calls el.animate() from a MutationObserver, so a missing
// Web Animations API throws outside any test's stack: every test still reports
// as passed and only the exit code says otherwise.
Element.prototype.animate = vi.fn().mockImplementation(() => ({
  cancel: vi.fn(),
  finish: vi.fn(),
  pause: vi.fn(),
  play: vi.fn(),
  reverse: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  finished: Promise.resolve(),
  onfinish: null,
})) as unknown as Element["animate"];
