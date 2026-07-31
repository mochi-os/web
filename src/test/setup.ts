// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { i18n } from "@lingui/core";

// Activate a locale globally so the Lingui macro resolves in any test,
// including plain modules that never render under an I18nProvider. An empty
// catalog means the macro's embedded English source is what comes out, which
// is what assertions here should read.
i18n.loadAndActivate({ locale: "en", messages: {} });

afterEach(() => {
  cleanup();
});
